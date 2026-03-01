import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  postRequest,
  successTxResult,
  routeParams,
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

describe("POST /api/accounts/[address]/rippling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.submitAndWait.mockResolvedValue(successTxResult());
    mockClient.request.mockResolvedValue({
      result: { lines: [] } });
  });

  it("returns 400 for invalid address", async () => {
    const req = postRequest("/api/accounts/bad-address/rippling", {
      seed: TEST_WALLET.seed });
    const res = await POST(req, routeParams({ address: "bad-address" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("does not match");
  });

  it("returns 400 for missing seed", async () => {
    const req = postRequest(
      `/api/accounts/${TEST_WALLET.address}/rippling`,
      {},
    );
    const res = await POST(
      req,
      routeParams({ address: TEST_WALLET.address }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Missing required fields");
    expect(body.error).toContain("seed");
  });

  it("returns 200 on success with no trust lines to repair", async () => {
    const req = postRequest(
      `/api/accounts/${TEST_WALLET.address}/rippling`,
      { seed: TEST_WALLET.seed },
    );
    const res = await POST(
      req,
      routeParams({ address: TEST_WALLET.address }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result.message).toBe("Rippling enabled");
    expect(body.result.trustLinesUpdated).toBe(0);
    expect(mockClient.submitAndWait).toHaveBeenCalledWith(
      expect.objectContaining({
        TransactionType: "AccountSet" }),
      expect.any(Object),
    );
  });

  it("repairs NoRipple trust lines", async () => {
    mockClient.request.mockResolvedValue({
      result: {
        lines: [
          {
            account: TEST_WALLET_2.address,
            currency: "USD",
            limit: "1000",
            no_ripple: true },
        ] } });

    const req = postRequest(
      `/api/accounts/${TEST_WALLET.address}/rippling`,
      { seed: TEST_WALLET.seed },
    );
    const res = await POST(
      req,
      routeParams({ address: TEST_WALLET.address }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result.trustLinesUpdated).toBe(1);
    // AccountSet + 1 TrustSet
    expect(mockClient.submitAndWait).toHaveBeenCalledTimes(2);
  });
});
