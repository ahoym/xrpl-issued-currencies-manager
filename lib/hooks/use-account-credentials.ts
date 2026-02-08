import { useApiFetch } from "./use-api-fetch";
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
  const { data, loading, refresh } = useApiFetch<CredentialInfo>(
    () => {
      if (!address) return null;
      const params = new URLSearchParams({ network });
      if (role) params.set("role", role);
      return `/api/accounts/${address}/credentials?${params}`;
    },
    (json) => (json.credentials as CredentialInfo[]) ?? [],
  );

  return { credentials: data, loading, refresh };
}
