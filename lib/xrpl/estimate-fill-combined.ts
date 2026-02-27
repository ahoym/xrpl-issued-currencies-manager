import BigNumber from "bignumber.js";
import type { PricedLevel } from "./order-book-levels";
import type { AmmPoolParams } from "./amm-math";
import {
  ammMarginalBuyPrice,
  ammMarginalSellPrice,
  ammMaxBuyBeforePrice,
  ammMaxSellBeforePrice,
  ammBuyCost,
  ammSellProceeds,
} from "./amm-math";

export interface CombinedFillResult {
  avgPrice: BigNumber;
  worstPrice: BigNumber;
  slippage: BigNumber | null;
  filledAmount: BigNumber;
  totalCost: BigNumber;
  fullFill: boolean;
  clobFilled: BigNumber;
  ammFilled: BigNumber;
}

/** Cap AMM consumption at 99% of reserves to avoid the asymptote. */
const AMM_RESERVE_CAP = new BigNumber(0.99);

/**
 * Interleaved CLOB + AMM fill estimation.
 *
 * Walks CLOB levels and AMM curve together, always consuming from whichever
 * source offers the better price. For buys, "better" means lower price
 * (cheaper quote cost); for sells, "better" means higher price (more proceeds).
 *
 * Degenerates to CLOB-only when `ammPool` is null.
 *
 * @param levels - Price levels sorted best-price-first
 *   (ascending asks for buys, descending bids for sells).
 * @param amount - Desired fill amount in base currency.
 * @param midPrice - Current mid price for slippage calculation, or null.
 * @param ammPool - AMM pool params, or null if no pool.
 * @param side - "buy" or "sell".
 */
export function estimateFillCombined(
  levels: PricedLevel[],
  amount: BigNumber,
  midPrice: BigNumber | null,
  ammPool: AmmPoolParams | null,
  side: "buy" | "sell",
): CombinedFillResult | null {
  if (amount.isNaN() || amount.lte(0)) return null;
  if (levels.length === 0 && !ammPool) return null;

  const maxAmmBase = ammPool ? ammPool.baseReserves.times(AMM_RESERVE_CAP) : new BigNumber(0);

  let remaining = amount;
  let clobFilled = new BigNumber(0);
  let ammFilled = new BigNumber(0);
  let totalCost = new BigNumber(0);
  let worstPrice = new BigNumber(0);

  let levelIdx = 0;

  while (remaining.gt(0)) {
    const hasLevel = levelIdx < levels.length;
    const hasAmm = ammPool !== null && ammFilled.lt(maxAmmBase);

    if (!hasLevel && !hasAmm) break;

    const levelPrice = hasLevel ? levels[levelIdx].price : null;

    if (hasAmm && ammPool) {
      const ammPrice =
        side === "buy"
          ? ammMarginalBuyPrice(ammPool, ammFilled)
          : ammMarginalSellPrice(ammPool, ammFilled);

      const ammIsBetter =
        side === "buy"
          ? !levelPrice || ammPrice.lte(levelPrice)
          : !levelPrice || ammPrice.gte(levelPrice);

      if (ammIsBetter) {
        // Determine how much the AMM can fill before its price crosses the CLOB level
        let ammChunk: BigNumber;
        if (levelPrice) {
          const maxBeforeLevel =
            side === "buy"
              ? ammMaxBuyBeforePrice(ammPool, levelPrice)
              : ammMaxSellBeforePrice(ammPool, levelPrice);
          ammChunk = BigNumber.max(maxBeforeLevel.minus(ammFilled), 0);
        } else {
          // No more CLOB levels — fill remainder from AMM
          ammChunk = maxAmmBase.minus(ammFilled);
        }

        ammChunk = BigNumber.min(ammChunk, remaining);
        if (ammChunk.lte(0) && hasLevel) {
          // AMM can't fill any more before this level — consume from CLOB
        } else if (ammChunk.gt(0)) {
          const cost =
            side === "buy"
              ? ammBuyCost(ammPool, ammChunk, ammFilled)
              : ammSellProceeds(ammPool, ammChunk, ammFilled);
          ammFilled = ammFilled.plus(ammChunk);
          totalCost = totalCost.plus(cost);
          remaining = remaining.minus(ammChunk);
          // Update worst price: the marginal price at the end of this AMM chunk
          const endPrice =
            side === "buy"
              ? ammMarginalBuyPrice(ammPool, ammFilled)
              : ammMarginalSellPrice(ammPool, ammFilled);
          worstPrice = updateWorstPrice(worstPrice, endPrice, side);
          continue;
        }
      }
    }

    // Consume from current CLOB level
    if (hasLevel) {
      const level = levels[levelIdx];
      const fill = BigNumber.min(remaining, level.amount);
      clobFilled = clobFilled.plus(fill);
      totalCost = totalCost.plus(fill.times(level.price));
      worstPrice = updateWorstPrice(worstPrice, level.price, side);
      remaining = remaining.minus(fill);
      levelIdx++;
    }
  }

  const filledAmount = clobFilled.plus(ammFilled);
  if (filledAmount.lte(0)) return null;

  const avgPrice = totalCost.div(filledAmount);
  const fullFill = remaining.lte(0);

  let slippage: BigNumber | null = null;
  if (midPrice !== null && midPrice.gt(0)) {
    slippage = avgPrice.minus(midPrice).abs().div(midPrice).times(100);
  }

  return {
    avgPrice,
    worstPrice,
    slippage,
    filledAmount,
    totalCost,
    fullFill,
    clobFilled,
    ammFilled,
  };
}

/** Update worst price: for buys, worst = highest; for sells, worst = lowest. */
function updateWorstPrice(
  current: BigNumber,
  candidate: BigNumber,
  side: "buy" | "sell",
): BigNumber {
  if (current.isZero()) return candidate;
  return side === "buy" ? BigNumber.max(current, candidate) : BigNumber.min(current, candidate);
}
