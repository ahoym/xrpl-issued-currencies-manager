import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";
import { estimateFillCombined } from "./estimate-fill-combined";
import type { AmmPoolParams } from "./amm-math";
import type { PricedLevel } from "./order-book-levels";

function level(price: number, amount: number): PricedLevel {
  const p = new BigNumber(price);
  const a = new BigNumber(amount);
  return { price: p, amount: a, total: p.times(a), account: "rTest" };
}

function makeAmm(base = 1000, quote = 10000, feePercent = 1): AmmPoolParams {
  return {
    baseReserves: new BigNumber(base),
    quoteReserves: new BigNumber(quote),
    feeRate: new BigNumber(feePercent).div(100),
  };
}

describe("estimateFillCombined", () => {
  describe("edge cases", () => {
    it("returns null for zero amount", () => {
      const result = estimateFillCombined(
        [level(10, 100)],
        new BigNumber(0),
        new BigNumber(10),
        null,
        "buy",
      );
      expect(result).toBeNull();
    });

    it("returns null for NaN amount", () => {
      const result = estimateFillCombined(
        [level(10, 100)],
        new BigNumber(NaN),
        new BigNumber(10),
        null,
        "buy",
      );
      expect(result).toBeNull();
    });

    it("returns null for negative amount", () => {
      const result = estimateFillCombined(
        [level(10, 100)],
        new BigNumber(-5),
        new BigNumber(10),
        null,
        "buy",
      );
      expect(result).toBeNull();
    });

    it("returns null when no CLOB levels and no AMM", () => {
      const result = estimateFillCombined(
        [],
        new BigNumber(10),
        new BigNumber(10),
        null,
        "buy",
      );
      expect(result).toBeNull();
    });
  });

  describe("CLOB-only (null ammPool)", () => {
    it("fills from a single level", () => {
      const result = estimateFillCombined(
        [level(10, 100)],
        new BigNumber(50),
        new BigNumber(10),
        null,
        "buy",
      );
      expect(result).not.toBeNull();
      expect(result!.filledAmount.toFixed(6)).toBe("50.000000");
      expect(result!.avgPrice.toFixed(6)).toBe("10.000000");
      expect(result!.totalCost.toFixed(6)).toBe("500.000000");
      expect(result!.fullFill).toBe(true);
      expect(result!.clobFilled.toFixed(6)).toBe("50.000000");
      expect(result!.ammFilled.toFixed(6)).toBe("0.000000");
    });

    it("walks multiple levels", () => {
      const levels = [level(10, 10), level(11, 20), level(12, 30)];
      const result = estimateFillCombined(
        levels,
        new BigNumber(25),
        new BigNumber(10.5),
        null,
        "buy",
      );
      expect(result).not.toBeNull();
      // 10@10 + 15@11 = 100 + 165 = 265 for 25 units
      expect(result!.filledAmount.toFixed(6)).toBe("25.000000");
      expect(result!.totalCost.toFixed(6)).toBe("265.000000");
      expect(result!.fullFill).toBe(true);
      expect(result!.ammFilled.isZero()).toBe(true);
    });

    it("reports partial fill when insufficient depth", () => {
      const levels = [level(10, 5)];
      const result = estimateFillCombined(
        levels,
        new BigNumber(20),
        new BigNumber(10),
        null,
        "buy",
      );
      expect(result).not.toBeNull();
      expect(result!.filledAmount.toFixed(6)).toBe("5.000000");
      expect(result!.fullFill).toBe(false);
    });
  });

  describe("AMM-only (no CLOB levels)", () => {
    it("fills entirely from AMM on buy side", () => {
      const amm = makeAmm(1000, 10000, 1);
      const result = estimateFillCombined(
        [],
        new BigNumber(10),
        new BigNumber(10),
        amm,
        "buy",
      );
      expect(result).not.toBeNull();
      expect(result!.ammFilled.toFixed(6)).toBe("10.000000");
      expect(result!.clobFilled.isZero()).toBe(true);
      expect(result!.fullFill).toBe(true);
      expect(result!.totalCost.gt(0)).toBe(true);
      // Average price should be slightly above spot (10) due to slippage + fee
      expect(result!.avgPrice.gt(10)).toBe(true);
    });

    it("fills entirely from AMM on sell side", () => {
      const amm = makeAmm(1000, 10000, 1);
      const result = estimateFillCombined(
        [],
        new BigNumber(10),
        new BigNumber(10),
        amm,
        "sell",
      );
      expect(result).not.toBeNull();
      expect(result!.ammFilled.toFixed(6)).toBe("10.000000");
      expect(result!.clobFilled.isZero()).toBe(true);
      expect(result!.fullFill).toBe(true);
      // Average sell price should be slightly below spot due to slippage + fee
      expect(result!.avgPrice.lt(10)).toBe(true);
    });

    it("caps at 99% of reserves for large orders", () => {
      const amm = makeAmm(100, 1000, 0);
      const result = estimateFillCombined(
        [],
        new BigNumber(200), // More than reserves
        new BigNumber(10),
        amm,
        "buy",
      );
      expect(result).not.toBeNull();
      expect(result!.fullFill).toBe(false);
      expect(result!.ammFilled.toFixed()).toBe("99"); // 99% of 100
    });
  });

  describe("interleaving — buy side", () => {
    it("fills from AMM first when AMM is cheaper than CLOB", () => {
      // AMM spot ~ 10, marginal buy ~ 10.10; CLOB level at 12
      // AMM can fill ~82 units before its price reaches 12, so a 120-unit
      // order forces the CLOB to pick up the remainder.
      const amm = makeAmm(1000, 10000, 1);
      const levels = [level(12, 100)];
      const result = estimateFillCombined(
        levels,
        new BigNumber(120),
        new BigNumber(10),
        amm,
        "buy",
      );
      expect(result).not.toBeNull();
      expect(result!.fullFill).toBe(true);
      // AMM should have filled some amount before hitting price 12
      expect(result!.ammFilled.gt(0)).toBe(true);
      // CLOB should have filled the remainder
      expect(result!.clobFilled.gt(0)).toBe(true);
      expect(result!.ammFilled.plus(result!.clobFilled).toFixed(6)).toBe(
        "120.000000",
      );
    });

    it("fills from CLOB first when CLOB is cheaper than AMM", () => {
      // AMM marginal buy ~ 10.10; CLOB has a level at 9
      const amm = makeAmm(1000, 10000, 1);
      const levels = [level(9, 20), level(12, 100)];
      const result = estimateFillCombined(
        levels,
        new BigNumber(50),
        new BigNumber(10),
        amm,
        "buy",
      );
      expect(result).not.toBeNull();
      expect(result!.fullFill).toBe(true);
      // The 9-priced CLOB level should be consumed first (cheaper than AMM)
      expect(result!.clobFilled.gte(20)).toBe(true);
      expect(result!.ammFilled.plus(result!.clobFilled).toFixed(6)).toBe(
        "50.000000",
      );
    });

    it("alternates between AMM and CLOB across multiple levels", () => {
      // AMM spot ~ 10 (marginal buy ~ 10.10)
      // CLOB: 10.05 (cheaper than AMM), 10.50, 15.00
      // Expected: CLOB@10.05 -> AMM fills up to ~10.50 -> CLOB@10.50 -> AMM fills up to 15 -> CLOB@15
      const amm = makeAmm(1000, 10000, 1);
      const levels = [level(10.05, 5), level(10.5, 10), level(15, 100)];
      const result = estimateFillCombined(
        levels,
        new BigNumber(30),
        new BigNumber(10),
        amm,
        "buy",
      );
      expect(result).not.toBeNull();
      expect(result!.fullFill).toBe(true);
      expect(result!.ammFilled.gt(0)).toBe(true);
      expect(result!.clobFilled.gt(0)).toBe(true);
    });
  });

  describe("interleaving — sell side", () => {
    it("fills from AMM first when AMM offers higher sell price", () => {
      // AMM marginal sell ~ 9.90; CLOB bid at 8
      // AMM can sell ~113 units before its price drops to 8, so a 150-unit
      // order forces the CLOB to absorb the rest.
      const amm = makeAmm(1000, 10000, 1);
      const levels = [level(8, 100)]; // bids sorted descending
      const result = estimateFillCombined(
        levels,
        new BigNumber(150),
        new BigNumber(10),
        amm,
        "sell",
      );
      expect(result).not.toBeNull();
      expect(result!.fullFill).toBe(true);
      expect(result!.ammFilled.gt(0)).toBe(true);
      expect(result!.clobFilled.gt(0)).toBe(true);
    });

    it("fills from CLOB first when CLOB offers higher sell price", () => {
      // AMM marginal sell ~ 9.90; CLOB bid at 11 (better than AMM)
      const amm = makeAmm(1000, 10000, 1);
      const levels = [level(11, 20), level(8, 100)];
      const result = estimateFillCombined(
        levels,
        new BigNumber(50),
        new BigNumber(10),
        amm,
        "sell",
      );
      expect(result).not.toBeNull();
      expect(result!.fullFill).toBe(true);
      // The 11-priced bid should be consumed first
      expect(result!.clobFilled.gte(20)).toBe(true);
    });
  });

  describe("partial fill from combined sources", () => {
    it("reports partial fill when both sources are insufficient", () => {
      // AMM with tiny reserves + small CLOB
      const amm = makeAmm(10, 100, 1);
      const levels = [level(12, 5)];
      const result = estimateFillCombined(
        levels,
        new BigNumber(100),
        new BigNumber(10),
        amm,
        "buy",
      );
      expect(result).not.toBeNull();
      expect(result!.fullFill).toBe(false);
      expect(result!.ammFilled.gt(0)).toBe(true);
      expect(result!.clobFilled.gt(0)).toBe(true);
      expect(result!.filledAmount.lt(100)).toBe(true);
    });
  });

  describe("slippage", () => {
    it("calculates slippage from combined average price", () => {
      const amm = makeAmm(1000, 10000, 1);
      const levels = [level(12, 50)];
      const midPrice = new BigNumber(10);
      const result = estimateFillCombined(
        levels,
        new BigNumber(50),
        midPrice,
        amm,
        "buy",
      );
      expect(result).not.toBeNull();
      expect(result!.slippage).not.toBeNull();
      expect(result!.slippage!.gt(0)).toBe(true);
    });

    it("returns null slippage when midPrice is null", () => {
      const result = estimateFillCombined(
        [level(10, 100)],
        new BigNumber(50),
        null,
        null,
        "buy",
      );
      expect(result).not.toBeNull();
      expect(result!.slippage).toBeNull();
    });

    it("returns null slippage when midPrice is zero", () => {
      const result = estimateFillCombined(
        [level(10, 100)],
        new BigNumber(50),
        new BigNumber(0),
        null,
        "buy",
      );
      expect(result).not.toBeNull();
      expect(result!.slippage).toBeNull();
    });
  });
});
