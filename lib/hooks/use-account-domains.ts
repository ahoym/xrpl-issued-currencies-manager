import { useApiFetch } from "./use-api-fetch";
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
  const { data, loading, refresh } = useApiFetch<DomainInfo>(
    () => {
      if (!address) return null;
      const params = new URLSearchParams({ network });
      return `/api/accounts/${encodeURIComponent(address)}/domains?${params}`;
    },
    (json) => (json.domains as DomainInfo[]) ?? [],
  );

  return { domains: data, loading, refresh };
}
