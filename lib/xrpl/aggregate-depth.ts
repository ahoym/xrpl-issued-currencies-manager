import BigNumber from "bignumber.js";
import type { DepthSummary } from "@/lib/types";

interface OfferWithValue {
  taker_gets: { value: string };
  taker_gets_funded?: { value: string };
}

/**
 * Compute depth totals from the full buy/sell arrays.
 *
 * Uses funded amounts when available so depth reflects actual fillable
 * liquidity. Offers with zero funded value are excluded from level counts.
 *
 * - Bid depth (quote) = sum of `taker_gets` across buy offers
 *   (creator offers quote currency to buy base)
 * - Ask depth (base) = sum of `taker_gets` across sell offers
 *   (creator offers base currency to sell)
 */
export function aggregateDepth<T extends OfferWithValue>(
  buy: T[],
  sell: T[],
): { depth: DepthSummary } {
  let bidVolume = new BigNumber(0);
  let bidLevels = 0;
  for (const o of buy) {
    const v = new BigNumber((o.taker_gets_funded ?? o.taker_gets).value);
    if (v.gt(0)) {
      bidVolume = bidVolume.plus(v);
      bidLevels++;
    }
  }

  let askVolume = new BigNumber(0);
  let askLevels = 0;
  for (const o of sell) {
    const v = new BigNumber((o.taker_gets_funded ?? o.taker_gets).value);
    if (v.gt(0)) {
      askVolume = askVolume.plus(v);
      askLevels++;
    }
  }

  return {
    depth: {
      bidVolume: bidVolume.toFixed(),
      bidLevels,
      askVolume: askVolume.toFixed(),
      askLevels,
    },
  };
}
