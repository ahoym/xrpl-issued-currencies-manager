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
      return `/api/accounts/${address}/domains?network=${network}`;
    },
    (json) => (json.domains as DomainInfo[]) ?? [],
  );

  return { domains: data, loading, refresh };
}
