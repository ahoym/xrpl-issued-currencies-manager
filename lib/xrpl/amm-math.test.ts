import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";
import type { AmmPoolInfo } from "@/lib/types";
import {
  buildAmmPoolParams,
  ammMarginalBuyPrice,
  ammMarginalSellPrice,
  ammMaxBuyBeforePrice,
  ammMaxSellBeforePrice,
  ammBuyCost,
  ammSellProceeds,
  type AmmPoolParams,
} from "./amm-math";

function makePool(overrides: Partial<AmmPoolInfo> = {}): AmmPoolInfo {
  return {
    exists: true,
    asset1: { currency: "USD", value: "1000" },
    asset2: { currency: "XRP", value: "10000" },
    lpToken: { currency: "LP", issuer: "rIssuer", value: "1000" },
    tradingFee: 1000, // 1%
    spotPrice: "10",
    ...overrides,
  };
}

function makeParams(base = 1000, quote = 10000, feePercent = 1): AmmPoolParams {
  return {
    baseReserves: new BigNumber(base),
    quoteReserves: new BigNumber(quote),
    feeRate: new BigNumber(feePercent).div(100),
  };
}

describe("buildAmmPoolParams", () => {
  it("returns null for null/undefined pool", () => {
    expect(buildAmmPoolParams(null)).toBeNull();
    expect(buildAmmPoolParams(undefined)).toBeNull();
  });

  it("returns null for non-existent pool", () => {
    expect(buildAmmPoolParams(makePool({ exists: false }))).toBeNull();
  });

  it("returns null for frozen base asset", () => {
    expect(buildAmmPoolParams(makePool({ assetFrozen: true }))).toBeNull();
  });

  it("returns null for frozen quote asset", () => {
    expect(buildAmmPoolParams(makePool({ asset2Frozen: true }))).toBeNull();
  });

  it("returns null for zero base reserves", () => {
    expect(
      buildAmmPoolParams(makePool({ asset1: { currency: "USD", value: "0" } })),
    ).toBeNull();
  });

  it("returns null for zero quote reserves", () => {
    expect(
      buildAmmPoolParams(makePool({ asset2: { currency: "XRP", value: "0" } })),
    ).toBeNull();
  });

  it("returns correct params for a valid pool", () => {
    const result = buildAmmPoolParams(makePool());
    expect(result).not.toBeNull();
    expect(result!.baseReserves.toFixed()).toBe("1000");
    expect(result!.quoteReserves.toFixed()).toBe("10000");
    expect(result!.feeRate.toFixed(4)).toBe("0.0100");
  });
});

describe("ammMarginalBuyPrice", () => {
  const pool = makeParams();
  // spotPrice = Q/B = 10, marginal buy at consumed=0 = spotPrice/(1-f) = 10/0.99

  it("equals spotPrice/(1-f) at consumed=0", () => {
    const price = ammMarginalBuyPrice(pool, new BigNumber(0));
    const expected = new BigNumber(10).div(0.99);
    expect(price.toFixed(10)).toBe(expected.toFixed(10));
  });

  it("increases as more base is consumed", () => {
    const p0 = ammMarginalBuyPrice(pool, new BigNumber(0));
    const p1 = ammMarginalBuyPrice(pool, new BigNumber(100));
    const p2 = ammMarginalBuyPrice(pool, new BigNumber(500));
    expect(p1.gt(p0)).toBe(true);
    expect(p2.gt(p1)).toBe(true);
  });
});

describe("ammMarginalSellPrice", () => {
  const pool = makeParams();
  // spotPrice = Q/B = 10, marginal sell at consumed=0 = spotPrice*(1-f) = 10*0.99

  it("equals spotPrice*(1-f) at consumed=0", () => {
    const price = ammMarginalSellPrice(pool, new BigNumber(0));
    const expected = new BigNumber(10).times(0.99);
    expect(price.toFixed(10)).toBe(expected.toFixed(10));
  });

  it("decreases as more base is sold", () => {
    const p0 = ammMarginalSellPrice(pool, new BigNumber(0));
    const p1 = ammMarginalSellPrice(pool, new BigNumber(100));
    const p2 = ammMarginalSellPrice(pool, new BigNumber(500));
    expect(p1.lt(p0)).toBe(true);
    expect(p2.lt(p1)).toBe(true);
  });
});

