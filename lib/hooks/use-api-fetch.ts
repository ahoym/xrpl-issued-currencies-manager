"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Generic hook for fetching data from an API endpoint.
 *
 * @param buildUrl - Return the URL to fetch, or null to skip.
 * @param extractData - Pull the data array out of the parsed JSON response.
 * @param externalRefreshKey - Optional external key that triggers a re-fetch when changed.
 */
export function useApiFetch<T>(
  buildUrl: () => string | null,
  extractData: (json: Record<string, unknown>) => T[],
  externalRefreshKey?: number,
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const url = buildUrl();

  const fetchData = useCallback(async () => {
    if (!url) {
      setData([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Request failed");
        return;
      }
      setData(extractData(json));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey, externalRefreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return { data, loading, error, refresh, refetch: fetchData };
}
