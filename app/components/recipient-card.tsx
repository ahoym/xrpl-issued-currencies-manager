"use client";

import { useState } from "react";
import type { PersistedState, WalletInfo } from "@/lib/types";
import { useTrustLines } from "@/lib/hooks/use-trust-lines";
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

  const { trustLineCurrencies, refetch } = useTrustLines(
    recipient.address,
    issuer?.address ?? null,
    network,
    refreshKey,
  );

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
