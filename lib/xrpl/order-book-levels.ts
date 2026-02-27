import BigNumber from "bignumber.js";
import type { OrderBookEntry } from "@/lib/types";
import { matchesCurrency } from "./match-currency";

export interface PricedLevel {
  price: BigNumber;
  amount: BigNumber;
  total: BigNumber;
  account: string;
}

/**
 * Build ask levels from raw order book entries.
 * Asks: creator sells base (taker_gets = base currency).
 * Uses funded amounts when available; drops unfunded offers.
 * Returns levels sorted descending by price.
 */
export function buildAsks(
  entries: OrderBookEntry[],
  baseCurrency: string,
  baseIssuer: string | undefined,
): PricedLevel[] {
  const asks = entries
    .filter((o) => matchesCurrency(o.taker_gets, baseCurrency, baseIssuer))
    .map((o) => {
      const amount = new BigNumber((o.taker_gets_funded ?? o.taker_gets).value);
      const total = new BigNumber((o.taker_pays_funded ?? o.taker_pays).value);
      const price = amount.gt(0) ? total.div(amount) : new BigNumber(0);
      return { price, amount, total, account: o.account };
    })
    .filter((o) => o.amount.gt(0) && o.price.gt(0));
  asks.sort((a, b) => b.price.comparedTo(a.price) ?? 0);
  return asks;
}

/**
 * Build bid levels from raw order book entries.
 * Bids: creator buys base (taker_pays = base, taker_gets = quote).
 * Uses funded amounts when available; drops unfunded offers.
 * Returns levels sorted descending by price.
 */
export function buildBids(
  entries: OrderBookEntry[],
  baseCurrency: string,
  baseIssuer: string | undefined,
): PricedLevel[] {
  const bids = entries
    .filter((o) => matchesCurrency(o.taker_pays, baseCurrency, baseIssuer))
    .map((o) => {
      const amount = new BigNumber((o.taker_pays_funded ?? o.taker_pays).value);
      const total = new BigNumber((o.taker_gets_funded ?? o.taker_gets).value);
      const price = amount.gt(0) ? total.div(amount) : new BigNumber(0);
      return { price, amount, total, account: o.account };
    })
    .filter((o) => o.amount.gt(0) && o.price.gt(0));
  bids.sort((a, b) => b.price.comparedTo(a.price) ?? 0);
  return bids;
}
