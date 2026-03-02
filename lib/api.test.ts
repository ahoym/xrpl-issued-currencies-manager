import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import {
  getNetworkParam,
  validateRequired,
  walletFromSeed,
  validateAddress,
  validateSeedMatchesAddress,
  validateCredentialType,
  validatePositiveAmount,
  validateCurrencyPair,
  parseLimit,
  validateDexAmount,
  validateAmmModeAmounts,
  extractCreatedLedgerIndex,
  getTransactionResult,
  txFailureResponse,
  apiErrorResponse,
} from "./api";
import { TEST_WALLET } from "./test-helpers";

// ---------------------------------------------------------------------------
// getNetworkParam
// ---------------------------------------------------------------------------

describe("getNetworkParam", () => {
  it("returns the network query param when present", () => {
    const req = new NextRequest(
      new URL("http://localhost:3000/api/test?network=devnet"),
    );
    expect(getNetworkParam(req)).toBe("devnet");
  });

  it("returns undefined when network param is missing", () => {
    const req = new NextRequest(new URL("http://localhost:3000/api/test"));
    expect(getNetworkParam(req)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validateRequired
// ---------------------------------------------------------------------------

describe("validateRequired", () => {
  it("returns null when all fields are present", () => {
    const result = validateRequired({ a: "1", b: "2" }, ["a", "b"]);
    expect(result).toBeNull();
  });

  it("returns 400 response listing missing fields", async () => {
    const result = validateRequired({ a: "1" }, ["a", "b", "c"]);
    expect(result).toBeInstanceOf(Response);
    expect(result!.status).toBe(400);
    const body = await result!.json();
    expect(body.error).toContain("b");
    expect(body.error).toContain("c");
  });

  it("treats falsy values as missing", async () => {
    const result = validateRequired({ a: "", b: 0, c: null }, ["a", "b", "c"]);
    expect(result).toBeInstanceOf(Response);
    const body = await result!.json();
    expect(body.error).toContain("a");
    expect(body.error).toContain("b");
    expect(body.error).toContain("c");
  });

  it("returns null for empty fields array", () => {
    expect(validateRequired({}, [])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// walletFromSeed
// ---------------------------------------------------------------------------

describe("walletFromSeed", () => {
  it("returns Wallet for a valid seed", () => {
    const result = walletFromSeed(TEST_WALLET.seed!);
    expect(result).not.toBeInstanceOf(Response);
    if (!(result instanceof Response)) {
      expect(result.address).toBe(TEST_WALLET.address);
    }
  });

  it("returns Response for an invalid seed", async () => {
    const result = walletFromSeed("not-a-real-seed");
    expect(result).toBeInstanceOf(Response);
    if (result instanceof Response) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.error).toContain("Invalid seed");
    }
  });
});

// ---------------------------------------------------------------------------
// validateAddress
// ---------------------------------------------------------------------------

describe("validateAddress", () => {
  it("returns null for a valid classic address", () => {
    expect(validateAddress(TEST_WALLET.address, "test")).toBeNull();
  });

  it("returns 400 for an invalid address", async () => {
    const result = validateAddress("not-an-address", "myField");
    expect(result).toBeInstanceOf(Response);
    expect(result!.status).toBe(400);
    const body = await result!.json();
    expect(body.error).toContain("Invalid myField");
  });
});

// ---------------------------------------------------------------------------
// validateSeedMatchesAddress
// ---------------------------------------------------------------------------

describe("validateSeedMatchesAddress", () => {
  it("returns null when seed matches address", () => {
    expect(
      validateSeedMatchesAddress(TEST_WALLET, TEST_WALLET.address),
    ).toBeNull();
  });

  it("returns 400 when seed does not match address", async () => {
    const result = validateSeedMatchesAddress(TEST_WALLET, "rDifferentAddr123456789012345678");
    expect(result).toBeInstanceOf(Response);
    expect(result!.status).toBe(400);
    const body = await result!.json();
    expect(body.error).toContain("does not match");
  });
});

// ---------------------------------------------------------------------------
// validateCredentialType
// ---------------------------------------------------------------------------

describe("validateCredentialType", () => {
  it("returns null for a valid length", () => {
    expect(validateCredentialType("KYC")).toBeNull();
  });

  it("returns 400 when exceeding max length", async () => {
    const tooLong = "x".repeat(200);
    const result = validateCredentialType(tooLong);
    expect(result).toBeInstanceOf(Response);
    expect(result!.status).toBe(400);
    const body = await result!.json();
    expect(body.error).toContain("must not exceed");
  });
});

// ---------------------------------------------------------------------------
// validatePositiveAmount
// ---------------------------------------------------------------------------

describe("validatePositiveAmount", () => {
  it("returns null for a positive numeric string", () => {
    expect(validatePositiveAmount("100", "amount")).toBeNull();
    expect(validatePositiveAmount("0.001", "amount")).toBeNull();
  });

  it("returns 400 for zero", async () => {
    const result = validatePositiveAmount("0", "amount");
    expect(result).toBeInstanceOf(Response);
    expect(result!.status).toBe(400);
  });

  it("returns 400 for negative values", async () => {
    const result = validatePositiveAmount("-5", "amount");
    expect(result!.status).toBe(400);
  });

  it("returns 400 for non-numeric strings", async () => {
    const result = validatePositiveAmount("abc", "amount");
    expect(result!.status).toBe(400);
  });

  it("returns 400 for Infinity", async () => {
    const result = validatePositiveAmount("Infinity", "amount");
    expect(result!.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// validateCurrencyPair
// ---------------------------------------------------------------------------

describe("validateCurrencyPair", () => {
  function req(params: Record<string, string>) {
    const url = new URL("http://localhost:3000/api/test");
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    return new NextRequest(url);
  }

  it("returns validated pair for XRP/issued currency", () => {
    const result = validateCurrencyPair(
      req({
        base_currency: "XRP",
        quote_currency: "USD",
        quote_issuer: TEST_WALLET.address,
      }),
    );
    expect(result).not.toBeInstanceOf(Response);
    if (!(result instanceof Response)) {
      expect(result.baseCurrency).toBe("XRP");
      expect(result.quoteCurrency).toBe("USD");
      expect(result.quoteIssuer).toBe(TEST_WALLET.address);
      expect(result.baseIssuer).toBeUndefined();
    }
  });

  it("returns 400 when base_currency is missing", async () => {
    const result = validateCurrencyPair(
      req({ quote_currency: "USD", quote_issuer: TEST_WALLET.address }),
    );
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(400);
  });

  it("returns 400 when non-XRP currency has no issuer", async () => {
    const result = validateCurrencyPair(
      req({ base_currency: "USD", quote_currency: "XRP" }),
    );
    expect(result).toBeInstanceOf(Response);
    const body = await (result as Response).json();
    expect(body.error).toContain("base_issuer");
  });

  it("returns 400 for invalid issuer address", async () => {
    const result = validateCurrencyPair(
      req({
        base_currency: "XRP",
        quote_currency: "USD",
        quote_issuer: "invalid-address",
      }),
    );
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(400);
  });

  it("accepts XRP/XRP pair (both sides no issuer needed)", () => {
    const result = validateCurrencyPair(
      req({ base_currency: "XRP", quote_currency: "XRP" }),
    );
    expect(result).not.toBeInstanceOf(Response);
  });
});

// ---------------------------------------------------------------------------
// parseLimit
// ---------------------------------------------------------------------------

describe("parseLimit", () => {
  function sp(params: Record<string, string>) {
    const url = new URL("http://localhost:3000/api/test");
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return url.searchParams;
  }

  it("returns default when limit param is absent", () => {
    expect(parseLimit(sp({}), 20)).toBe(20);
  });

  it("parses a valid integer limit", () => {
    expect(parseLimit(sp({ limit: "10" }), 20)).toBe(10);
  });

  it("clamps to MAX_API_LIMIT (400)", () => {
    expect(parseLimit(sp({ limit: "9999" }), 20)).toBe(400);
  });

  it("falls back to default for non-numeric limit", () => {
    expect(parseLimit(sp({ limit: "abc" }), 50)).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// validateDexAmount
// ---------------------------------------------------------------------------

describe("validateDexAmount", () => {
  it("returns null for a valid XRP amount", () => {
    expect(validateDexAmount({ currency: "XRP", value: "100" }, "takerGets")).toBeNull();
  });

  it("returns null for a valid issued currency amount", () => {
    expect(
      validateDexAmount(
        { currency: "USD", value: "50", issuer: TEST_WALLET.address },
        "takerPays",
      ),
    ).toBeNull();
  });

  it("returns 400 when currency is missing", async () => {
    const result = validateDexAmount({ currency: "", value: "10" }, "field");
    expect(result).toBeInstanceOf(Response);
    expect(result!.status).toBe(400);
  });

  it("returns 400 when value is missing", async () => {
    const result = validateDexAmount({ currency: "XRP", value: "" }, "field");
    expect(result).toBeInstanceOf(Response);
  });

  it("returns 400 when non-XRP has no issuer", async () => {
    const result = validateDexAmount({ currency: "USD", value: "10" }, "field");
    expect(result).toBeInstanceOf(Response);
    const body = await result!.json();
    expect(body.error).toContain("issuer");
  });

  it("returns 400 for non-positive value", async () => {
    const result = validateDexAmount({ currency: "XRP", value: "-5" }, "field");
    expect(result).toBeInstanceOf(Response);
  });
});

// ---------------------------------------------------------------------------
// validateAmmModeAmounts
// ---------------------------------------------------------------------------

describe("validateAmmModeAmounts", () => {
  it("returns null for two-asset with both amounts", () => {
    expect(validateAmmModeAmounts("two-asset", "100", "200")).toBeNull();
  });

  it("returns 400 for two-asset missing amount", async () => {
    const result = validateAmmModeAmounts("two-asset", null, "200");
    expect(result).toBeInstanceOf(Response);
    const body = await result!.json();
    expect(body.error).toContain("amount");
  });

  it("returns 400 for two-asset missing amount2", async () => {
    const result = validateAmmModeAmounts("two-asset", "100", null);
    expect(result).toBeInstanceOf(Response);
    const body = await result!.json();
    expect(body.error).toContain("amount2");
  });

  it("returns null for single-asset with amount", () => {
    expect(validateAmmModeAmounts("single-asset", "100", null)).toBeNull();
  });

  it("returns 400 for single-asset missing amount", async () => {
    const result = validateAmmModeAmounts("single-asset", null, null);
    expect(result).toBeInstanceOf(Response);
  });

  it("returns null for withdraw-all (no amounts needed)", () => {
    expect(validateAmmModeAmounts("withdraw-all", null, null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractCreatedLedgerIndex
// ---------------------------------------------------------------------------

describe("extractCreatedLedgerIndex", () => {
  it("extracts index from matching CreatedNode", () => {
    const meta = {
      AffectedNodes: [
        {
          CreatedNode: {
            LedgerEntryType: "PermissionedDomain",
            LedgerIndex: "ABC123",
          },
        },
      ],
    };
    expect(extractCreatedLedgerIndex(meta, "PermissionedDomain")).toBe("ABC123");
  });

  it("returns undefined when no matching entry type", () => {
    const meta = {
      AffectedNodes: [
        {
          CreatedNode: {
            LedgerEntryType: "Other",
            LedgerIndex: "XYZ",
          },
        },
      ],
    };
    expect(extractCreatedLedgerIndex(meta, "PermissionedDomain")).toBeUndefined();
  });

  it("returns undefined for null meta", () => {
    expect(extractCreatedLedgerIndex(null, "PermissionedDomain")).toBeUndefined();
  });

  it("returns undefined when AffectedNodes is missing", () => {
    expect(extractCreatedLedgerIndex({}, "PermissionedDomain")).toBeUndefined();
  });

  it("skips ModifiedNode entries", () => {
    const meta = {
      AffectedNodes: [
        { ModifiedNode: { LedgerEntryType: "PermissionedDomain" } },
      ],
    };
    expect(extractCreatedLedgerIndex(meta, "PermissionedDomain")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getTransactionResult
// ---------------------------------------------------------------------------

describe("getTransactionResult", () => {
  it("extracts TransactionResult from meta object", () => {
    expect(
      getTransactionResult({ TransactionResult: "tesSUCCESS" }),
    ).toBe("tesSUCCESS");
  });

  it("returns undefined for null meta", () => {
    expect(getTransactionResult(null)).toBeUndefined();
  });

  it("returns undefined for string meta", () => {
    expect(getTransactionResult("validated")).toBeUndefined();
  });

  it("returns undefined when TransactionResult is not a string", () => {
    expect(getTransactionResult({ TransactionResult: 42 })).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// txFailureResponse
// ---------------------------------------------------------------------------

describe("txFailureResponse", () => {
  it("returns null on tesSUCCESS", () => {
    const result = txFailureResponse({
      result: { meta: { TransactionResult: "tesSUCCESS" } },
    } as never);
    expect(result).toBeNull();
  });

  it("returns 422 Response on failure", async () => {
    const result = txFailureResponse({
      result: { meta: { TransactionResult: "tecUNFUNDED" } },
    } as never);
    expect(result).toBeInstanceOf(Response);
    expect(result!.status).toBe(422);
    const body = await result!.json();
    expect(body.error).toContain("tecUNFUNDED");
  });

  it("uses errorMap for friendly messages", async () => {
    const errorMap = { tecFROZEN: "Currency is frozen" };
    const result = txFailureResponse(
      {
        result: { meta: { TransactionResult: "tecFROZEN" } },
      } as never,
      errorMap,
    );
    const body = await result!.json();
    expect(body.error).toBe("Currency is frozen");
    expect(body.code).toBe("tecFROZEN");
  });

  it("returns null when meta is missing", () => {
    const result = txFailureResponse({
      result: {},
    } as never);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// apiErrorResponse
// ---------------------------------------------------------------------------

describe("apiErrorResponse", () => {
  it("returns 500 with error message", async () => {
    const result = apiErrorResponse(new Error("boom"), "fallback");
    expect(result.status).toBe(500);
    const body = await result.json();
    expect(body.error).toBe("boom");
  });

  it("uses fallback when error message is empty", async () => {
    const result = apiErrorResponse(new Error(""), "fallback");
    const body = await result.json();
    expect(body.error).toBe("fallback");
  });

  it("returns 404 for actNotFound when checkNotFound is true", async () => {
    const result = apiErrorResponse(new Error("actNotFound"), "fallback", {
      checkNotFound: true,
    });
    expect(result.status).toBe(404);
  });

  it("returns 500 for actNotFound when checkNotFound is false", () => {
    const result = apiErrorResponse(new Error("actNotFound"), "fallback");
    expect(result.status).toBe(500);
  });

  it("handles non-Error thrown values", async () => {
    const result = apiErrorResponse("string error", "fallback");
    const body = await result.json();
    expect(body.error).toBe("string error");
  });
});
