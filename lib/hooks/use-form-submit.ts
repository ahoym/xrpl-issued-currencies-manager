"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { SUCCESS_MESSAGE_DURATION_MS } from "@/lib/ui/ui";

interface UseFormSubmitOptions {
  /** Fallback error message when server returns no error field. */
  errorFallback?: string;
  /** Duration in ms before auto-clearing success. 0 = never auto-clear. */
  successDuration?: number;
}

interface UseFormSubmitResult<T> {
  submitting: boolean;
  error: string | null;
  success: boolean;
  clearError: () => void;
  /** Submit a POST request. Returns the parsed response on success, null on failure. */
  submit: (
    url: string,
    body: Record<string, unknown>,
    options?: UseFormSubmitOptions,
  ) => Promise<T | null>;
}

/**
 * Hook for managing form submission state (submitting/error/success).
 * Handles the common pattern of POST → check response → show success → auto-clear.
 */
export function useFormSubmit<
  T = Record<string, unknown>,
>(): UseFormSubmitResult<T> {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const submit = useCallback(
    async (
      url: string,
      body: Record<string, unknown>,
      options?: UseFormSubmitOptions,
    ): Promise<T | null> => {
      // Clear any pending success timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      setSubmitting(true);
      setError(null);
      setSuccess(false);

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? options?.errorFallback ?? "Request failed");
          return null;
        }

        setSuccess(true);

        const duration =
          options?.successDuration ?? SUCCESS_MESSAGE_DURATION_MS;
        if (duration > 0) {
          timerRef.current = setTimeout(() => {
            setSuccess(false);
            timerRef.current = null;
          }, duration);
        }

        return data as T;
      } catch {
        setError("Network error");
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  return { submitting, error, success, clearError, submit };
}
