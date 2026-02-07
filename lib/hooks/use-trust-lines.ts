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

export function useTrustLines(
  address: string,
  issuerAddress: string | null,
  network: PersistedState["network"],
  refreshKey: number,
) {
  const [lines, setLines] = useState<TrustLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrustLines = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${address}/trustlines?network=${network}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to fetch trust lines");
        return;
      }
      setLines(data.trustLines ?? []);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [address, network]);

  useEffect(() => {
    fetchTrustLines();
  }, [fetchTrustLines, refreshKey]);

  const trustLineCurrencies = useMemo(() => {
    if (!issuerAddress) return new Set<string>();
    return new Set(
      lines
        .filter((l) => l.account === issuerAddress)
        .map((l) => decodeCurrency(l.currency)),
    );
  }, [lines, issuerAddress]);

  return { trustLineCurrencies, loading, error, refetch: fetchTrustLines };
}
