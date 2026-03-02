import { vi, describe, it, expect, beforeEach } from "vitest";
import { getRequest, TEST_WALLET } from "@/lib/test-helpers";

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

// Mock the xrpl Client constructor (used for mainnet fallback path)
vi.mock("xrpl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("xrpl")>();
  return { ...actual, Client: vi.fn() };
});

import { GET } from "./route";

const baseParams = {
  base_currency: "USD",
  base_issuer: TEST_WALLET.address,
  quote_currency: "XRP",
};

describe("GET /api/dex/orderbook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  it("returns 400 when base_currency is missing", async () => {
    const res = await GET(
      getRequest("/api/dex/orderbook", { quote_currency: "XRP" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/base_currency/);
  });

  it("returns 400 when quote_currency is missing", async () => {
    const res = await GET(
      getRequest("/api/dex/orderbook", {
        base_currency: "USD",
        base_issuer: TEST_WALLET.address,
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/quote_currency/);
  });

  it("returns 400 for non-XRP base without base_issuer", async () => {
    const res = await GET(
      getRequest("/api/dex/orderbook", {
        base_currency: "USD",
        quote_currency: "XRP",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/base_issuer is required/);
  });

  it("returns 400 for invalid domain ID format", async () => {
    const res = await GET(
      getRequest("/api/dex/orderbook", {
        ...baseParams,
        domain: "not-a-valid-hex",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid domain ID format/);
  });

  // ---------------------------------------------------------------------------
  // Success (non-mainnet, open DEX path using getOrderbook)
  // ---------------------------------------------------------------------------

  it("returns order book data on success", async () => {
    mockClient.getOrderbook.mockResolvedValueOnce({
      buy: [],
      sell: [],
    });

    const res = await GET(getRequest("/api/dex/orderbook", baseParams));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.base).toEqual({
      currency: "USD",
      issuer: TEST_WALLET.address,
    });
    expect(body.quote).toEqual({ currency: "XRP", issuer: undefined });
    expect(body.buy).toEqual([]);
    expect(body.sell).toEqual([]);
    expect(body).toHaveProperty("depth");
    expect(body).toHaveProperty("midprice");
  });

  it("calls getOrderbook with correct currencies", async () => {
    mockClient.getOrderbook.mockResolvedValueOnce({ buy: [], sell: [] });

    await GET(getRequest("/api/dex/orderbook", baseParams));

    expect(mockClient.getOrderbook).toHaveBeenCalledWith(
      expect.objectContaining({ currency: expect.any(String) }),
      { currency: "XRP" },
      expect.objectContaining({ limit: expect.any(Number) }),
    );
  });

  // ---------------------------------------------------------------------------
  // Permissioned DEX (domain path using raw book_offers)
  // ---------------------------------------------------------------------------

  it("returns order book data via book_offers when domain is provided", async () => {
    const validDomain = "A".repeat(64);
    mockClient.request.mockResolvedValue({
      result: { offers: [] },
    });

    const res = await GET(
      getRequest("/api/dex/orderbook", {
        ...baseParams,
        domain: validDomain,
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.domain).toBe(validDomain);
    expect(body.buy).toEqual([]);
    expect(body.sell).toEqual([]);
  });
});
