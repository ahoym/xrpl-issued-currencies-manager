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

describe("GET /api/dex/trades", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  it("returns 400 when base_currency is missing", async () => {
    const res = await GET(
      getRequest("/api/dex/trades", { quote_currency: "XRP" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/base_currency/);
  });

  it("returns 400 when quote_currency is missing", async () => {
    const res = await GET(
      getRequest("/api/dex/trades", {
        base_currency: "USD",
        base_issuer: TEST_WALLET.address }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/quote_currency/);
  });

  it("returns 400 for non-XRP base without base_issuer", async () => {
    const res = await GET(
      getRequest("/api/dex/trades", {
        base_currency: "USD",
        quote_currency: "XRP" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/base_issuer is required/);
  });

  it("returns 400 for non-XRP quote without quote_issuer", async () => {
    const res = await GET(
      getRequest("/api/dex/trades", {
        base_currency: "XRP",
        quote_currency: "EUR" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/quote_issuer is required/);
  });

  // ---------------------------------------------------------------------------
  // Success
  // ---------------------------------------------------------------------------

  it("returns trades array on success (empty transactions)", async () => {
    mockClient.request.mockResolvedValueOnce({
      result: { transactions: [] } });

    const res = await GET(getRequest("/api/dex/trades", baseParams));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.base).toEqual({
      currency: "USD",
      issuer: TEST_WALLET.address });
    expect(body.quote).toEqual({ currency: "XRP", issuer: undefined });
    expect(body.trades).toEqual([]);
  });

  it("calls account_tx with issuer account and multiplied limit", async () => {
    mockClient.request.mockResolvedValueOnce({
      result: { transactions: [] } });

    await GET(getRequest("/api/dex/trades", baseParams));

    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "account_tx",
        account: TEST_WALLET.address,
        limit: expect.any(Number) }),
    );
  });

  it("respects custom limit query param", async () => {
    mockClient.request.mockResolvedValueOnce({
      result: { transactions: [] } });

    await GET(getRequest("/api/dex/trades", { ...baseParams, limit: "5" }));

    // limit * TRADES_FETCH_MULTIPLIER = 5 * 5 = 25
    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 25 }),
    );
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  it("returns 500 on unexpected error", async () => {
    mockClient.request.mockRejectedValueOnce(new Error("connection lost"));

    const res = await GET(getRequest("/api/dex/trades", baseParams));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/connection lost/);
  });
});
