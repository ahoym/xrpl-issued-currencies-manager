import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRequest, routeParams, TEST_WALLET } from "@/lib/test-helpers";

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

import { GET } from "./route";

describe("GET /api/accounts/[address]/transactions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid address", async () => {
    const request = getRequest("/api/accounts/bad/transactions");
    const response = await GET(request, routeParams({ address: "bad" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Invalid");
  });

  it("returns transactions on success", async () => {
    const transactions = [
      { meta: { TransactionResult: "tesSUCCESS" }, tx: { Fee: "12" } },
    ];
    mockClient.request.mockResolvedValue({
      result: { transactions },
    });

    const request = getRequest(
      `/api/accounts/${TEST_WALLET.address}/transactions`,
    );
    const response = await GET(
      request,
      routeParams({ address: TEST_WALLET.address }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.address).toBe(TEST_WALLET.address);
    expect(body.transactions).toEqual(transactions);
  });

  it("respects limit query param", async () => {
    mockClient.request.mockResolvedValue({
      result: { transactions: [] },
    });

    const request = getRequest(
      `/api/accounts/${TEST_WALLET.address}/transactions`,
      { limit: "5" },
    );
    await GET(request, routeParams({ address: TEST_WALLET.address }));

    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5 }),
    );
  });

  it("caps limit at MAX_API_LIMIT (400)", async () => {
    mockClient.request.mockResolvedValue({
      result: { transactions: [] },
    });

    const request = getRequest(
      `/api/accounts/${TEST_WALLET.address}/transactions`,
      { limit: "9999" },
    );
    await GET(request, routeParams({ address: TEST_WALLET.address }));

    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 400 }),
    );
  });

  it("uses default limit when not specified", async () => {
    mockClient.request.mockResolvedValue({
      result: { transactions: [] },
    });

    const request = getRequest(
      `/api/accounts/${TEST_WALLET.address}/transactions`,
    );
    await GET(request, routeParams({ address: TEST_WALLET.address }));

    // DEFAULT_TRANSACTION_LIMIT = 20
    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20 }),
    );
  });

  it("returns 404 when account is not found", async () => {
    mockClient.request.mockRejectedValue(new Error("actNotFound"));

    const request = getRequest(
      `/api/accounts/${TEST_WALLET.address}/transactions`,
    );
    const response = await GET(
      request,
      routeParams({ address: TEST_WALLET.address }),
    );
    expect(response.status).toBe(404);
  });
});
