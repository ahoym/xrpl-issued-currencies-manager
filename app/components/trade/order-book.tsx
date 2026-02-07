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
  quoteCurrency: string;
  onRefresh: () => void;
}

export function OrderBook({
  orderBook,
  loading,
  baseCurrency,
  quoteCurrency,
  onRefresh,
}: OrderBookProps) {
  // For sell orders (asks): seller offers base, wants quote
  // Price = taker_pays.value / taker_gets.value (quote per base)
  const asks = (orderBook?.sell ?? []).map((o) => {
    const amount = parseFloat(o.taker_gets.value);
    const total = parseFloat(o.taker_pays.value);
    const price = amount > 0 ? total / amount : 0;
    return { price, amount, total, account: o.account };
  });
  // Sort asks descending (highest price at top, lowest near spread)
  asks.sort((a, b) => b.price - a.price);

  // For buy orders (bids): buyer offers quote, wants base
  // Price = taker_gets.value / taker_pays.value (quote per base)
  const bids = (orderBook?.buy ?? []).map((o) => {
    const amount = parseFloat(o.taker_pays.value);
    const total = parseFloat(o.taker_gets.value);
    const price = amount > 0 ? total / amount : 0;
    return { price, amount, total, account: o.account };
  });
  // Sort bids descending (highest price at top)
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

          {/* Asks (sell orders) */}
          {asks.map((a, i) => (
            <div
              key={`ask-${i}`}
              className="grid grid-cols-3 py-0.5 text-xs font-mono"
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
          ))}

          {/* Spread divider */}
          {(asks.length > 0 || bids.length > 0) && (
            <div className="border-y border-dashed border-zinc-300 py-1 text-center text-xs text-zinc-400 dark:border-zinc-600 dark:text-zinc-500">
              {asks.length > 0 && bids.length > 0
                ? `Spread: ${(asks[asks.length - 1].price - bids[0].price).toFixed(6)}`
                : "---"}
            </div>
          )}

          {/* Bids (buy orders) */}
          {bids.map((b, i) => (
            <div
              key={`bid-${i}`}
              className="grid grid-cols-3 py-0.5 text-xs font-mono"
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
          ))}
        </div>
      )}
    </div>
  );
}
