"use client";

export interface RecentTrade {
  side: "buy" | "sell";
  price: string;
  baseAmount: string;
  quoteAmount: string;
  account: string;
  time: string;
  hash: string;
}

interface RecentTradesProps {
  trades: RecentTrade[];
  loading: boolean;
  pairSelected: boolean;
  baseCurrency?: string;
  quoteCurrency?: string;
}

function formatTime(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "—";
  }
}

export function RecentTrades({
  trades,
  loading,
  pairSelected,
  baseCurrency,
  quoteCurrency,
}: RecentTradesProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Recent Trades
        {pairSelected && baseCurrency && quoteCurrency && (
          <span className="ml-2 font-normal text-zinc-500 dark:text-zinc-400">
            ({baseCurrency}/{quoteCurrency})
          </span>
        )}
      </h3>
      {loading ? (
        <p className="mt-3 text-xs text-zinc-500">Loading trades...</p>
      ) : !pairSelected ? (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Select a pair to see recent trades
        </p>
      ) : trades.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          No recent trades for this pair
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="pb-1.5 pr-2 font-medium">Side</th>
                <th className="pb-1.5 pr-2 font-medium text-right">Price</th>
                <th className="pb-1.5 pr-2 font-medium text-right">Amount</th>
                <th className="pb-1.5 pr-2 font-medium text-right">Total</th>
                <th className="pb-1.5 font-medium text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <tr
                  key={trade.hash}
                  className="border-b border-zinc-50 dark:border-zinc-900"
                >
                  <td className="py-1.5 pr-2">
                    <span
                      className={
                        trade.side === "buy"
                          ? "font-medium text-green-600 dark:text-green-400"
                          : "font-medium text-red-600 dark:text-red-400"
                      }
                    >
                      {trade.side === "buy" ? "Buy" : "Sell"}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                    {parseFloat(trade.price).toFixed(4)}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                    {parseFloat(trade.baseAmount).toFixed(4)}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                    {parseFloat(trade.quoteAmount).toFixed(4)}
                  </td>
                  <td className="py-1.5 text-right text-zinc-500 dark:text-zinc-400">
                    {formatTime(trade.time)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
