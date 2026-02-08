import { useState, useCallback } from "react";

interface UseApiMutationResult<T> {
  loading: boolean;
  error: string | null;
  clearError: () => void;
  mutate: (
    url: string,
    body: Record<string, unknown>,
    errorFallback?: string,
  ) => Promise<T | null>;
}

export function useApiMutation<T = Record<string, unknown>>(): UseApiMutationResult<T> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const mutate = useCallback(
    async (
      url: string,
      body: Record<string, unknown>,
      errorFallback = "Request failed",
    ): Promise<T | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? errorFallback);
          return null;
        }
        return data as T;
      } catch {
        setError("Network error");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { loading, error, clearError, mutate };
}
