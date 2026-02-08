"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { useLocalStorage } from "./use-local-storage";
import type { PersistedState, NetworkData, WalletInfo } from "../types";

const NETWORK_KEY = "xrpl-manager-network";
const OLD_STORAGE_KEY = "xrpl-manager-state";

function networkDataKey(network: PersistedState["network"]) {
  return `xrpl-manager-state-${network}`;
}

const DEFAULT_NETWORK_DATA: NetworkData = {
  issuer: null,
  credentialIssuer: null,
  domainOwner: null,
  currencies: [],
  recipients: [],
};

function readNetwork(): PersistedState["network"] {
  try {
    const stored = localStorage.getItem(NETWORK_KEY);
    if (stored === "testnet" || stored === "devnet") return stored;
  } catch {
    // ignore
  }
  return "testnet";
}

interface AppStateValue {
  readonly state: PersistedState;
  readonly hydrated: boolean;
  readonly setNetwork: (network: PersistedState["network"]) => void;
  readonly setIssuer: (issuer: WalletInfo) => void;
  readonly addCurrency: (code: string) => void;
  readonly removeCurrency: (code: string) => void;
  readonly addRecipient: (wallet: WalletInfo) => void;
  readonly setCredentialIssuer: (wallet: WalletInfo) => void;
  readonly setDomainOwner: (wallet: WalletInfo) => void;
  readonly importState: (imported: PersistedState) => void;
  readonly clearAll: () => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [network, setNetworkRaw] = useState<PersistedState["network"]>(readNetwork);

  const {
    value: networkData,
    set: setNetworkData,
    remove: removeNetworkData,
    hydrated,
  } = useLocalStorage<NetworkData>(networkDataKey(network), DEFAULT_NETWORK_DATA);

  // One-time migration from old single-key storage
  useEffect(() => {
    try {
      const old = localStorage.getItem(OLD_STORAGE_KEY);
      if (!old) return;
      const parsed: PersistedState = JSON.parse(old);
      const { network: oldNetwork, ...data } = parsed;
      localStorage.setItem(networkDataKey(oldNetwork), JSON.stringify(data));
      localStorage.setItem(NETWORK_KEY, oldNetwork);
      localStorage.removeItem(OLD_STORAGE_KEY);
      // Apply migrated state
      // eslint-disable-next-line react-hooks/set-state-in-effect -- One-time migration from legacy storage format
      setNetworkRaw(oldNetwork);
    } catch {
      // corrupt old data — ignore
    }
  }, []);

  const state: PersistedState = { network, ...networkData };

  const setNetwork = useCallback(
    (next: PersistedState["network"]) => {
      setNetworkRaw(next);
      try {
        localStorage.setItem(NETWORK_KEY, next);
      } catch {
        // ignore
      }
    },
    [],
  );

  const setIssuer = useCallback(
    (issuer: WalletInfo) => {
      setNetworkData((prev) => ({ ...prev, issuer }));
    },
    [setNetworkData],
  );

  const addCurrency = useCallback(
    (code: string) => {
      setNetworkData((prev) => {
        if (prev.currencies.includes(code)) return prev;
        return { ...prev, currencies: [...prev.currencies, code] };
      });
    },
    [setNetworkData],
  );

  const removeCurrency = useCallback(
    (code: string) => {
      setNetworkData((prev) => ({
        ...prev,
        currencies: prev.currencies.filter((c) => c !== code),
      }));
    },
    [setNetworkData],
  );

  const addRecipient = useCallback(
    (wallet: WalletInfo) => {
      setNetworkData((prev) => ({ ...prev, recipients: [...prev.recipients, wallet] }));
    },
    [setNetworkData],
  );

  const setCredentialIssuer = useCallback(
    (wallet: WalletInfo) => {
      setNetworkData((prev) => ({ ...prev, credentialIssuer: wallet }));
    },
    [setNetworkData],
  );

  const setDomainOwner = useCallback(
    (wallet: WalletInfo) => {
      setNetworkData((prev) => ({ ...prev, domainOwner: wallet }));
    },
    [setNetworkData],
  );

  const importState = useCallback(
    (imported: PersistedState) => {
      const { network: importedNetwork, ...data } = imported;
      try {
        localStorage.setItem(networkDataKey(importedNetwork), JSON.stringify(data));
      } catch {
        // ignore
      }
      try {
        localStorage.setItem(NETWORK_KEY, importedNetwork);
      } catch {
        // ignore
      }
      if (importedNetwork === network) {
        // Same network — key won't change so useLocalStorage won't re-read;
        // update React state directly
        setNetworkData(data);
      } else {
        setNetworkRaw(importedNetwork);
      }
    },
    [network, setNetworkData],
  );

  const clearAll = useCallback(() => {
    removeNetworkData();
  }, [removeNetworkData]);

  const value: AppStateValue = {
    state,
    hydrated,
    setNetwork,
    setIssuer,
    addCurrency,
    removeCurrency,
    addRecipient,
    setCredentialIssuer,
    setDomainOwner,
    importState,
    clearAll,
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
