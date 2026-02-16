"use client";

import BigNumber from "bignumber.js";
import type { OrderBookEntry, DepthSummary } from "@/lib/types";
import { matchesCurrency } from "@/lib/xrpl/match-currency";

export const DEPTH_OPTIONS = [10, 25, 50, 100] as const;
export type DepthLevel = (typeof DEPTH_OPTIONS)[number];

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

interface OrderBookProps {
  orderBook: { buy: OrderBookEntry[]; sell: OrderBookEntry[] } | null;
  loading: boolean;
  baseCurrency: string;
  baseIssuer?: string;
  quoteCurrency: string;
  accountAddress?: string;
  onSelectOrder?: (price: string, amount: string, tab: "buy" | "sell") => void;
  depth: DepthLevel;
  onDepthChange: (d: DepthLevel) => void;
}

export function OrderBook({
  orderBook,
  loading,
  baseCurrency,
  baseIssuer,
  quoteCurrency,
  accountAddress,
  onSelectOrder,
  depth,
  onDepthChange,
}: OrderBookProps) {
  const allOffers = [
    ...(orderBook?.buy ?? []),
    ...(orderBook?.sell ?? []),
  ];

  // Asks: creator sells base (taker_gets = base)
  // Use funded amounts when available to reflect actual fillable size; drop unfunded offers
  const asks = allOffers
    .filter((o) => matchesCurrency(o.taker_gets, baseCurrency, baseIssuer))
    .map((o) => {
      const amount = new BigNumber((o.taker_gets_funded ?? o.taker_gets).value);
      const total = new BigNumber((o.taker_pays_funded ?? o.taker_pays).value);
      const price = amount.gt(0) ? total.div(amount) : new BigNumber(0);
      return { price, amount, total, account: o.account };
    })
    .filter((o) => o.amount.gt(0) && o.price.gt(0));
  // Sort asks highest-first so the best (lowest) ask appears at the bottom, adjacent to the spread
  asks.sort((a, b) => b.price.comparedTo(a.price) ?? 0);

  // Bids: creator buys base (taker_pays = base, taker_gets = quote)
  // Use funded amounts when available to reflect actual fillable size; drop unfunded offers
  const bids = allOffers
    .filter((o) => matchesCurrency(o.taker_pays, baseCurrency, baseIssuer))
    .map((o) => {
      const amount = new BigNumber((o.taker_pays_funded ?? o.taker_pays).value);
      const total = new BigNumber((o.taker_gets_funded ?? o.taker_gets).value);
      const price = amount.gt(0) ? total.div(amount) : new BigNumber(0);
      return { price, amount, total, account: o.account };
    })
    .filter((o) => o.amount.gt(0) && o.price.gt(0));
  // Sort bids highest-first so the best (highest) bid appears at the top, adjacent to the spread
  bids.sort((a, b) => b.price.comparedTo(a.price) ?? 0);

  // Depth summary computed from FULL unsliced arrays
  const depthSummary: DepthSummary = {
    bidVolume: bids.reduce((acc, b) => acc + b.total.toNumber(), 0),
    bidLevels: bids.length,
    askVolume: asks.reduce((acc, a) => acc + a.amount.toNumber(), 0),
    askLevels: asks.length,
  };

  // Slice to display depth
  const visibleAsks = asks.slice(-depth);
  const visibleBids = bids.slice(0, depth);

  // Cumulative depth
  const askCumulative: BigNumber[] = [];
  for (let i = visibleAsks.length - 1, cum = new BigNumber(0); i >= 0; i--) {
    cum = cum.plus(visibleAsks[i].amount);
    askCumulative[i] = cum;
  }
  const bidCumulative: BigNumber[] = [];
  for (let i = 0, cum = new BigNumber(0); i < visibleBids.length; i++) {
    cum = cum.plus(visibleBids[i].amount);
    bidCumulative[i] = cum;
  }

  // Max individual amount across both sides for bar scaling
  const maxAmount = BigNumber.max(
    ...visibleAsks.map((a) => a.amount),
    ...visibleBids.map((b) => b.amount),
    0,
  );

  const bestAsk = visibleAsks.length > 0 ? visibleAsks[visibleAsks.length - 1].price : null;
  const bestBid = visibleBids.length > 0 ? visibleBids[0].price : null;
  const spread = bestAsk !== null && bestBid !== null ? bestAsk.minus(bestBid) : null;
  const mid = bestAsk !== null && bestBid !== null ? bestAsk.plus(bestBid).div(2) : null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Order Book
        </h3>
        <select
          value={depth}
          onChange={(e) => onDepthChange(Number(e.target.value) as DepthLevel)}
          className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        >
          {DEPTH_OPTIONS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {depthSummary.bidLevels + depthSummary.askLevels > 0 && (
        <p className="mt-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
          {depthSummary.bidLevels} bids · {formatCompact(depthSummary.bidVolume)} {quoteCurrency} depth
          <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">|</span>
          {depthSummary.askLevels} asks · {formatCompact(depthSummary.askVolume)} {baseCurrency} depth
        </p>
      )}

      <div className="mt-3">
        <div className="grid grid-cols-[0.65fr_1fr_1fr_1fr_7rem] border-b border-zinc-200 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
          <span>Price</span>
          <span className="text-right">Size</span>
          <span className="text-right">Total</span>
          <span className="text-right">Depth</span>
          <span className="text-right">Maker</span>
        </div>

        {/* Asks (sell orders) -- click to prefill a buy */}
        <div className="mb-1 mt-2.5 text-[10px] font-bold uppercase tracking-widest text-red-400 dark:text-red-500">
          Asks
        </div>
        {visibleAsks.length === 0 ? (
          <p className="py-3 text-center text-xs text-zinc-400 dark:text-zinc-500">
            No asks
          </p>
        ) : (
          visibleAsks.map((a, i) => {
            const isOwn = accountAddress !== undefined && a.account === accountAddress;
            const clickable = !isOwn && onSelectOrder;
            const barPct = maxAmount.gt(0) ? a.amount.div(maxAmount).times(100).toNumber() : 0;
            return (
              <div
                key={`ask-${i}`}
                onClick={clickable ? () => onSelectOrder(a.price.toFixed(6), a.amount.toFixed(6), "buy") : undefined}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                onKeyDown={clickable ? (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") onSelectOrder(a.price.toFixed(6), a.amount.toFixed(6), "buy"); } : undefined}
                className={`relative grid grid-cols-[0.65fr_1fr_1fr_1fr_7rem] py-0.5 text-xs font-mono ${
                  clickable
                    ? "cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20"
                    : isOwn
                      ? "opacity-40"
                      : ""
                }`}
              >
                <div
                  className="pointer-events-none absolute inset-y-0 right-0 bg-red-100/60 dark:bg-red-900/20"
                  style={{ width: `${barPct}%` }}
                />
                <span className="relative font-semibold text-red-600 dark:text-red-400">
                  {a.price.toFixed(6)}
                </span>
                <span className="relative text-right text-zinc-700 dark:text-zinc-300">
                  {a.amount.toFixed(4)}
                </span>
                <span className="relative text-right text-zinc-500 dark:text-zinc-400">
                  {a.total.toFixed(4)}
                </span>
                <span className="relative text-right text-zinc-500 dark:text-zinc-400">
                  {askCumulative[i].toFixed(4)}
                </span>
                <span className="group relative text-right text-zinc-400 dark:text-zinc-500">
                  {a.account.slice(0, 4)}…{a.account.slice(-4)}
                  <span className="pointer-events-none absolute bottom-full right-0 mb-1 hidden whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-[11px] text-zinc-100 shadow-lg group-hover:block dark:bg-zinc-700">
                    {a.account}
                  </span>
                </span>
              </div>
            );
          })
        )}

        {/* Spread / Mid divider */}
        <div className="my-2 border border-dashed border-zinc-200 bg-zinc-50/50 py-2 text-center text-xs dark:border-zinc-700 dark:bg-zinc-800/30">
          {spread !== null && mid !== null ? (
            <span className="text-zinc-600 dark:text-zinc-300">
              <span className="font-bold text-zinc-900 dark:text-zinc-100">{mid.toFixed(6)}</span>
              <span className="mx-2 text-zinc-300 dark:text-zinc-600">|</span>
              <span className="text-zinc-400 dark:text-zinc-500">
                Spread: {spread.toFixed(6)}{" "}
                ({spread.div(mid).times(10_000).toFixed(1)} bps)
              </span>
            </span>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500">
              {bestAsk !== null ? `Best ask: ${bestAsk.toFixed(6)}` : bestBid !== null ? `Best bid: ${bestBid.toFixed(6)}` : "No orders"}
            </span>
          )}
        </div>

        {/* Bids (buy orders) -- click to prefill a sell */}
        <div className="mb-1 mt-2.5 text-[10px] font-bold uppercase tracking-widest text-green-500 dark:text-green-500">
          Bids
        </div>
        {visibleBids.length === 0 ? (
          <p className="py-3 text-center text-xs text-zinc-400 dark:text-zinc-500">
            No bids
          </p>
        ) : (
          visibleBids.map((b, i) => {
            const isOwn = accountAddress !== undefined && b.account === accountAddress;
            const clickable = !isOwn && onSelectOrder;
            const barPct = maxAmount.gt(0) ? b.amount.div(maxAmount).times(100).toNumber() : 0;
            return (
              <div
                key={`bid-${i}`}
                onClick={clickable ? () => onSelectOrder(b.price.toFixed(6), b.amount.toFixed(6), "sell") : undefined}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                onKeyDown={clickable ? (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") onSelectOrder(b.price.toFixed(6), b.amount.toFixed(6), "sell"); } : undefined}
                className={`relative grid grid-cols-[0.65fr_1fr_1fr_1fr_7rem] py-0.5 text-xs font-mono ${
                  clickable
                    ? "cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/20"
                    : isOwn
                      ? "opacity-40"
                      : ""
                }`}
              >
                <div
                  className="pointer-events-none absolute inset-y-0 right-0 bg-green-100/60 dark:bg-green-900/20"
                  style={{ width: `${barPct}%` }}
                />
                <span className="relative font-semibold text-green-600 dark:text-green-400">
                  {b.price.toFixed(6)}
                </span>
                <span className="relative text-right text-zinc-700 dark:text-zinc-300">
                  {b.amount.toFixed(4)}
                </span>
                <span className="relative text-right text-zinc-500 dark:text-zinc-400">
                  {b.total.toFixed(4)}
                </span>
                <span className="relative text-right text-zinc-500 dark:text-zinc-400">
                  {bidCumulative[i].toFixed(4)}
                </span>
                <span className="group relative text-right text-zinc-400 dark:text-zinc-500">
                  {b.account.slice(0, 4)}…{b.account.slice(-4)}
                  <span className="pointer-events-none absolute bottom-full right-0 mb-1 hidden whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-[11px] text-zinc-100 shadow-lg group-hover:block dark:bg-zinc-700">
                    {b.account}
                  </span>
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
