"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { PersistedState } from "../types";

/** Decode a 40-char hex XRPL currency code to ASCII. Short codes pass through. */
function decodeCurrency(code: string): string {
  if (code.length !== 40) return code;
  const stripped = code.replace(/0+$/, "");
  if (stripped.length === 0 || stripped.length % 2 !== 0) return code;
  try {
    const bytes = stripped.match(/.{2}/g)!.map((h) => parseInt(h, 16));
    const decoded = String.fromCharCode(...bytes);
    if (/^[\x20-\x7E]+$/.test(decoded)) return decoded;
  } catch {
    // fall through
  }
  return code;
}

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
