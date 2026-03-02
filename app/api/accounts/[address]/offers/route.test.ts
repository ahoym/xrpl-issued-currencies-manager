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

describe("GET /api/accounts/[address]/offers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid address", async () => {
    const request = getRequest("/api/accounts/invalid/offers");
    const response = await GET(request, routeParams({ address: "invalid" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Invalid");
  });

  it("returns offers on success", async () => {
    mockClient.request.mockResolvedValue({
      result: {
        offers: [
          {
            seq: 1,
            flags: 0,
            taker_gets: "50000000",
            taker_pays: {
              currency: "USD",
              issuer: TEST_WALLET_2.address,
              value: "25",
            },
            quality: "0.0000005",
          },
        ],
      },
    });

    const request = getRequest(`/api/accounts/${TEST_WALLET.address}/offers`);
    const response = await GET(
      request,
      routeParams({ address: TEST_WALLET.address }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.address).toBe(TEST_WALLET.address);
    expect(body.offers).toHaveLength(1);
    // taker_gets was a drops string -> converted to XRP DexAmount
    expect(body.offers[0].taker_gets).toEqual({
      currency: "XRP",
      value: "50",
    });
    // taker_pays was an issued currency object -> decoded
    expect(body.offers[0].taker_pays).toEqual({
      currency: "USD",
      issuer: TEST_WALLET_2.address,
      value: "25",
    });
  });

  it("returns 400 for empty marker", async () => {
    const request = getRequest(`/api/accounts/${TEST_WALLET.address}/offers`, {
      marker: "",
    });
    const response = await GET(
      request,
      routeParams({ address: TEST_WALLET.address }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("marker");
  });

  it("returns 400 for marker exceeding 256 characters", async () => {
    const longMarker = "A".repeat(257);
    const request = getRequest(`/api/accounts/${TEST_WALLET.address}/offers`, {
      marker: longMarker,
    });
    const response = await GET(
      request,
      routeParams({ address: TEST_WALLET.address }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("marker");
  });

  it("includes marker in response when present", async () => {
    const nextMarker = "SOMEMARKERVALUE";
    mockClient.request.mockResolvedValue({
      result: {
        offers: [],
        marker: nextMarker,
      },
    });

    const request = getRequest(`/api/accounts/${TEST_WALLET.address}/offers`);
    const response = await GET(
      request,
      routeParams({ address: TEST_WALLET.address }),
    );
    const body = await response.json();
    expect(body.marker).toBe(nextMarker);
  });

  it("includes domainID when present on offer", async () => {
    const domainID = "A".repeat(64);
    mockClient.request.mockResolvedValue({
      result: {
        offers: [
          {
            seq: 2,
            flags: 0,
            taker_gets: "10000000",
            taker_pays: {
              currency: "USD",
              issuer: TEST_WALLET_2.address,
              value: "5",
            },
            quality: "0.0000005",
            DomainID: domainID,
          },
        ],
      },
    });

    const request = getRequest(`/api/accounts/${TEST_WALLET.address}/offers`);
    const response = await GET(
      request,
      routeParams({ address: TEST_WALLET.address }),
    );
    const body = await response.json();
    expect(body.offers[0].domainID).toBe(domainID);
  });

  it("returns 404 when account is not found", async () => {
    mockClient.request.mockRejectedValue(new Error("actNotFound"));

    const request = getRequest(`/api/accounts/${TEST_WALLET.address}/offers`);
    const response = await GET(
      request,
      routeParams({ address: TEST_WALLET.address }),
    );
    expect(response.status).toBe(404);
  });
});
