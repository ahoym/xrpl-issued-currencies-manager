import { describe, it, expect, vi } from "vitest";
import { parseFilledOrders } from "./filled-orders";

// We need to mock getBalanceChanges from xrpl since it processes real metadata
vi.mock("xrpl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("xrpl")>();
  return {
    ...actual,
    getBalanceChanges: vi.fn(),
  };
});

import { getBalanceChanges } from "xrpl";
const mockGetBalanceChanges = vi.mocked(getBalanceChanges);

const WALLET = "rWalletAddress1234567890123456";
const ISSUER = "rIssuerAddress1234567890123456";

function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    tx_json: {
      TransactionType: "OfferCreate",
      Account: WALLET,
      TakerPays: { currency: "USD", issuer: ISSUER, value: "100" },
      TakerGets: "10000000", // 10 XRP in drops
      Fee: "12",
      ...overrides,
    },
    meta: {
      TransactionResult: "tesSUCCESS",
      AffectedNodes: [],
    },
    close_time_iso: "2024-01-01T00:00:00Z",
    hash: "ABC123",
  };
}

describe("parseFilledOrders", () => {
  it("returns empty array for no transactions", () => {
    const result = parseFilledOrders([], WALLET, "XRP", undefined, "USD", ISSUER, 10);
    expect(result).toEqual([]);
  });

  it("skips non-OfferCreate transactions", () => {
    mockGetBalanceChanges.mockReturnValue([]);
    const tx = makeTx({ TransactionType: "Payment" });
    const result = parseFilledOrders([tx], WALLET, "XRP", undefined, "USD", ISSUER, 10);
    expect(result).toEqual([]);
  });

  it("skips failed transactions", () => {
    mockGetBalanceChanges.mockReturnValue([]);
    const tx = makeTx();
    tx.meta.TransactionResult = "tecUNFUNDED";
    const result = parseFilledOrders([tx], WALLET, "XRP", undefined, "USD", ISSUER, 10);
    expect(result).toEqual([]);
  });

  it("skips transactions from other accounts", () => {
    mockGetBalanceChanges.mockReturnValue([]);
    const tx = makeTx({ Account: "rOtherAccount123456789012345" });
    const result = parseFilledOrders([tx], WALLET, "XRP", undefined, "USD", ISSUER, 10);
    expect(result).toEqual([]);
  });

  it("parses a buy fill (TakerPays = base currency)", () => {
    mockGetBalanceChanges.mockReturnValue([
      {
        account: WALLET,
        balances: [
          { currency: "XRP", value: "10" },
          { currency: "USD", issuer: ISSUER, value: "100" },
        ],
      },
    ]);

    // TakerPays = XRP (base), so this is a buy of XRP
    const tx = makeTx({
      TakerPays: "10000000", // XRP
      TakerGets: { currency: "USD", issuer: ISSUER, value: "100" },
      Fee: "12",
    });

    const result = parseFilledOrders(
      [tx],
      WALLET,
      "XRP",
      undefined,
      "USD",
      ISSUER,
      10,
    );

    expect(result).toHaveLength(1);
    expect(result[0].side).toBe("buy");
    expect(parseFloat(result[0].baseAmount)).toBeGreaterThan(0);
    expect(parseFloat(result[0].quoteAmount)).toBeGreaterThan(0);
    expect(parseFloat(result[0].price)).toBeGreaterThan(0);
    expect(result[0].time).toBe("2024-01-01T00:00:00Z");
    expect(result[0].hash).toBe("ABC123");
  });

  it("parses a sell fill (TakerPays != base currency)", () => {
    mockGetBalanceChanges.mockReturnValue([
      {
        account: WALLET,
        balances: [
          { currency: "USD", issuer: ISSUER, value: "100" },
          { currency: "XRP", value: "10" },
        ],
      },
    ]);

    // TakerPays = USD (not base=XRP), so this is a sell of XRP
    const tx = makeTx({
      TakerPays: { currency: "USD", issuer: ISSUER, value: "100" },
      TakerGets: "10000000",
      Fee: "12",
    });

    const result = parseFilledOrders(
      [tx],
      WALLET,
      "XRP",
      undefined,
      "USD",
      ISSUER,
      10,
    );

    expect(result).toHaveLength(1);
    expect(result[0].side).toBe("sell");
  });

  it("skips issuer accounts to avoid double-counting", () => {
    mockGetBalanceChanges.mockReturnValue([
      {
        account: ISSUER,
        balances: [
          { currency: "USD", issuer: ISSUER, value: "100" },
        ],
      },
    ]);

    const tx = makeTx();
    const result = parseFilledOrders([tx], WALLET, "XRP", undefined, "USD", ISSUER, 10);
    expect(result).toEqual([]);
  });

  it("skips when only one side has balance changes (unfilled resting order)", () => {
    mockGetBalanceChanges.mockReturnValue([
      {
        account: WALLET,
        balances: [
          { currency: "XRP", value: "0.000012" }, // just the fee
        ],
      },
    ]);

    const tx = makeTx();
    const result = parseFilledOrders([tx], WALLET, "XRP", undefined, "USD", ISSUER, 10);
    expect(result).toEqual([]);
  });

  it("respects the limit parameter", () => {
    mockGetBalanceChanges.mockReturnValue([
      {
        account: WALLET,
        balances: [
          { currency: "XRP", value: "10" },
          { currency: "USD", issuer: ISSUER, value: "100" },
        ],
      },
    ]);

    const txs = Array.from({ length: 5 }, () => makeTx());
    const result = parseFilledOrders(txs, WALLET, "XRP", undefined, "USD", ISSUER, 2);
    expect(result).toHaveLength(2);
  });

  it("subtracts fee from XRP amounts for submitter", () => {
    const fee = 12; // 12 drops = 0.000012 XRP
    mockGetBalanceChanges.mockReturnValue([
      {
        account: WALLET,
        balances: [
          { currency: "XRP", value: "10.000012" }, // balance change includes fee refund
          { currency: "USD", issuer: ISSUER, value: "100" },
        ],
      },
    ]);

    const tx = makeTx({ Fee: String(fee) });
    const result = parseFilledOrders([tx], WALLET, "XRP", undefined, "USD", ISSUER, 10);

    expect(result).toHaveLength(1);
    // The fee should have been subtracted from the XRP amount
    expect(parseFloat(result[0].baseAmount)).toBeCloseTo(10, 4);
  });

  it("handles missing tx_json or meta gracefully", () => {
    mockGetBalanceChanges.mockReturnValue([]);
    const entries = [
      { meta: { TransactionResult: "tesSUCCESS" } }, // no tx_json
      { tx_json: { TransactionType: "OfferCreate" } }, // no meta
      {}, // neither
    ];
    const result = parseFilledOrders(
      entries,
      WALLET,
      "XRP",
      undefined,
      "USD",
      ISSUER,
      10,
    );
    expect(result).toEqual([]);
  });

  it("uses entry.date as fallback when close_time_iso is missing", () => {
    mockGetBalanceChanges.mockReturnValue([
      {
        account: WALLET,
        balances: [
          { currency: "XRP", value: "10" },
          { currency: "USD", issuer: ISSUER, value: "100" },
        ],
      },
    ]);

    const tx = makeTx();
    delete (tx as Record<string, unknown>).close_time_iso;
    (tx as Record<string, unknown>).date = "2024-06-15T12:00:00Z";

    const result = parseFilledOrders([tx], WALLET, "XRP", undefined, "USD", ISSUER, 10);
    expect(result[0].time).toBe("2024-06-15T12:00:00Z");
  });
});
