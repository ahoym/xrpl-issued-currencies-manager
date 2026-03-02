import type { DomainInfo } from "../types";
import { createAccountFetchHook } from "./create-account-fetch-hook";

const useDomainsFetch = createAccountFetchHook<DomainInfo>(
  "domains",
  "domains",
);

interface UseAccountDomainsResult {
  domains: DomainInfo[];
  loading: boolean;
  refresh: () => void;
}

/**
 * Fetch permissioned domains for an account.
 */
export function useAccountDomains(
  address: string | null | undefined,
  network: string,
): UseAccountDomainsResult {
  const { data, loading, refresh } = useDomainsFetch(address, network);

  return { domains: data, loading, refresh };
}
