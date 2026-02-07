"use client";

interface OrderBookAmount {
  currency: string;
  value: string;
  issuer?: string;
}

interface OrderBookEntry {
  account: string;
  taker_gets: OrderBookAmount;
  taker_pays: OrderBookAmount;
  quality: string;
  sequence: number;
}

interface OrderBookProps {
  orderBook: { buy: OrderBookEntry[]; sell: OrderBookEntry[] } | null;
  loading: boolean;
  baseCurrency: string;
  baseIssuer?: string;
  quoteCurrency: string;
  accountAddress?: string;
  onRefresh: () => void;
  onSelectOrder?: (price: string, amount: string, tab: "buy" | "sell") => void;
}

function matchesCurrency(
  amt: OrderBookAmount,
  currency: string,
  issuer?: string,
): boolean {
  if (amt.currency !== currency) return false;
  if (currency === "XRP") return true;
  return amt.issuer === issuer;
}

export function OrderBook({
  orderBook,
  loading,
  baseCurrency,
  baseIssuer,
  quoteCurrency,
  accountAddress,
  onRefresh,
  onSelectOrder,
}: OrderBookProps) {
  // xrpl.js getOrderbook splits by lsfSell flag, not by book side.
  // Re-categorize by checking which currency is in taker_gets/taker_pays.
  const allOffers = [
    ...(orderBook?.buy ?? []),
    ...(orderBook?.sell ?? []),
  ];

  // Asks: creator sells base (taker_gets = base)
  const asks = allOffers
    .filter((o) => matchesCurrency(o.taker_gets, baseCurrency, baseIssuer))
    .map((o) => {
      const amount = parseFloat(o.taker_gets.value);
      const total = parseFloat(o.taker_pays.value);
      const price = amount > 0 ? total / amount : 0;
      return { price, amount, total, account: o.account };
    });
  asks.sort((a, b) => b.price - a.price);

  // Bids: creator buys base (taker_pays = base, taker_gets = quote)
  const bids = allOffers
    .filter((o) => matchesCurrency(o.taker_pays, baseCurrency, baseIssuer))
    .map((o) => {
      const amount = parseFloat(o.taker_pays.value);
      const total = parseFloat(o.taker_gets.value);
      const price = amount > 0 ? total / amount : 0;
      return { price, amount, total, account: o.account };
    });
  bids.sort((a, b) => b.price - a.price);

  const hasOrders = asks.length > 0 || bids.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Order Book
        </h3>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {!hasOrders && !loading ? (
        <p className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
          No orders for this pair
        </p>
      ) : (
        <div className="mt-2">
          <div className="grid grid-cols-3 border-b border-zinc-200 pb-1 text-xs font-medium text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            <span>Price</span>
            <span className="text-right">{baseCurrency}</span>
            <span className="text-right">{quoteCurrency}</span>
          </div>

          {/* Asks (sell orders) — click to prefill a buy */}
          {asks.map((a, i) => {
            const isOwn = accountAddress !== undefined && a.account === accountAddress;
            const clickable = !isOwn && onSelectOrder;
            return (
              <div
                key={`ask-${i}`}
                onClick={clickable ? () => onSelectOrder(a.price.toFixed(6), a.amount.toFixed(6), "buy") : undefined}
                className={`grid grid-cols-3 py-0.5 text-xs font-mono ${
                  clickable
                    ? "cursor-pointer rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                    : isOwn
                      ? "opacity-50"
                      : ""
                }`}
              >
                <span className="text-red-600 dark:text-red-400">
                  {a.price.toFixed(6)}
                </span>
                <span className="text-right text-zinc-700 dark:text-zinc-300">
                  {a.amount.toFixed(4)}
                </span>
                <span className="text-right text-zinc-500 dark:text-zinc-400">
                  {a.total.toFixed(4)}
                </span>
              </div>
            );
          })}

          {/* Spread divider */}
          {(asks.length > 0 || bids.length > 0) && (
            <div className="border-y border-dashed border-zinc-300 py-1 text-center text-xs text-zinc-400 dark:border-zinc-600 dark:text-zinc-500">
              {asks.length > 0 && bids.length > 0
                ? `Spread: ${(asks[asks.length - 1].price - bids[0].price).toFixed(6)}`
                : "---"}
            </div>
          )}

          {/* Bids (buy orders) — click to prefill a sell */}
          {bids.map((b, i) => {
            const isOwn = accountAddress !== undefined && b.account === accountAddress;
            const clickable = !isOwn && onSelectOrder;
            return (
              <div
                key={`bid-${i}`}
                onClick={clickable ? () => onSelectOrder(b.price.toFixed(6), b.amount.toFixed(6), "sell") : undefined}
                className={`grid grid-cols-3 py-0.5 text-xs font-mono ${
                  clickable
                    ? "cursor-pointer rounded hover:bg-green-50 dark:hover:bg-green-900/20"
                    : isOwn
                      ? "opacity-50"
                      : ""
                }`}
              >
                <span className="text-green-600 dark:text-green-400">
                  {b.price.toFixed(6)}
                </span>
                <span className="text-right text-zinc-700 dark:text-zinc-300">
                  {b.amount.toFixed(4)}
                </span>
                <span className="text-right text-zinc-500 dark:text-zinc-400">
                  {b.total.toFixed(4)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
