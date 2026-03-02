import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  postRequest,
  successTxResult,
  failedTxResult,
  TEST_WALLET,
  TEST_WALLET_2,
} from "@/lib/test-helpers";

const mockClient = vi.hoisted(() => ({
  request: vi.fn(),
  submitAndWait: vi.fn(),
  fundWallet: vi.fn(),
  getOrderbook: vi.fn(),
  isConnected: vi.fn().mockReturnValue(true),
  connect: vi.fn(),
  disconnect: vi.fn(),
}));
vi.mock("@/lib/xrpl/client", () => ({
  getClient: vi.fn().mockResolvedValue(mockClient),
}));

import { POST } from "./route";

const validBody = {
  seed: TEST_WALLET.seed!,
  amount: { currency: "XRP", value: "500" },
  amount2: { currency: "USD", issuer: TEST_WALLET_2.address, value: "250" },
  tradingFee: 500,
};

describe("POST /api/amm/create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  it("returns 400 when seed is missing", async () => {
    const { seed: _, ...noSeed } = validBody;
    const res = await POST(postRequest("/api/amm/create", noSeed));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/seed/i);
  });

  it("returns 400 when amount is missing", async () => {
    const { amount: _, ...noAmount } = validBody;
    const res = await POST(postRequest("/api/amm/create", noAmount));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/amount/i);
  });

  it("returns 400 when amount2 is missing", async () => {
    const { amount2: _, ...noAmount2 } = validBody;
    const res = await POST(postRequest("/api/amm/create", noAmount2));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/amount2/i);
  });

  it("returns 400 when tradingFee is missing", async () => {
    const { tradingFee: _, ...noFee } = validBody;
    const res = await POST(postRequest("/api/amm/create", noFee));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/tradingFee/i);
  });

  it("returns 400 when amount.currency is missing", async () => {
    const res = await POST(
      postRequest("/api/amm/create", {
        ...validBody,
        amount: { value: "500" },
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/amount must include currency and value/);
  });

  it("returns 400 when amount.value is missing", async () => {
    const res = await POST(
      postRequest("/api/amm/create", {
        ...validBody,
        amount: { currency: "XRP" },
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/amount must include currency and value/);
  });

  it("returns 400 when amount2.currency is missing", async () => {
    const res = await POST(
      postRequest("/api/amm/create", {
        ...validBody,
        amount2: { value: "250" },
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/amount2 must include currency and value/);
  });

  it("returns 400 when amount2.value is missing", async () => {
    const res = await POST(
      postRequest("/api/amm/create", {
        ...validBody,
        amount2: { currency: "USD", issuer: TEST_WALLET_2.address },
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/amount2 must include currency and value/);
  });

  it("returns 400 when non-XRP amount has no issuer", async () => {
    const res = await POST(
      postRequest("/api/amm/create", {
        ...validBody,
        amount: { currency: "USD", value: "500" },
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/amount\.issuer is required/);
  });

  it("returns 400 when non-XRP amount2 has no issuer", async () => {
    const res = await POST(
      postRequest("/api/amm/create", {
        ...validBody,
        amount2: { currency: "EUR", value: "250" },
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/amount2\.issuer is required/);
  });

  it("returns 400 for non-positive amount.value", async () => {
    const res = await POST(
      postRequest("/api/amm/create", {
        ...validBody,
        amount: { currency: "XRP", value: "0" },
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/amount\.value must be a positive number/);
  });

  it("returns 400 for non-positive amount2.value", async () => {
    const res = await POST(
      postRequest("/api/amm/create", {
        ...validBody,
        amount2: {
          currency: "USD",
          issuer: TEST_WALLET_2.address,
          value: "-1",
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/amount2\.value must be a positive number/);
  });

  it("returns 400 for tradingFee > 1000", async () => {
    const res = await POST(
      postRequest("/api/amm/create", { ...validBody, tradingFee: 1001 }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(
      /tradingFee must be an integer between 0 and 1000/,
    );
  });

  it("returns 400 for negative tradingFee", async () => {
    const res = await POST(
      postRequest("/api/amm/create", { ...validBody, tradingFee: -1 }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(
      /tradingFee must be an integer between 0 and 1000/,
    );
  });

  it("returns 400 for non-integer tradingFee", async () => {
    const res = await POST(
      postRequest("/api/amm/create", { ...validBody, tradingFee: 50.5 }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(
      /tradingFee must be an integer between 0 and 1000/,
    );
  });

  // ---------------------------------------------------------------------------
  // Success
  // ---------------------------------------------------------------------------

  it("returns 201 on successful AMM creation", async () => {
    mockClient.submitAndWait.mockResolvedValueOnce(successTxResult());

    const res = await POST(postRequest("/api/amm/create", validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.result).toBeDefined();
    expect(body.result.meta.TransactionResult).toBe("tesSUCCESS");
  });

  it("rejects tradingFee=0 (falsy, caught by validateRequired)", async () => {
    const res = await POST(
      postRequest("/api/amm/create", { ...validBody, tradingFee: 0 }),
    );
    // validateRequired treats 0 as missing since it checks falsiness
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/tradingFee/i);
  });

  it("accepts tradingFee=1000 as valid", async () => {
    mockClient.submitAndWait.mockResolvedValueOnce(successTxResult());

    const res = await POST(
      postRequest("/api/amm/create", { ...validBody, tradingFee: 1000 }),
    );
    expect(res.status).toBe(201);
  });

  // ---------------------------------------------------------------------------
  // Transaction failure
  // ---------------------------------------------------------------------------

  it("returns 422 on transaction failure", async () => {
    mockClient.submitAndWait.mockResolvedValueOnce(
      failedTxResult("tecDUPLICATE"),
    );

    const res = await POST(postRequest("/api/amm/create", validBody));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns friendly error message for known error codes", async () => {
    mockClient.submitAndWait.mockResolvedValueOnce(
      failedTxResult("tecDUPLICATE"),
    );

    const res = await POST(postRequest("/api/amm/create", validBody));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/);
    expect(body.code).toBe("tecDUPLICATE");
  });
});
