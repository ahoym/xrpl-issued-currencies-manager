"use client";

import { useState, useEffect, useCallback } from "react";
import type { AmmPoolInfo } from "@/lib/types";

interface UseAmmPoolParams {
  baseCurrency?: string;
  baseIssuer?: string;
  quoteCurrency?: string;
  quoteIssuer?: string;
  network: string;
  refreshKey: number;
}

export function useAmmPool({
  baseCurrency,
  baseIssuer,
  quoteCurrency,
  quoteIssuer,
  network,
  refreshKey,
}: UseAmmPoolParams) {
  const [pool, setPool] = useState<AmmPoolInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalKey, setInternalKey] = useState(0);

  // Build URL — return null to skip fetch when pair is incomplete
  const url = baseCurrency && quoteCurrency
    ? `/api/amm/info?base_currency=${encodeURIComponent(baseCurrency)}` +
      (baseIssuer ? `&base_issuer=${encodeURIComponent(baseIssuer)}` : "") +
      `&quote_currency=${encodeURIComponent(quoteCurrency)}` +
      (quoteIssuer ? `&quote_issuer=${encodeURIComponent(quoteIssuer)}` : "") +
      `&network=${encodeURIComponent(network)}`
    : null;

  useEffect(() => {
    if (!url) {
      setPool(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          setPool(null);
        } else {
          setPool(data as AmmPoolInfo);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to fetch AMM info");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [url, refreshKey, internalKey]);

  const refresh = useCallback(() => setInternalKey((k) => k + 1), []);

  return { pool, loading, error, refresh };
}
