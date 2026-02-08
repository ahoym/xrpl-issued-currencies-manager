import { useState, useCallback } from "react";
import type { WalletInfo, PersistedState } from "../types";

interface UseWalletGenerationResult {
  loading: boolean;
  error: string | null;
  generate: (network: PersistedState["network"], onSuccess: (wallet: WalletInfo) => void) => Promise<void>;
}

export function useWalletGeneration(): UseWalletGenerationResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (network: PersistedState["network"], onSuccess: (wallet: WalletInfo) => void) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/accounts/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ network }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to generate wallet");
          return;
        }
        onSuccess({
          address: data.address,
          seed: data.seed,
          publicKey: data.publicKey,
        });
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { loading, error, generate };
}
