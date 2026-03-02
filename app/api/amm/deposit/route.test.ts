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
  asset: { currency: "XRP" },
  asset2: { currency: "USD", issuer: TEST_WALLET_2.address },
  amount: { currency: "XRP", value: "100" },
  amount2: { currency: "USD", issuer: TEST_WALLET_2.address, value: "50" },
  mode: "two-asset",
};

describe("POST /api/amm/deposit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  it("returns 400 when seed is missing", async () => {
    const { seed: _, ...noSeed } = validBody;
    const res = await POST(postRequest("/api/amm/deposit", noSeed));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/seed/i);
  });

  it("returns 400 when asset is missing", async () => {
    const { asset: _, ...noAsset } = validBody;
    const res = await POST(postRequest("/api/amm/deposit", noAsset));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/asset/i);
  });

  it("returns 400 when asset2 is missing", async () => {
    const { asset2: _, ...noAsset2 } = validBody;
    const res = await POST(postRequest("/api/amm/deposit", noAsset2));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/asset2/i);
  });

  it("returns 400 when mode is missing", async () => {
    const { mode: _, ...noMode } = validBody;
    const res = await POST(postRequest("/api/amm/deposit", noMode));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/mode/i);
  });

  it("returns 400 for invalid mode", async () => {
    const res = await POST(
      postRequest("/api/amm/deposit", { ...validBody, mode: "invalid-mode" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid mode/);
  });

  it("returns 400 when two-asset mode is missing amount", async () => {
    const { amount: _, ...noAmount } = validBody;
    const res = await POST(postRequest("/api/amm/deposit", noAmount));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/amount is required for two-asset mode/);
  });

  it("returns 400 when two-asset mode is missing amount2", async () => {
    const { amount2: _, ...noAmount2 } = validBody;
    const res = await POST(postRequest("/api/amm/deposit", noAmount2));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/amount2 is required for two-asset mode/);
  });

  it("returns 400 when two-asset-if-empty mode is missing amount", async () => {
    const { amount: _, ...noAmount } = validBody;
    const res = await POST(
      postRequest("/api/amm/deposit", {
        ...noAmount,
        mode: "two-asset-if-empty",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(
      /amount is required for two-asset-if-empty mode/,
    );
  });

  it("returns 400 when two-asset-if-empty mode is missing amount2", async () => {
    const { amount2: _, ...noAmount2 } = validBody;
    const res = await POST(
      postRequest("/api/amm/deposit", {
        ...noAmount2,
        mode: "two-asset-if-empty",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(
      /amount2 is required for two-asset-if-empty mode/,
    );
  });

  it("returns 400 when single-asset mode is missing amount", async () => {
    const res = await POST(
      postRequest("/api/amm/deposit", {
        seed: validBody.seed,
        asset: validBody.asset,
        asset2: validBody.asset2,
        mode: "single-asset",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/amount is required for single-asset mode/);
  });

  // ---------------------------------------------------------------------------
  // Success
  // ---------------------------------------------------------------------------

  it("returns 201 on successful two-asset deposit", async () => {
    mockClient.submitAndWait.mockResolvedValueOnce(successTxResult());

    const res = await POST(postRequest("/api/amm/deposit", validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.result).toBeDefined();
    expect(body.result.meta.TransactionResult).toBe("tesSUCCESS");
  });

  it("returns 201 on successful single-asset deposit", async () => {
    mockClient.submitAndWait.mockResolvedValueOnce(successTxResult());

    const res = await POST(
      postRequest("/api/amm/deposit", {
        seed: validBody.seed,
        asset: validBody.asset,
        asset2: validBody.asset2,
        amount: validBody.amount,
        mode: "single-asset",
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.result).toBeDefined();
  });

  it("submits correct transaction shape", async () => {
    mockClient.submitAndWait.mockResolvedValueOnce(successTxResult());

    await POST(postRequest("/api/amm/deposit", validBody));

    expect(mockClient.submitAndWait).toHaveBeenCalledWith(
      expect.objectContaining({
        TransactionType: "AMMDeposit",
        Account: TEST_WALLET.address,
        Asset: expect.any(Object),
        Asset2: expect.any(Object),
        Flags: expect.any(Number),
        Amount: expect.anything(),
        Amount2: expect.anything(),
      }),
      expect.any(Object),
    );
  });

  // ---------------------------------------------------------------------------
  // Transaction failure
  // ---------------------------------------------------------------------------

  it("returns 422 on transaction failure", async () => {
    mockClient.submitAndWait.mockResolvedValueOnce(
      failedTxResult("tecUNFUNDED_AMM"),
    );

    const res = await POST(postRequest("/api/amm/deposit", validBody));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns friendly error message for known error codes", async () => {
    mockClient.submitAndWait.mockResolvedValueOnce(
      failedTxResult("tecAMM_EMPTY"),
    );

    const res = await POST(postRequest("/api/amm/deposit", validBody));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/empty/i);
    expect(body.code).toBe("tecAMM_EMPTY");
  });
});
