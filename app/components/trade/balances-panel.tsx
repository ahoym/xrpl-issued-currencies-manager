"use client";

import type { BalanceEntry } from "@/lib/types";
import { decodeCurrency } from "@/lib/xrpl/decode-currency-client";

interface BalancesPanelProps {
  balances: BalanceEntry[];
  loading: boolean;
}

export function BalancesPanel({ balances, loading }: BalancesPanelProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Balances
      </h3>
      {loading ? (
        <p className="mt-2 text-xs text-zinc-500">Loading...</p>
      ) : balances.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          No balances
        </p>
      ) : (
        <div className="mt-2 space-y-1">
          {balances.map((b, i) => {
            const cur = decodeCurrency(b.currency);
            return (
              <div
                key={i}
                className="flex items-center justify-between text-xs"
              >
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {cur}
                </span>
                <span className="font-mono text-zinc-600 dark:text-zinc-400">
                  {parseFloat(b.value).toFixed(4)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
