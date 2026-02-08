import { useState, useEffect, useCallback } from "react";
import type { CredentialInfo, PersistedState } from "../types";

interface UseAccountCredentialsResult {
  credentials: CredentialInfo[];
  loading: boolean;
  refresh: () => void;
}

export function useAccountCredentials(
  address: string | null | undefined,
  network: PersistedState["network"],
  role?: "issuer" | "subject",
): UseAccountCredentialsResult {
  const [credentials, setCredentials] = useState<CredentialInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchCredentials = useCallback(async () => {
    if (!address) {
      setCredentials([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ network });
      if (role) params.set("role", role);
      const res = await fetch(`/api/accounts/${address}/credentials?${params}`);
      const data = await res.json();
      if (res.ok) {
        setCredentials(data.credentials ?? []);
      }
    } catch {
      // ignore — avoid breaking UI refresh loops
    } finally {
      setLoading(false);
    }
  }, [address, network, role]);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return { credentials, loading, refresh };
}
