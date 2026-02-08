"use client";

import { useApiFetch } from "./use-api-fetch";
import type { PersistedState, TrustLine } from "../types";

export function useFetchTrustLines(
  address: string | undefined,
  network: PersistedState["network"],
  refreshKey: number,
) {
  const { data, loading, error, refresh, refetch } = useApiFetch<TrustLine>(
    () => {
      if (!address) return null;
      const params = new URLSearchParams({ network });
      return `/api/accounts/${encodeURIComponent(address)}/trustlines?${params}`;
    },
    (json) => (json.trustLines as TrustLine[]) ?? [],
    refreshKey,
  );

  return { lines: data, loading, error, refresh, refetch };
}
