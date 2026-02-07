"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { PersistedState } from "../types";
import { decodeCurrency } from "../xrpl/decode-currency-client";

interface TrustLine {
  account: string;
  currency: string;
  balance: string;
  limit: string;
}

export function useIssuerCurrencies(
  issuerAddress: string | undefined,
  network: PersistedState["network"],
  refreshKey: number,
) {
  const [lines, setLines] = useState<TrustLine[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTrustLines = useCallback(async () => {
    if (!issuerAddress) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/accounts/${issuerAddress}/trustlines?network=${network}`,
      );
      const data = await res.json();
      if (res.ok) {
        setLines(data.trustLines ?? []);
      }
    } catch {
      // ignore — this is best-effort
    } finally {
      setLoading(false);
    }
  }, [issuerAddress, network]);

  useEffect(() => {
    fetchTrustLines();
  }, [fetchTrustLines, refreshKey]);

  const onLedgerCurrencies = useMemo(() => {
    return new Set(lines.map((l) => decodeCurrency(l.currency)));
  }, [lines]);

  return { onLedgerCurrencies, loading, refetch: fetchTrustLines };
}
