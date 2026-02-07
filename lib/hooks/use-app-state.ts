"use client";

import { useCallback } from "react";
import { useLocalStorage } from "./use-local-storage";
import type { PersistedState, WalletInfo } from "../types";

const STORAGE_KEY = "xrpl-manager-state";

const DEFAULT_STATE: PersistedState = {
  network: "testnet",
  issuer: null,
  currencies: [],
  recipients: [],
};

export function useAppState() {
  const { value: state, set: setState, remove, hydrated } = useLocalStorage<PersistedState>(
    STORAGE_KEY,
    DEFAULT_STATE,
  );

  const setNetwork = useCallback(
    (network: PersistedState["network"]) => {
      setState((prev) => ({ ...prev, network }));
    },
    [setState],
  );

  const setIssuer = useCallback(
    (issuer: WalletInfo) => {
      setState((prev) => ({ ...prev, issuer }));
    },
    [setState],
  );

  const addCurrency = useCallback(
    (code: string) => {
      setState((prev) => {
        if (prev.currencies.includes(code)) return prev;
        return { ...prev, currencies: [...prev.currencies, code] };
      });
    },
    [setState],
  );

  const removeCurrency = useCallback(
    (code: string) => {
      setState((prev) => ({
        ...prev,
        currencies: prev.currencies.filter((c) => c !== code),
      }));
    },
    [setState],
  );

  const addRecipient = useCallback(
    (wallet: WalletInfo) => {
      setState((prev) => ({ ...prev, recipients: [...prev.recipients, wallet] }));
    },
    [setState],
  );

  const clearAll = useCallback(() => {
    remove();
  }, [remove]);

  return {
    state,
    hydrated,
    setNetwork,
    setIssuer,
    addCurrency,
    removeCurrency,
    addRecipient,
    clearAll,
  } as const;
}
