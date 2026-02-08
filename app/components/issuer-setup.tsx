"use client";

import { useState, useEffect, useCallback } from "react";
import type { PersistedState, WalletInfo } from "@/lib/types";
import { BalanceDisplay } from "./balance-display";
import { CurrencyManager } from "./currency-manager";
import { SecretField } from "./secret-field";

interface IssuerSetupProps {
  issuer: WalletInfo | null;
  network: PersistedState["network"];
  currencies: string[];
  onLedgerCurrencies: Set<string>;
  refreshKey: number;
  onGenerate: (wallet: WalletInfo) => void;
  onAddCurrency: (code: string) => void;
  onRemoveCurrency: (code: string) => void;
}

export function IssuerSetup({
  issuer,
  network,
  currencies,
  onLedgerCurrencies,
  refreshKey,
  onGenerate,
  onAddCurrency,
  onRemoveCurrency,
}: IssuerSetupProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ripplingStatus, setRipplingStatus] = useState<"idle" | "loading" | "done" | "needs_repair">("idle");

  const checkRippling = useCallback(async () => {
    if (!issuer) return;
    try {
      const res = await fetch(`/api/accounts/${issuer.address}?network=${network}`);
      if (!res.ok) return;
      const data = await res.json();
      const flags: number = data.account_data?.Flags ?? 0;
      // lsfDefaultRipple = 0x00800000
      if (flags & 0x00800000) {
        // DefaultRipple is set, but check if existing trust lines still have NoRipple
        const tlRes = await fetch(`/api/accounts/${issuer.address}/trustlines?network=${network}`);
        if (tlRes.ok) {
          const tlData = await tlRes.json();
          const hasNoRipple = (tlData.trustLines ?? []).some(
            (l: { no_ripple?: boolean }) => l.no_ripple === true,
          );
          setRipplingStatus(hasNoRipple ? "needs_repair" : "done");
        } else {
          setRipplingStatus("done");
        }
      }
    } catch {
      // ignore — will show the button as idle
    }
  }, [issuer, network]);

  useEffect(() => {
    checkRippling();
  }, [checkRippling]);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/accounts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network, isIssuer: true }),
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

  async function handleEnableRippling() {
    if (!issuer) return;
    setRipplingStatus("loading");
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${issuer.address}/rippling`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: issuer.seed, network }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to enable rippling");
        setRipplingStatus("idle");
        return;
      }
      setRipplingStatus("done");
    } catch {
      setError("Network error");
      setRipplingStatus("idle");
    }
  }

  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center justify-between p-6 text-left"
      >
        <div>
          <h2 className="text-lg font-semibold">1. Issuer Wallet</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Generate a funded wallet that will act as the currency issuer.
          </p>
        </div>
        <span className="ml-4 text-zinc-400 dark:text-zinc-500">
          {collapsed ? "▸" : "▾"}
        </span>
      </button>

      {!collapsed && (
        <div className="px-6 pb-6">
          {!issuer ? (
            <div>
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
            <div className="space-y-4">
              <div className="rounded-md bg-zinc-50 p-3 font-mono text-sm dark:bg-zinc-900">
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400">Address: </span>
                  {issuer.address}
                </div>
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400">Public Key: </span>
                  <span className="break-all">{issuer.publicKey}</span>
                </div>
                <SecretField label="Seed" value={issuer.seed} />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleEnableRippling}
                  disabled={ripplingStatus === "done" || ripplingStatus === "loading"}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  {ripplingStatus === "loading"
                    ? "Enabling..."
                    : ripplingStatus === "done"
                      ? "Rippling Enabled"
                      : ripplingStatus === "needs_repair"
                        ? "Repair Trust Lines"
                        : "Enable Rippling"}
                </button>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {ripplingStatus === "needs_repair"
                    ? "Some trust lines were created before rippling was enabled and need to be updated"
                    : "Required for peer-to-peer transfers of issued currencies"}
                </span>
              </div>
              <BalanceDisplay
                address={issuer.address}
                network={network}
                refreshKey={refreshKey}
              />
              <CurrencyManager
                currencies={currencies}
                onLedgerCurrencies={onLedgerCurrencies}
                disabled={false}
                onAdd={onAddCurrency}
                onRemove={onRemoveCurrency}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
