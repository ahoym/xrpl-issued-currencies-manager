import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getRequest,
  routeParams,
  TEST_WALLET,
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

import { GET } from "./route";

describe("GET /api/accounts/[address]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid address", async () => {
    const request = getRequest("/api/accounts/not-valid");
    const response = await GET(request, routeParams({ address: "not-valid" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Invalid");
  });

  it("returns account info on success", async () => {
    const accountData = {
      Account: TEST_WALLET.address,
      Balance: "50000000",
      Sequence: 1,
    };
    mockClient.request.mockResolvedValue({
      result: { account_data: accountData },
    });

    const request = getRequest(`/api/accounts/${TEST_WALLET.address}`);
    const response = await GET(
      request,
      routeParams({ address: TEST_WALLET.address }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.account_data).toEqual(accountData);
  });

  it("returns 404 when account is not found", async () => {
    mockClient.request.mockRejectedValue(new Error("actNotFound"));

    const request = getRequest(`/api/accounts/${TEST_WALLET.address}`);
    const response = await GET(
      request,
      routeParams({ address: TEST_WALLET.address }),
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("actNotFound");
  });

  it("returns 500 on unexpected error", async () => {
    mockClient.request.mockRejectedValue(new Error("connection failed"));

    const request = getRequest(`/api/accounts/${TEST_WALLET.address}`);
    const response = await GET(
      request,
      routeParams({ address: TEST_WALLET.address }),
    );
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain("connection failed");
  });
});
