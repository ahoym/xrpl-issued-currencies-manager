import { useState, useEffect, useCallback } from "react";
import type { DomainInfo, PersistedState } from "../types";

interface UseAccountDomainsResult {
  domains: DomainInfo[];
  loading: boolean;
  refresh: () => void;
}

export function useAccountDomains(
  address: string | null | undefined,
  network: PersistedState["network"],
): UseAccountDomainsResult {
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchDomains = useCallback(async () => {
    if (!address) {
      setDomains([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/accounts/${address}/domains?network=${network}`);
      const data = await res.json();
      if (res.ok) {
        setDomains(data.domains ?? []);
      }
    } catch {
      // ignore — avoid breaking UI refresh loops
    } finally {
      setLoading(false);
    }
  }, [address, network]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return { domains, loading, refresh };
}
