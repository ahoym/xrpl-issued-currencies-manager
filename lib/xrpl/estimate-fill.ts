import BigNumber from "bignumber.js";
import type { PricedLevel } from "./order-book-levels";

export interface EstimateFillResult {
  /** Volume-weighted average fill price */
  avgPrice: BigNumber;
  /** Price of the worst (furthest from mid) level touched */
  worstPrice: BigNumber;
  /** Slippage as a percentage: |avgPrice - midPrice| / midPrice x 100. Null when midPrice is unavailable. */
  slippage: BigNumber | null;
  /** Amount of base currency actually filled */
  filledAmount: BigNumber;
  /** Total cost (buy) or proceeds (sell) in quote currency */
  totalCost: BigNumber;
  /** Whether the full requested amount can be filled by available depth */
  fullFill: boolean;
}

/**
 * Walk order book levels to estimate fill for a given order size.
 *
 * @param levels - Price levels sorted best-price-first.
 *   For buys: pass asks sorted ascending (lowest ask first).
 *   For sells: pass bids sorted descending (highest bid first).
 * @param amount - Desired fill amount in base currency.
 * @param midPrice - Current mid price for slippage calculation, or null if unavailable.
 *
 * Slippage formula: |avgPrice - midPrice| / midPrice x 100
 *
 * @returns EstimateFillResult or null if amount is zero/NaN or levels are empty.
 */
export function estimateFill(
  levels: PricedLevel[],
  amount: BigNumber,
  midPrice: BigNumber | null,
): EstimateFillResult | null {
  if (amount.isNaN() || amount.lte(0) || levels.length === 0) return null;

  let remaining = amount;
  let filledAmount = new BigNumber(0);
  let totalCost = new BigNumber(0);
  let worstPrice = new BigNumber(0);

  for (const level of levels) {
    if (remaining.lte(0)) break;

    const fill = BigNumber.min(remaining, level.amount);
    filledAmount = filledAmount.plus(fill);
    totalCost = totalCost.plus(fill.times(level.price));
    worstPrice = level.price;
    remaining = remaining.minus(fill);
  }

  if (filledAmount.lte(0)) return null;

  const avgPrice = totalCost.div(filledAmount);
  const fullFill = remaining.lte(0);

  let slippage: BigNumber | null = null;
  if (midPrice !== null && midPrice.gt(0)) {
    slippage = avgPrice.minus(midPrice).abs().div(midPrice).times(100);
  }

  return { avgPrice, worstPrice, slippage, filledAmount, totalCost, fullFill };
}
