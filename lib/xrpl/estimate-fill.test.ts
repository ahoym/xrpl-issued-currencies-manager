import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";
import { estimateFill } from "./estimate-fill";
import type { PricedLevel } from "./order-book-levels";

function level(price: number, amount: number): PricedLevel {
  const p = new BigNumber(price);
  const a = new BigNumber(amount);
  return { price: p, amount: a, total: p.times(a), account: "rTest" };
}

describe("estimateFill", () => {
  it("returns null for empty levels", () => {
    expect(estimateFill([], new BigNumber(10), new BigNumber(1))).toBeNull();
  });

  it("returns null for zero amount", () => {
    const levels = [level(1.0, 100)];
    expect(estimateFill(levels, new BigNumber(0), new BigNumber(1))).toBeNull();
  });

  it("returns null for NaN amount", () => {
    const levels = [level(1.0, 100)];
    expect(estimateFill(levels, new BigNumber(NaN), new BigNumber(1))).toBeNull();
  });

  it("returns null for negative amount", () => {
    const levels = [level(1.0, 100)];
    expect(estimateFill(levels, new BigNumber(-5), new BigNumber(1))).toBeNull();
  });

  it("fills exactly from a single level", () => {
    const levels = [level(1.5, 100)];
    const result = estimateFill(levels, new BigNumber(100), new BigNumber(1.5));

    expect(result).not.toBeNull();
    expect(result!.avgPrice.toFixed(6)).toBe("1.500000");
    expect(result!.worstPrice.toFixed(6)).toBe("1.500000");
    expect(result!.filledAmount.toFixed(6)).toBe("100.000000");
    expect(result!.totalCost.toFixed(6)).toBe("150.000000");
    expect(result!.fullFill).toBe(true);
    expect(result!.slippage!.toFixed(4)).toBe("0.0000");
  });

  it("fills partially from a single level", () => {
    const levels = [level(2.0, 50)];
    const result = estimateFill(levels, new BigNumber(30), new BigNumber(2.0));

    expect(result).not.toBeNull();
    expect(result!.avgPrice.toFixed(6)).toBe("2.000000");
    expect(result!.filledAmount.toFixed(6)).toBe("30.000000");
    expect(result!.totalCost.toFixed(6)).toBe("60.000000");
    expect(result!.fullFill).toBe(true);
  });

  it("walks multiple levels for a large order", () => {
    // Best ask first (ascending for buys)
    const levels = [level(1.0, 10), level(1.1, 20), level(1.2, 30)];
    const result = estimateFill(levels, new BigNumber(25), new BigNumber(1.05));

    expect(result).not.toBeNull();
    // Fills 10 @ 1.0 + 15 @ 1.1 = 10 + 16.5 = 26.5 total for 25 units
    const expectedAvg = new BigNumber(26.5).div(25);
    expect(result!.avgPrice.toFixed(6)).toBe(expectedAvg.toFixed(6));
    expect(result!.worstPrice.toFixed(6)).toBe("1.100000");
    expect(result!.filledAmount.toFixed(6)).toBe("25.000000");
    expect(result!.totalCost.toFixed(6)).toBe("26.500000");
    expect(result!.fullFill).toBe(true);
  });

  it("reports partial fill when insufficient depth", () => {
    const levels = [level(1.0, 10), level(1.1, 5)];
    const result = estimateFill(levels, new BigNumber(20), new BigNumber(1.05));

    expect(result).not.toBeNull();
    // Fills 10 @ 1.0 + 5 @ 1.1 = 10 + 5.5 = 15.5 total for 15 units
    expect(result!.filledAmount.toFixed(6)).toBe("15.000000");
    expect(result!.totalCost.toFixed(6)).toBe("15.500000");
    expect(result!.fullFill).toBe(false);
    expect(result!.worstPrice.toFixed(6)).toBe("1.100000");
  });

  it("calculates slippage correctly", () => {
    const levels = [level(1.0, 10), level(1.2, 10)];
    const midPrice = new BigNumber(0.95);
    const result = estimateFill(levels, new BigNumber(20), midPrice);

    expect(result).not.toBeNull();
    // avg = (10*1.0 + 10*1.2) / 20 = 22/20 = 1.1
    // slippage = |1.1 - 0.95| / 0.95 * 100 = 15.789...%
    const expectedSlippage = new BigNumber(1.1).minus(0.95).div(0.95).times(100);
    expect(result!.slippage!.toFixed(4)).toBe(expectedSlippage.toFixed(4));
  });

  it("returns null slippage when midPrice is null", () => {
    const levels = [level(1.0, 100)];
    const result = estimateFill(levels, new BigNumber(50), null);

    expect(result).not.toBeNull();
    expect(result!.slippage).toBeNull();
  });

  it("returns null slippage when midPrice is zero", () => {
    const levels = [level(1.0, 100)];
    const result = estimateFill(levels, new BigNumber(50), new BigNumber(0));

    expect(result).not.toBeNull();
    expect(result!.slippage).toBeNull();
  });

  it("maintains BigNumber precision with small fractional values", () => {
    const levels = [level(0.000001, 1000000), level(0.000002, 500000)];
    const result = estimateFill(levels, new BigNumber(1200000), new BigNumber(0.0000015));

    expect(result).not.toBeNull();
    // 1000000 @ 0.000001 + 200000 @ 0.000002 = 1 + 0.4 = 1.4
    expect(result!.totalCost.toFixed(10)).toBe("1.4000000000");
    expect(result!.filledAmount.toFixed(0)).toBe("1200000");
    expect(result!.fullFill).toBe(true);
  });

  it("handles a single level that is smaller than the order", () => {
    const levels = [level(5.0, 3)];
    const result = estimateFill(levels, new BigNumber(10), new BigNumber(5));

    expect(result).not.toBeNull();
    expect(result!.filledAmount.toFixed(6)).toBe("3.000000");
    expect(result!.totalCost.toFixed(6)).toBe("15.000000");
    expect(result!.fullFill).toBe(false);
  });
});
