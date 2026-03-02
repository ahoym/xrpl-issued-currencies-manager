import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  getRequest,
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

import { GET } from "./route";

const baseParams = {
  base_currency: "USD",
  base_issuer: TEST_WALLET.address,
  quote_currency: "XRP" };

/** Build a mock amm_info response. Amount order matches base/quote. */
function mockAmmInfoResponse() {
  return {
    result: {
      amm: {
        account: "rAMMAccountXXXXXXXXXXXXXXXXXXX",
        amount: {
          currency: "5553440000000000000000000000000000000000",
          issuer: TEST_WALLET.address,
          value: "1000" },
        amount2: "500000000", // 500 XRP in drops
        lp_token: {
          currency: "03A16F2CC3E89C24E0E11DBFC02246A9EFE3B54B",
          issuer: "rAMMAccountXXXXXXXXXXXXXXXXXXX",
          value: "707.107" },
        trading_fee: 500 } } };
}

describe("GET /api/amm/info", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  it("returns 400 when base_currency is missing", async () => {
    const res = await GET(
      getRequest("/api/amm/info", { quote_currency: "XRP" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/base_currency/);
  });

  it("returns 400 when quote_currency is missing", async () => {
    const res = await GET(
      getRequest("/api/amm/info", {
        base_currency: "USD",
        base_issuer: TEST_WALLET.address }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/quote_currency/);
  });

  it("returns 400 for non-XRP base without base_issuer", async () => {
    const res = await GET(
      getRequest("/api/amm/info", {
        base_currency: "USD",
        quote_currency: "XRP" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/base_issuer is required/);
  });

  // ---------------------------------------------------------------------------
  // Success
  // ---------------------------------------------------------------------------

  it("returns pool info on success", async () => {
    mockClient.request.mockResolvedValueOnce(mockAmmInfoResponse());

    const res = await GET(getRequest("/api/amm/info", baseParams));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.exists).toBe(true);
    expect(body.account).toBeDefined();
    expect(body.asset1).toBeDefined();
    expect(body.asset2).toBeDefined();
    expect(body.lpToken).toBeDefined();
    expect(body.tradingFee).toBe(500);
    expect(body.tradingFeeDisplay).toBeDefined();
    expect(body.spotPrice).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // AMM not found
  // ---------------------------------------------------------------------------

  it("returns { exists: false } when actNotFound error", async () => {
    mockClient.request.mockRejectedValueOnce(new Error("actNotFound"));

    const res = await GET(getRequest("/api/amm/info", baseParams));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.exists).toBe(false);
  });

  it("returns { exists: false } when ammNotFound error", async () => {
    mockClient.request.mockRejectedValueOnce(new Error("ammNotFound"));

    const res = await GET(getRequest("/api/amm/info", baseParams));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.exists).toBe(false);
  });

  it("returns { exists: false } when Account not found error", async () => {
    mockClient.request.mockRejectedValueOnce(
      new Error("Account not found"),
    );

    const res = await GET(getRequest("/api/amm/info", baseParams));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.exists).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  it("returns 500 on unexpected error", async () => {
    mockClient.request.mockRejectedValueOnce(new Error("connection lost"));

    const res = await GET(getRequest("/api/amm/info", baseParams));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/connection lost/);
  });
});
