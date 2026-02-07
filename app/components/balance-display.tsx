"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { PersistedState } from "@/lib/types";

interface BalanceDisplayProps {
  address: string;
  network: PersistedState["network"];
  refreshKey?: number;
}

interface BalanceEntry {
  currency: string;
  value: string;
  issuer?: string;
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

export function BalanceDisplay({ address, network, refreshKey }: BalanceDisplayProps) {
  const [balances, setBalances] = useState<BalanceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCurrency, setExpandedCurrency] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${address}/balances?network=${network}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to fetch balances");
        return;
      }
      setBalances(data.balances);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [address, network]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances, refreshKey]);

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
                  <span className="group relative ml-1 cursor-default text-zinc-500 dark:text-zinc-400">
                    ({g.entries[0].issuer.slice(0, 6)}...)
                    <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-xs text-white group-hover:block dark:bg-zinc-100 dark:text-zinc-900">
                      {g.entries[0].issuer}
                    </span>
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
                        <span className="group relative ml-1 cursor-default">
                          {e.issuer.slice(0, 8)}...{e.issuer.slice(-4)}
                          <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-xs text-white group-hover:block dark:bg-zinc-100 dark:text-zinc-900">
                            {e.issuer}
                          </span>
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
