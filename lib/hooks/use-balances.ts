"use client";

import { useApiFetch } from "./use-api-fetch";
import type { PersistedState, BalanceEntry } from "@/lib/types";

/**
 * Fetch account balances (XRP + issued currencies) from the API.
 * Returns the same shape as useApiFetch but aliased for convenience.
 */
export function useBalances(
  address: string | undefined,
  network: PersistedState["network"],
  refreshKey?: number,
) {
  const { data: balances, loading, error, refresh, refetch } = useApiFetch<BalanceEntry>(
    () =>
      address
        ? `/api/accounts/${encodeURIComponent(address)}/balances?network=${network}`
        : null,
    (json) => (json.balances as BalanceEntry[]) ?? [],
    refreshKey,
  );

  return { balances, loading, error, refresh, refetch };
}
