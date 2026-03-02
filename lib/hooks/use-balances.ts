"use client";

import type { BalanceEntry } from "@/lib/types";
import { createAccountFetchHook } from "./create-account-fetch-hook";

const useBalancesFetch = createAccountFetchHook<BalanceEntry>(
  "balances",
  "balances",
);

/**
 * Fetch account balances (XRP + issued currencies) from the API.
 */
export function useBalances(
  address: string | undefined,
  network: string,
  refreshKey?: number,
) {
  const {
    data: balances,
    loading,
    error,
    refresh,
    refetch,
  } = useBalancesFetch(address, network, refreshKey);

  return { balances, loading, error, refresh, refetch };
}
