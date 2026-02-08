import { useCallback } from "react";
import type { WalletInfo, PersistedState } from "../types";
import { useApiMutation } from "./use-api-mutation";

interface UseWalletGenerationResult {
  loading: boolean;
  error: string | null;
  generate: (network: PersistedState["network"], onSuccess: (wallet: WalletInfo) => void) => Promise<void>;
}

export function useWalletGeneration(): UseWalletGenerationResult {
  const { loading, error, mutate } = useApiMutation<WalletInfo>();

  const generate = useCallback(
    async (network: PersistedState["network"], onSuccess: (wallet: WalletInfo) => void) => {
      const data = await mutate(
        "/api/accounts/generate",
        { network },
        "Failed to generate wallet",
      );
      if (data) {
        onSuccess({
          address: data.address,
          seed: data.seed,
          publicKey: data.publicKey,
        });
      }
    },
    [mutate],
  );

  return { loading, error, generate };
}
