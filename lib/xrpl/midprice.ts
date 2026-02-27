import BigNumber from "bignumber.js";
import type { PricedLevel } from "./order-book-levels";
import type { MidpriceMetrics } from "@/lib/types";

/**
 * Micro-price: volume-weighted at top of book.
 * Weights best bid/ask by the opposite side's volume,
 * pulling the estimate toward the side with more liquidity.
 */
export function computeMicroPrice(
  bestAsk: BigNumber,
  bestBid: BigNumber,
  bestAskVol: BigNumber,
  bestBidVol: BigNumber,
): BigNumber | null {
  const denom = bestBidVol.plus(bestAskVol);
  if (!denom.gt(0)) return null;
  return bestBid.times(bestAskVol).plus(bestAsk.times(bestBidVol)).div(denom);
}

/**
 * Weighted midprice (VWAP) across all provided levels.
 * sum(price * volume) / sum(volume).
 */
export function computeVwap(levels: PricedLevel[]): BigNumber | null {
  if (levels.length === 0) return null;
  let sumPriceVol = new BigNumber(0);
  let sumVol = new BigNumber(0);
  for (const level of levels) {
    sumPriceVol = sumPriceVol.plus(level.price.times(level.amount));
    sumVol = sumVol.plus(level.amount);
  }
  return sumVol.gt(0) ? sumPriceVol.div(sumVol) : null;
}

/**
 * Compute all midprice metrics from priced ask and bid levels,
 * serialized to strings for API transport.
 *
 * Asks must be sorted descending (best ask = last element).
 * Bids must be sorted descending (best bid = first element).
 */
export function computeMidpriceMetrics(
  asks: PricedLevel[],
  bids: PricedLevel[],
): MidpriceMetrics {
  const bestAskLevel = asks.length > 0 ? asks[asks.length - 1] : null;
  const bestBidLevel = bids.length > 0 ? bids[0] : null;
  const bestAsk = bestAskLevel?.price ?? null;
  const bestBid = bestBidLevel?.price ?? null;

  const mid = bestAsk && bestBid ? bestAsk.plus(bestBid).div(2) : null;

  const spread = bestAsk && bestBid ? bestAsk.minus(bestBid) : null;

  const spreadBps =
    spread && mid && mid.gt(0) ? spread.div(mid).times(10_000) : null;

  const microPrice =
    bestAsk && bestBid && bestAskLevel && bestBidLevel
      ? computeMicroPrice(
          bestAsk,
          bestBid,
          bestAskLevel.amount,
          bestBidLevel.amount,
        )
      : null;

  const weightedMid = computeVwap([...asks, ...bids]);

  return {
    mid: mid?.toString() ?? null,
    microPrice: microPrice?.toString() ?? null,
    weightedMid: weightedMid?.toString() ?? null,
    spread: spread?.toString() ?? null,
    spreadBps: spreadBps?.toString() ?? null,
  };
}
