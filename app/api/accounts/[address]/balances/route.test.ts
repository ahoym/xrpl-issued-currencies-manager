import { describe, it, expect, vi, beforeEach } from "vitest";
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

import { GET } from "./route";

describe("GET /api/accounts/[address]/balances", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid address", async () => {
    const request = getRequest("/api/accounts/bad-addr/balances");
    const response = await GET(request, routeParams({ address: "bad-addr" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Invalid");
  });

  it("returns XRP balance and decoded trust line currencies on success", async () => {
    mockClient.request.mockImplementation((req: { command: string }) => {
      if (req.command === "account_info") {
        return Promise.resolve({
          result: { account_data: { Balance: "50000000" } },
        });
      }
      if (req.command === "account_lines") {
        return Promise.resolve({
          result: {
            lines: [
              {
                currency: "USD",
                account: TEST_WALLET_2.address,
                balance: "100",
                limit: "1000",
              },
            ],
          },
        });
      }
      return Promise.reject(new Error(`unexpected command: ${req.command}`));
    });

    const request = getRequest(`/api/accounts/${TEST_WALLET.address}/balances`);
    const response = await GET(
      request,
      routeParams({ address: TEST_WALLET.address }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.address).toBe(TEST_WALLET.address);
    expect(body.balances).toHaveLength(2);

    // XRP balance: 50000000 drops = 50 XRP
    expect(body.balances[0]).toEqual({ currency: "XRP", value: "50" });

    // Issued currency balance
    expect(body.balances[1]).toEqual({
      currency: "USD",
      value: "100",
      issuer: TEST_WALLET_2.address,
    });
  });

  it("returns 404 when account is not found", async () => {
    mockClient.request.mockRejectedValue(new Error("actNotFound"));

    const request = getRequest(`/api/accounts/${TEST_WALLET.address}/balances`);
    const response = await GET(
      request,
      routeParams({ address: TEST_WALLET.address }),
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("actNotFound");
  });
});
