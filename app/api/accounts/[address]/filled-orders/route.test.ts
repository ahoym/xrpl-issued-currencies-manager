import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  getRequest,
  routeParams,
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

vi.mock("@/lib/xrpl/filled-orders", () => ({
  parseFilledOrders: vi.fn().mockReturnValue([]),
}));

import { GET } from "./route";

const validAddress = TEST_WALLET.address;
const baseParams = {
  base_currency: "USD",
  base_issuer: TEST_WALLET_2.address,
  quote_currency: "XRP",
};

describe("GET /api/accounts/[address]/filled-orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  it("returns 400 for invalid address", async () => {
    const res = await GET(
      getRequest("/api/accounts/not-valid/filled-orders", baseParams),
      routeParams({ address: "not-valid" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid/);
  });

  it("returns 400 when base_currency is missing", async () => {
    const res = await GET(
      getRequest(`/api/accounts/${validAddress}/filled-orders`, {
        quote_currency: "XRP",
      }),
      routeParams({ address: validAddress }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/base_currency/);
  });

  it("returns 400 when quote_currency is missing", async () => {
    const res = await GET(
      getRequest(`/api/accounts/${validAddress}/filled-orders`, {
        base_currency: "USD",
        base_issuer: TEST_WALLET_2.address,
      }),
      routeParams({ address: validAddress }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/quote_currency/);
  });

  it("returns 400 for non-XRP base without base_issuer", async () => {
    const res = await GET(
      getRequest(`/api/accounts/${validAddress}/filled-orders`, {
        base_currency: "USD",
        quote_currency: "XRP",
      }),
      routeParams({ address: validAddress }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/base_issuer is required/);
  });

  // ---------------------------------------------------------------------------
  // Success
  // ---------------------------------------------------------------------------

  it("returns filled orders on success", async () => {
    mockClient.request.mockResolvedValueOnce({
      result: { transactions: [] },
    });

    const res = await GET(
      getRequest(`/api/accounts/${validAddress}/filled-orders`, baseParams),
      routeParams({ address: validAddress }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.address).toBe(validAddress);
    expect(body.filledOrders).toEqual([]);
  });

  it("calls account_tx with correct account and multiplied limit", async () => {
    mockClient.request.mockResolvedValueOnce({
      result: { transactions: [] },
    });

    await GET(
      getRequest(`/api/accounts/${validAddress}/filled-orders`, baseParams),
      routeParams({ address: validAddress }),
    );

    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "account_tx",
        account: validAddress,
        limit: expect.any(Number),
      }),
    );
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  it("returns 404 when account is not found", async () => {
    mockClient.request.mockRejectedValueOnce(new Error("actNotFound"));

    const res = await GET(
      getRequest(`/api/accounts/${validAddress}/filled-orders`, baseParams),
      routeParams({ address: validAddress }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 500 on unexpected error", async () => {
    mockClient.request.mockRejectedValueOnce(new Error("network error"));

    const res = await GET(
      getRequest(`/api/accounts/${validAddress}/filled-orders`, baseParams),
      routeParams({ address: validAddress }),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/network error/);
  });
});
