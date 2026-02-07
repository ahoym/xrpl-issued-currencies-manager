"use client";

import { useMemo } from "react";
import type { PersistedState } from "../types";
import { decodeCurrency } from "../xrpl/decode-currency-client";
import { useFetchTrustLines } from "./use-trust-lines";

export function useIssuerCurrencies(
  issuerAddress: string | undefined,
  network: PersistedState["network"],
  refreshKey: number,
) {
  const { lines, loading, refetch } = useFetchTrustLines(issuerAddress, network, refreshKey);

  const onLedgerCurrencies = useMemo(() => {
    return new Set(lines.map((l) => decodeCurrency(l.currency)));
  }, [lines]);

  return { onLedgerCurrencies, loading, refetch };
}