describe("ammMaxBuyBeforePrice", () => {
  const pool = makeParams();

  it("returns 0 when AMM marginal price already exceeds limit", () => {
    // Marginal buy price at consumed=0 ~ 10.10, so a limit of 9 is already past
    const result = ammMaxBuyBeforePrice(pool, new BigNumber(9));
    expect(result.toFixed()).toBe("0");
  });

  it("returns correct amount for a limit above current price", () => {
    const limit = new BigNumber(15);
    const maxBuy = ammMaxBuyBeforePrice(pool, limit);
    expect(maxBuy.gt(0)).toBe(true);
    expect(maxBuy.lt(pool.baseReserves)).toBe(true);

    // Verify: marginal price at maxBuy should ~ limit
    const priceAtMax = ammMarginalBuyPrice(pool, maxBuy);
    expect(priceAtMax.minus(limit).abs().lt(0.001)).toBe(true);
  });
});

describe("ammMaxSellBeforePrice", () => {
  const pool = makeParams();

  it("returns 0 when AMM marginal sell price is already below limit", () => {
    // Marginal sell at consumed=0 ~ 9.9, so a limit of 10 is above current
    const result = ammMaxSellBeforePrice(pool, new BigNumber(10));
    expect(result.toFixed()).toBe("0");
  });

  it("returns correct amount for a limit below current price", () => {
    const limit = new BigNumber(5);
    const maxSell = ammMaxSellBeforePrice(pool, limit);
    expect(maxSell.gt(0)).toBe(true);

    // Verify: marginal sell price at maxSell should ~ limit
    const priceAtMax = ammMarginalSellPrice(pool, maxSell);
    expect(priceAtMax.minus(limit).abs().lt(0.001)).toBe(true);
  });
});

describe("ammBuyCost", () => {
  const pool = makeParams();

  it("small amount approximates marginal price", () => {
    const delta = new BigNumber(0.001);
    const cost = ammBuyCost(pool, delta, new BigNumber(0));
    const marginal = ammMarginalBuyPrice(pool, new BigNumber(0));
    const impliedPrice = cost.div(delta);
    // Should be very close to marginal price for a tiny trade
    expect(impliedPrice.minus(marginal).abs().div(marginal).lt(0.001)).toBe(
      true,
    );
  });

  it("larger amounts show slippage (higher effective price)", () => {
    const small = ammBuyCost(pool, new BigNumber(1), new BigNumber(0));
    const large = ammBuyCost(pool, new BigNumber(100), new BigNumber(0));
    const smallPrice = small.div(1);
    const largePrice = large.div(100);
    expect(largePrice.gt(smallPrice)).toBe(true);
  });

  it("accounts for already-consumed base", () => {
    const costFresh = ammBuyCost(pool, new BigNumber(10), new BigNumber(0));
    const costAfter100 = ammBuyCost(
      pool,
      new BigNumber(10),
      new BigNumber(100),
    );
    // After consuming 100, pool is thinner so buying 10 more costs more
    expect(costAfter100.gt(costFresh)).toBe(true);
  });
});

describe("ammSellProceeds", () => {
  const pool = makeParams();

  it("small amount approximates marginal price", () => {
    const delta = new BigNumber(0.001);
    const proceeds = ammSellProceeds(pool, delta, new BigNumber(0));
    const marginal = ammMarginalSellPrice(pool, new BigNumber(0));
    const impliedPrice = proceeds.div(delta);
    expect(impliedPrice.minus(marginal).abs().div(marginal).lt(0.001)).toBe(
      true,
    );
  });

  it("larger amounts show slippage (lower effective price)", () => {
    const small = ammSellProceeds(pool, new BigNumber(1), new BigNumber(0));
    const large = ammSellProceeds(pool, new BigNumber(100), new BigNumber(0));
    const smallPrice = small.div(1);
    const largePrice = large.div(100);
    expect(largePrice.lt(smallPrice)).toBe(true);
  });

  it("accounts for already-consumed base", () => {
    const proceedsFresh = ammSellProceeds(
      pool,
      new BigNumber(10),
      new BigNumber(0),
    );
    const proceedsAfter100 = ammSellProceeds(
      pool,
      new BigNumber(10),
      new BigNumber(100),
    );
    // After selling 100, pool has more base so selling 10 more yields less
    expect(proceedsAfter100.lt(proceedsFresh)).toBe(true);
  });
});

describe("BigNumber precision", () => {
  it("handles small fractional reserves", () => {
    const pool = makeParams(0.001, 0.01, 0.5);
    // spotPrice = 10, same ratio just tiny reserves
    const buyPrice = ammMarginalBuyPrice(pool, new BigNumber(0));
    expect(buyPrice.isFinite()).toBe(true);
    expect(buyPrice.gt(0)).toBe(true);

    const sellPrice = ammMarginalSellPrice(pool, new BigNumber(0));
    expect(sellPrice.isFinite()).toBe(true);
    expect(sellPrice.gt(0)).toBe(true);
  });
});
