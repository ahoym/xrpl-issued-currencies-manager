import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";
import { computeMidpriceMetrics } from "./midprice";
import type { PricedLevel } from "./order-book-levels";

function level(price: number, amount: number): PricedLevel {
  const p = new BigNumber(price);
  const a = new BigNumber(amount);
  return { price: p, amount: a, total: p.times(a), account: "rTest" };
}

describe("computeMidpriceMetrics", () => {
  it("returns all null for empty book", () => {
    const result = computeMidpriceMetrics([], []);
    expect(result).toEqual({
      mid: null,
      microPrice: null,
      weightedMid: null,
      spread: null,
      spreadBps: null,
    });
  });

  it("returns null mid/spread with only asks (no bids)", () => {
    const asks = [level(1.1, 50), level(1.0, 100)]; // descending
    const result = computeMidpriceMetrics(asks, []);
    expect(result.mid).toBeNull();
    expect(result.spread).toBeNull();
    expect(result.spreadBps).toBeNull();
    expect(result.microPrice).toBeNull();
    // weightedMid still computable from asks alone
    expect(result.weightedMid).not.toBeNull();
  });

  it("returns null mid/spread with only bids (no asks)", () => {
    const bids = [level(0.9, 100), level(0.8, 50)]; // descending
    const result = computeMidpriceMetrics([], bids);
    expect(result.mid).toBeNull();
    expect(result.spread).toBeNull();
    expect(result.microPrice).toBeNull();
    expect(result.weightedMid).not.toBeNull();
  });

  it("computes all metrics when both sides present", () => {
    // Asks descending: best ask = last = 1.02
    const asks = [level(1.04, 30), level(1.02, 50)];
    // Bids descending: best bid = first = 0.98
    const bids = [level(0.98, 50), level(0.96, 30)];

    const result = computeMidpriceMetrics(asks, bids);

    // mid = (1.02 + 0.98) / 2 = 1.0
    expect(result.mid).toBe("1");

    // spread = 1.02 - 0.98 = 0.04
    expect(result.spread).toBe("0.04");

    // spreadBps = 0.04 / 1.0 * 10000 = 400
    expect(result.spreadBps).toBe("400");

    // microPrice = (0.98 * 50 + 1.02 * 50) / (50 + 50) = 100/100 = 1.0
    // (equal volumes → micro = simple mid)
    expect(result.microPrice).toBe("1");

    expect(result.weightedMid).not.toBeNull();
  });

  it("micro-price differs from simple mid with uneven volumes", () => {
    // Best ask = 1.02 with volume 10
    const asks = [level(1.02, 10)];
    // Best bid = 0.98 with volume 90
    const bids = [level(0.98, 90)];

    const result = computeMidpriceMetrics(asks, bids);

    // mid = (1.02 + 0.98) / 2 = 1.0
    expect(result.mid).toBe("1");

    // microPrice = (0.98 * 10 + 1.02 * 90) / (90 + 10)
    //            = (9.8 + 91.8) / 100 = 101.6 / 100 = 1.016
    // Skewed toward the ask because bid side has more volume
    expect(new BigNumber(result.microPrice!).toFixed(3)).toBe("1.016");
    expect(result.microPrice).not.toBe(result.mid);
  });

  it("weighted mid reflects volume distribution across levels", () => {
    // Large volume at lower ask, small at higher
    const asks = [level(1.1, 5), level(1.02, 100)];
    // Large volume at higher bid, small at lower
    const bids = [level(0.98, 100), level(0.9, 5)];

    const result = computeMidpriceMetrics(asks, bids);

    // Weighted mid should be close to the simple mid since volume
    // concentrates near best ask/bid
    const wm = new BigNumber(result.weightedMid!);
    const mid = new BigNumber(result.mid!);
    expect(wm.minus(mid).abs().lt(0.02)).toBe(true);
  });

  it("serializes all values as strings", () => {
    const asks = [level(1.05, 100)];
    const bids = [level(0.95, 100)];
    const result = computeMidpriceMetrics(asks, bids);

    for (const key of [
      "mid",
      "microPrice",
      "weightedMid",
      "spread",
      "spreadBps",
    ] as const) {
      expect(typeof result[key]).toBe("string");
    }
  });
});
