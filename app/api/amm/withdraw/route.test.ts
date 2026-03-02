import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  postRequest,
  successTxResult,
  failedTxResult,
  TEST_WALLET,
  TEST_WALLET_2 } from "@/lib/test-helpers";

const mockClient = vi.hoisted(() => ({
  request: vi.fn(),
  submitAndWait: vi.fn(),
  fundWallet: vi.fn(),
  getOrderbook: vi.fn(),
  isConnected: vi.fn().mockReturnValue(true),
  connect: vi.fn(),
  disconnect: vi.fn() }));
vi.mock("@/lib/xrpl/client", () => ({
  getClient: vi.fn().mockResolvedValue(mockClient) }));

import { POST } from "./route";

const validBody = {
  seed: TEST_WALLET.seed!,
  asset: { currency: "XRP" },
  asset2: { currency: "USD", issuer: TEST_WALLET_2.address },
  amount: { currency: "XRP", value: "50" },
  amount2: { currency: "USD", issuer: TEST_WALLET_2.address, value: "25" },
  mode: "two-asset" };

describe("POST /api/amm/withdraw", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  it("returns 400 when seed is missing", async () => {
    const { seed: _, ...noSeed } = validBody;
    const res = await POST(postRequest("/api/amm/withdraw", noSeed));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/seed/i);
  });

  it("returns 400 when asset is missing", async () => {
    const { asset: _, ...noAsset } = validBody;
    const res = await POST(postRequest("/api/amm/withdraw", noAsset));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/asset/i);
  });

  it("returns 400 when asset2 is missing", async () => {
    const { asset2: _, ...noAsset2 } = validBody;
    const res = await POST(postRequest("/api/amm/withdraw", noAsset2));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/asset2/i);
  });

  it("returns 400 when mode is missing", async () => {
    const { mode: _, ...noMode } = validBody;
    const res = await POST(postRequest("/api/amm/withdraw", noMode));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/mode/i);
  });

  it("returns 400 for invalid mode", async () => {
    const res = await POST(
      postRequest("/api/amm/withdraw", {
        ...validBody,
        mode: "bad-mode" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid mode/);
  });

  it("returns 400 when two-asset mode is missing amount", async () => {
    const { amount: _, ...noAmount } = validBody;
    const res = await POST(postRequest("/api/amm/withdraw", noAmount));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/amount is required for two-asset mode/);
  });

  it("returns 400 when two-asset mode is missing amount2", async () => {
    const { amount2: _, ...noAmount2 } = validBody;
    const res = await POST(postRequest("/api/amm/withdraw", noAmount2));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/amount2 is required for two-asset mode/);
  });

  it("returns 400 when single-asset mode is missing amount", async () => {
    const res = await POST(
      postRequest("/api/amm/withdraw", {
        seed: validBody.seed,
        asset: validBody.asset,
        asset2: validBody.asset2,
        mode: "single-asset" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/amount is required for single-asset mode/);
  });

  // ---------------------------------------------------------------------------
  // Success
  // ---------------------------------------------------------------------------

  it("returns 201 on successful two-asset withdrawal", async () => {
    mockClient.submitAndWait.mockResolvedValueOnce(successTxResult());

    const res = await POST(postRequest("/api/amm/withdraw", validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.result).toBeDefined();
    expect(body.result.meta.TransactionResult).toBe("tesSUCCESS");
  });

  it("returns 201 on successful single-asset withdrawal", async () => {
    mockClient.submitAndWait.mockResolvedValueOnce(successTxResult());

    const res = await POST(
      postRequest("/api/amm/withdraw", {
        seed: validBody.seed,
        asset: validBody.asset,
        asset2: validBody.asset2,
        amount: validBody.amount,
        mode: "single-asset" }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.result).toBeDefined();
  });

  it("returns 201 on withdraw-all (no amounts needed)", async () => {
    mockClient.submitAndWait.mockResolvedValueOnce(successTxResult());
    // The withdraw-all path also tries amm_info to check if pool was deleted
    mockClient.request.mockRejectedValueOnce(new Error("actNotFound"));

    const res = await POST(
      postRequest("/api/amm/withdraw", {
        seed: validBody.seed,
        asset: validBody.asset,
        asset2: validBody.asset2,
        mode: "withdraw-all" }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.result).toBeDefined();
    expect(body.poolDeleted).toBe(true);
  });

  it("does not set poolDeleted when pool still exists after withdraw-all", async () => {
    mockClient.submitAndWait.mockResolvedValueOnce(successTxResult());
    // Pool still exists after withdraw-all
    mockClient.request.mockResolvedValueOnce({ result: { amm: {} } });

    const res = await POST(
      postRequest("/api/amm/withdraw", {
        seed: validBody.seed,
        asset: validBody.asset,
        asset2: validBody.asset2,
        mode: "withdraw-all" }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.poolDeleted).toBeUndefined();
  });

  it("submits correct transaction shape", async () => {
    mockClient.submitAndWait.mockResolvedValueOnce(successTxResult());

    await POST(postRequest("/api/amm/withdraw", validBody));

    expect(mockClient.submitAndWait).toHaveBeenCalledWith(
      expect.objectContaining({
        TransactionType: "AMMWithdraw",
        Account: TEST_WALLET.address,
        Asset: expect.any(Object),
        Asset2: expect.any(Object),
        Flags: expect.any(Number),
        Amount: expect.anything(),
        Amount2: expect.anything() }),
      expect.any(Object),
    );
  });

  // ---------------------------------------------------------------------------
  // Transaction failure
  // ---------------------------------------------------------------------------

  it("returns 422 on transaction failure", async () => {
    mockClient.submitAndWait.mockResolvedValueOnce(
      failedTxResult("tecAMM_BALANCE"),
    );

    const res = await POST(postRequest("/api/amm/withdraw", validBody));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns friendly error message for known error codes", async () => {
    mockClient.submitAndWait.mockResolvedValueOnce(
      failedTxResult("tecAMM_BALANCE"),
    );

    const res = await POST(postRequest("/api/amm/withdraw", validBody));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/drain one side/i);
    expect(body.code).toBe("tecAMM_BALANCE");
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  it("returns 500 on unexpected error", async () => {
    mockClient.submitAndWait.mockRejectedValueOnce(
      new Error("connection error"),
    );

    const res = await POST(postRequest("/api/amm/withdraw", validBody));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/connection error/);
  });
});
