"use client";

import { useApiFetch } from "./use-api-fetch";

/**
 * Factory for creating hooks that fetch a specific account-scoped API resource.
 *
 * Usage:
 *   const useBalances = createAccountFetchHook<BalanceEntry>("balances", "balances");
 *   const { data, loading, error, refresh } = useBalances(address, network);
 */
export function createAccountFetchHook<T>(
  /** API path segment after `/api/accounts/{address}/`. */
  path: string,
  /** JSON response field to extract the array from. */
  jsonField: string,
) {
  return function useAccountResource(
    address: string | null | undefined,
    network: string,
    refreshKey?: number,
  ) {
    return useApiFetch<T>(
      () => {
        if (!address) return null;
        const params = new URLSearchParams({ network });
        return `/api/accounts/${encodeURIComponent(address)}/${path}?${params}`;
      },
      (json) => (json[jsonField] as T[]) ?? [],
      refreshKey,
    );
  };
}
