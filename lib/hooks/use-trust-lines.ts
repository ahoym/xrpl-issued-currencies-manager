"use client";

import type { TrustLine } from "../types";
import { createAccountFetchHook } from "./create-account-fetch-hook";

const useTrustLinesFetch = createAccountFetchHook<TrustLine>(
  "trustlines",
  "trustLines",
);

/**
 * Fetch trust lines for an account.
 */
export function useFetchTrustLines(
  address: string | undefined,
  network: string,
  refreshKey: number,
) {
  const { data, loading, error, refresh, refetch } = useTrustLinesFetch(
    address,
    network,
    refreshKey,
  );

  return { lines: data, loading, error, refresh, refetch };
}
