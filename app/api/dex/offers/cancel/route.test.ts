import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  postRequest,
  successTxResult,
  failedTxResult,
  TEST_WALLET } from "@/lib/test-helpers";

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
  offerSequence: 42 };

describe("POST /api/dex/offers/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  it("returns 400 when seed is missing", async () => {
    const res = await POST(
      postRequest("/api/dex/offers/cancel", { offerSequence: 1 }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/seed/i);
  });

  it("returns 400 when offerSequence is missing", async () => {
    const res = await POST(
      postRequest("/api/dex/offers/cancel", { seed: TEST_WALLET.seed! }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/offerSequence/);
  });

  it("passes negative offerSequence to XRPL (no server-side validation)", async () => {
    mockClient.submitAndWait.mockRejectedValueOnce(new Error("invalid field"));
    const res = await POST(
      postRequest("/api/dex/offers/cancel", {
        seed: TEST_WALLET.seed!,
        offerSequence: -1 }),
    );
    expect(res.status).toBe(500);
  });

  // ---------------------------------------------------------------------------
  // Success
  // ---------------------------------------------------------------------------

  it("returns 201 on successful cancellation", async () => {
    mockClient.submitAndWait.mockResolvedValueOnce(successTxResult());

    const res = await POST(postRequest("/api/dex/offers/cancel", validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.result).toBeDefined();
    expect(body.result.meta.TransactionResult).toBe("tesSUCCESS");
  });

  it("accepts offerSequence=0 as valid", async () => {
    mockClient.submitAndWait.mockResolvedValueOnce(successTxResult());

    const res = await POST(
      postRequest("/api/dex/offers/cancel", { ...validBody, offerSequence: 0 }),
    );
    expect(res.status).toBe(201);
  });

  // ---------------------------------------------------------------------------
  // Transaction failure
  // ---------------------------------------------------------------------------

  it("returns 422 on transaction failure", async () => {
    mockClient.submitAndWait.mockResolvedValueOnce(
      failedTxResult("tecNO_PERMISSION"),
    );

    const res = await POST(postRequest("/api/dex/offers/cancel", validBody));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/tecNO_PERMISSION/);
  });
});
