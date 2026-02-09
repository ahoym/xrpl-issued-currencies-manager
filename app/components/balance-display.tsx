"use client";

import { useState, useMemo } from "react";
import type { BalanceEntry } from "@/lib/types";
import { useBalances } from "@/lib/hooks/use-balances";
import { useAppState } from "@/lib/hooks/use-app-state";

interface BalanceDisplayProps {
  address: string;
  refreshKey?: number;
}

interface GroupedBalance {
  currency: string;
  total: number;
  entries: BalanceEntry[];
}

function groupBalances(balances: BalanceEntry[]): GroupedBalance[] {
  const groups = new Map<string, GroupedBalance>();

  for (const b of balances) {
    const key = b.currency;
    const existing = groups.get(key);
    if (existing) {
      existing.total += parseFloat(b.value);
      existing.entries.push(b);
    } else {
      groups.set(key, {
        currency: key,
        total: parseFloat(b.value),
        entries: [b],
      });
    }
  }

  return Array.from(groups.values());
}

export function BalanceDisplay({ address, refreshKey }: BalanceDisplayProps) {
  const { state: { network } } = useAppState();
  const { balances, loading, error, refresh: fetchBalances } = useBalances(address, network, refreshKey);
  const [expandedCurrency, setExpandedCurrency] = useState<string | null>(null);

  const grouped = useMemo(() => groupBalances(balances), [balances]);

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Balances</span>
        <button
          onClick={fetchBalances}
          disabled={loading}
          className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      {grouped.length > 0 && (
        <div className="mt-1 flex flex-col gap-1">
          {grouped.map((g) => (
            <div key={g.currency}>
              <span
                onClick={g.entries.length > 1 ? () => setExpandedCurrency(
                  expandedCurrency === g.currency ? null : g.currency,
                ) : undefined}
                role={g.entries.length > 1 ? "button" : undefined}
                tabIndex={g.entries.length > 1 ? 0 : undefined}
                onKeyDown={g.entries.length > 1 ? (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") setExpandedCurrency(expandedCurrency === g.currency ? null : g.currency); } : undefined}
                className={`inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 ${
                  g.entries.length > 1 ? "cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700" : ""
                }`}
              >
                {g.total} {g.currency}
                {g.entries.length > 1 && (
                  <span className="ml-1 text-zinc-500 dark:text-zinc-400">
                    ({g.entries.length} wallets)
                  </span>
                )}
                {g.entries.length === 1 && g.entries[0].issuer && (
                  <span className="ml-1 font-mono text-zinc-500 dark:text-zinc-400">
                    ({g.entries[0].issuer})
                  </span>
                )}
              </span>
              {expandedCurrency === g.currency && g.entries.length > 1 && (
                <div className="ml-4 mt-1 flex flex-col gap-0.5">
                  {g.entries.map((e, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center text-xs text-zinc-600 dark:text-zinc-400"
                    >
                      {e.value}
                      {e.issuer && (
                        <span className="ml-1 font-mono">
                          {e.issuer}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
