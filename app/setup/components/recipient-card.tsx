"use client";

import { useState, useMemo } from "react";
import type { WalletInfo } from "@/lib/types";
import { useFetchTrustLines } from "@/lib/hooks/use-trust-lines";
import { decodeCurrency } from "@/lib/xrpl/decode-currency-client";
import { DEFAULT_TRUST_LINE_LIMIT } from "@/lib/xrpl/constants";
import { Assets, WELL_KNOWN_CURRENCIES } from "@/lib/assets";
import { useAppState } from "@/lib/hooks/use-app-state";
import { BalanceDisplay } from "../../components/balance-display";
import { ExplorerLink } from "../../components/explorer-link";
import { SecretField } from "./secret-field";
import { WalletSetupModal } from "./wallet-setup-modal";

interface RecipientCardProps {
  recipient: WalletInfo;
  issuer: WalletInfo | null;
  currencies: string[];
  refreshKey: number;
  onRefresh: () => void;
}

export function RecipientCard({
  recipient,
  issuer,
  currencies,
  refreshKey,
  onRefresh,
}: RecipientCardProps) {
  const { state: { network } } = useAppState();
  const [collapsed, setCollapsed] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [trustingRlusd, setTrustingRlusd] = useState(false);
  const [rlusdError, setRlusdError] = useState<string | null>(null);

  const { lines, refetch } = useFetchTrustLines(
    recipient.address,
    network,
    refreshKey,
  );

  const trustLineCurrencies = useMemo(() => {
    if (!issuer) return new Set<string>();
    return new Set(
      lines
        .filter((l) => l.account === issuer.address)
        .map((l) => decodeCurrency(l.currency)),
    );
  }, [lines, issuer]);

  const rlusdIssuer = WELL_KNOWN_CURRENCIES[network]?.RLUSD;
  const hasRlusdTrust = rlusdIssuer
    ? lines.some(
        (l) => l.account === rlusdIssuer && decodeCurrency(l.currency) === Assets.RLUSD,
      )
    : false;

  async function handleTrustRlusd() {
    if (!rlusdIssuer || trustingRlusd) return;
    setTrustingRlusd(true);
    setRlusdError(null);
    try {
      const res = await fetch(`/api/accounts/${recipient.address}/trustlines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed: recipient.seed,
          currency: Assets.RLUSD,
          issuer: rlusdIssuer,
          limit: DEFAULT_TRUST_LINE_LIMIT,
          network,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRlusdError(data.error ?? "Failed to create trust line");
      } else {
        refetch();
        onRefresh();
      }
    } catch {
      setRlusdError("Network error");
    } finally {
      setTrustingRlusd(false);
    }
  }

  function handleSetupComplete() {
    refetch();
    onRefresh();
  }

  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-700">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setCollapsed((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCollapsed((v) => !v); } }}
        aria-expanded={!collapsed}
        className="flex w-full cursor-pointer items-center justify-between p-4 text-left font-mono text-sm"
      >
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">Address: </span>
          <ExplorerLink address={recipient.address} />
        </div>
        <span className="ml-4 text-zinc-400 dark:text-zinc-500">
          {collapsed ? "▸" : "▾"}
        </span>
      </div>

      {!collapsed && (
        <div className="px-4 pb-4">
          <div className="font-mono text-sm">
            <SecretField label="Seed" value={recipient.seed} />
          </div>

          {trustLineCurrencies.size > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {Array.from(trustLineCurrencies).map((currency) => (
                <span
                  key={currency}
                  className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200"
                >
                  {currency}
                </span>
              ))}
            </div>
          )}

          <BalanceDisplay
            address={recipient.address}
            refreshKey={refreshKey}
          />

          {rlusdIssuer && !hasRlusdTrust && (
            <div className="mt-2">
              <button
                onClick={handleTrustRlusd}
                disabled={trustingRlusd}
                className="rounded-md border border-blue-300 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/30"
              >
                {trustingRlusd ? "Creating trust line..." : `Trust ${Assets.RLUSD} (${rlusdIssuer})`}
              </button>
              {rlusdError && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{rlusdError}</p>
              )}
            </div>
          )}

          {issuer && currencies.length > 0 && (
            <div className="mt-2">
              {expanded ? (
                <WalletSetupModal
                  recipient={recipient}
                  issuer={issuer}
                  currencies={currencies}
                  trustLineCurrencies={trustLineCurrencies}
                  onComplete={handleSetupComplete}
                  onClose={() => setExpanded(false)}
                />
              ) : (
                <button
                  onClick={() => setExpanded(true)}
                  className="mt-1 text-sm text-green-600 hover:text-green-800 dark:text-green-400"
                >
                  Receive Currency
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
