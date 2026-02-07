"use client";

import { useState, useMemo } from "react";
import type { PersistedState, WalletInfo } from "@/lib/types";
import { useFetchTrustLines } from "@/lib/hooks/use-trust-lines";
import { decodeCurrency } from "@/lib/xrpl/decode-currency-client";
import { WELL_KNOWN_CURRENCIES } from "@/lib/well-known-currencies";
import { BalanceDisplay } from "./balance-display";
import { WalletSetupModal } from "./wallet-setup-modal";

interface RecipientCardProps {
  recipient: WalletInfo;
  issuer: WalletInfo | null;
  currencies: string[];
  network: PersistedState["network"];
  refreshKey: number;
  onRefresh: () => void;
}

export function RecipientCard({
  recipient,
  issuer,
  currencies,
  network,
  refreshKey,
  onRefresh,
}: RecipientCardProps) {
  const [showSeed, setShowSeed] = useState(false);
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

  const rlusd = WELL_KNOWN_CURRENCIES.find((c) => c.currency === "RLUSD");
  const hasRlusdTrust = rlusd
    ? lines.some(
        (l) => l.account === rlusd.issuer && decodeCurrency(l.currency) === "RLUSD",
      )
    : false;

  async function handleTrustRlusd() {
    if (!rlusd || trustingRlusd) return;
    setTrustingRlusd(true);
    setRlusdError(null);
    try {
      const res = await fetch(`/api/accounts/${recipient.address}/trustlines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed: recipient.seed,
          currency: rlusd.currency,
          issuer: rlusd.issuer,
          limit: "1000000000",
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
    <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-700">
      <div className="font-mono text-sm">
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">Address: </span>
          {recipient.address}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 dark:text-zinc-400">Seed: </span>
          {showSeed ? (
            <span className="break-all">{recipient.seed}</span>
          ) : (
            <span>••••••••••••</span>
          )}
          <button
            onClick={() => setShowSeed((prev) => !prev)}
            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            {showSeed ? "Hide" : "Show"}
          </button>
        </div>
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
        network={network}
        refreshKey={refreshKey}
      />

      {rlusd && !hasRlusdTrust && (
        <div className="mt-2">
          <button
            onClick={handleTrustRlusd}
            disabled={trustingRlusd}
            className="rounded-md border border-blue-300 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/30"
          >
            {trustingRlusd ? "Creating trust line..." : `Trust RLUSD (${rlusd.issuer})`}
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
              network={network}
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
  );
}
