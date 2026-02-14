"use client";

import { useState, useMemo } from "react";
import type { WalletInfo } from "@/lib/types";
import { useFetchTrustLines } from "@/lib/hooks/use-trust-lines";
import { decodeCurrency } from "@/lib/xrpl/decode-currency-client";
import { DEFAULT_TRUST_LINE_LIMIT } from "@/lib/xrpl/constants";
import { Assets, WELL_KNOWN_CURRENCIES } from "@/lib/assets";
import { useAppState } from "@/lib/hooks/use-app-state";
import { errorTextClass } from "@/lib/ui/ui";
import { BalanceDisplay } from "../../components/balance-display";
import { ExplorerLink } from "../../components/explorer-link";
import { SecretField } from "./secret-field";
import { WalletSetupModal } from "./wallet-setup-modal";
import { TrustLineList } from "./trust-line-list";
import { CustomTrustLineForm } from "./custom-trust-line-form";

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
  const [showCustomTrust, setShowCustomTrust] = useState(false);
  const [trustingRlusd, setTrustingRlusd] = useState(false);
  const [rlusdError, setRlusdError] = useState<string | null>(null);
  const [funding, setFunding] = useState(false);
  const [fundResult, setFundResult] = useState<string | null>(null);
  const [fundError, setFundError] = useState<string | null>(null);

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

  const allTrustLineBadges = useMemo(() => {
    const badges: { currency: string; issuerAddress: string; isLocal: boolean }[] = [];
    const seen = new Set<string>();
    for (const line of lines) {
      const key = `${line.currency}:${line.account}`;
      if (seen.has(key)) continue;
      seen.add(key);
      badges.push({
        currency: decodeCurrency(line.currency),
        issuerAddress: line.account,
        isLocal: issuer !== null && line.account === issuer.address,
      });
    }
    return badges;
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

  async function handleFund() {
    setFunding(true);
    setFundResult(null);
    setFundError(null);
    try {
      const res = await fetch(`/api/accounts/${recipient.address}/fund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFundError(data.error ?? "Faucet request failed");
      } else {
        setFundResult(`Funded ${data.amount} XRP`);
      }
    } catch {
      setFundError("Network error — could not reach faucet");
    } finally {
      setFunding(false);
    }
  }

  function handleTrustLineCreated() {
    refetch();
    onRefresh();
    setShowCustomTrust(false);
  }

  function handleSetupComplete() {
    refetch();
    onRefresh();
  }

  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-700">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className="flex w-full cursor-pointer items-center justify-between bg-transparent border-none p-4 text-left font-mono text-sm"
      >
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">Address: </span>
          <ExplorerLink address={recipient.address} />
        </div>
        <span className="ml-4 text-zinc-400 dark:text-zinc-500">
          {collapsed ? "▸" : "▾"}
        </span>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4">
          <div className="font-mono text-sm">
            <SecretField label="Seed" value={recipient.seed} />
          </div>

          <TrustLineList badges={allTrustLineBadges} />

          <BalanceDisplay
            address={recipient.address}
            refreshKey={refreshKey}
          />

          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={handleFund}
              disabled={funding}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50"
            >
              {funding ? "Requesting..." : "Fund from Faucet"}
            </button>
            {fundResult && <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{fundResult}</span>}
            {fundError && <span className={`text-xs ${errorTextClass}`}>{fundError}</span>}
          </div>

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

          <div className="mt-2">
            <button
              onClick={() => setShowCustomTrust((v) => !v)}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              {showCustomTrust ? "Cancel" : "Add Custom Trust Line"}
            </button>
            {showCustomTrust && (
              <CustomTrustLineForm
                recipientAddress={recipient.address}
                recipientSeed={recipient.seed}
                network={network}
                onSuccess={handleTrustLineCreated}
              />
            )}
          </div>

          {issuer && currencies.length > 0 ? (
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
          ) : !issuer ? (
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
              Set up an issuer to issue your own currencies to this recipient
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
