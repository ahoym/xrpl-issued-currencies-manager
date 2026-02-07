"use client";

import { useState } from "react";
import type { PersistedState, WalletInfo } from "@/lib/types";
import { BalanceDisplay } from "./balance-display";
import { CurrencyManager } from "./currency-manager";

interface IssuerSetupProps {
  issuer: WalletInfo | null;
  network: PersistedState["network"];
  currencies: string[];
  refreshKey: number;
  onGenerate: (wallet: WalletInfo) => void;
  onAddCurrency: (code: string) => void;
  onRemoveCurrency: (code: string) => void;
}

export function IssuerSetup({
  issuer,
  network,
  currencies,
  refreshKey,
  onGenerate,
  onAddCurrency,
  onRemoveCurrency,
}: IssuerSetupProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSeed, setShowSeed] = useState(false);

  async function handleGenerate() {
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
      onGenerate({
        address: data.address,
        seed: data.seed,
        publicKey: data.publicKey,
      });
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
      <h2 className="text-lg font-semibold">1. Issuer Wallet</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Generate a funded wallet that will act as the currency issuer.
      </p>

      {!issuer ? (
        <div className="mt-4">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Generating..." : "Generate Issuer Wallet"}
          </button>
          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="rounded-md bg-zinc-50 p-3 font-mono text-sm dark:bg-zinc-900">
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">Address: </span>
              {issuer.address}
            </div>
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">Public Key: </span>
              <span className="break-all">{issuer.publicKey}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 dark:text-zinc-400">Seed: </span>
              {showSeed ? (
                <span className="break-all">{issuer.seed}</span>
              ) : (
                <span>••••••••••••</span>
              )}
              <button
                onClick={() => setShowSeed(!showSeed)}
                className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
              >
                {showSeed ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <BalanceDisplay
            address={issuer.address}
            network={network}
            refreshKey={refreshKey}
          />
          <CurrencyManager
            currencies={currencies}
            disabled={false}
            onAdd={onAddCurrency}
            onRemove={onRemoveCurrency}
          />
        </div>
      )}
    </section>
  );
}
