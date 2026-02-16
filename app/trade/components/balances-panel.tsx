"use client";

import BigNumber from "bignumber.js";
import type { BalanceEntry } from "@/lib/types";
import { decodeCurrency } from "@/lib/xrpl/decode-currency-client";

interface BalancesPanelProps {
  balances: BalanceEntry[];
  loading: boolean;
  onRefresh?: () => void;
}

export function BalancesPanel({ balances, loading, onRefresh }: BalancesPanelProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Balances
        </h3>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        )}
      </div>
      {loading ? (
        <div className="mt-2 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <div className="h-3 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-3 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
          ))}
        </div>
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
                  {new BigNumber(b.value).toFixed(4)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
