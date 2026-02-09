"use client";

import { useState, useMemo } from "react";
import { useAppState } from "@/lib/hooks/use-app-state";
import { LoadingScreen } from "../components/loading-screen";
import { EmptyWallets } from "../components/empty-wallets";
import { BalanceDisplay } from "../components/balance-display";
import { TransferModal } from "../components/transfer-modal";
import type { WalletInfo } from "@/lib/types";
import { ExplorerLink } from "../components/explorer-link";

export default function TransactPage() {
  const { state, hydrated } = useAppState();
  const [refreshKey, setRefreshKey] = useState(0);
  const [sendingFrom, setSendingFrom] = useState<WalletInfo | null>(null);

  const allWallets = useMemo(() => {
    const wallets = [...state.recipients];
    if (state.issuer && !wallets.some((w) => w.address === state.issuer!.address)) {
      wallets.unshift(state.issuer);
    }
    return wallets;
  }, [state.issuer, state.recipients]);

  if (!hydrated) {
    return <LoadingScreen />;
  }

  if (state.recipients.length === 0) {
    return <EmptyWallets title="Transact" maxWidth="max-w-4xl" />;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">Transact</h1>

      <div className="mt-6 space-y-4">
        {state.recipients.map((wallet) => (
          <WalletCard
            key={wallet.address}
            wallet={wallet}
            refreshKey={refreshKey}
            onSend={() => setSendingFrom(wallet)}
          />
        ))}
      </div>

      {sendingFrom && (
        <TransferModal
          sender={sendingFrom}
          recipients={allWallets}
          onComplete={() => {
            setSendingFrom(null);
            setRefreshKey((k) => k + 1);
          }}
          onClose={() => setSendingFrom(null)}
        />
      )}
    </div>
  );
}

function WalletCard({
  wallet,
  refreshKey,
  onSend,
}: {
  wallet: WalletInfo;
  refreshKey: number;
  onSend: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <p className="min-w-0 truncate font-mono text-sm">
          <ExplorerLink address={wallet.address} />
        </p>
        <span className="ml-4 text-zinc-400 dark:text-zinc-500">
          {collapsed ? "▸" : "▾"}
        </span>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4">
          <BalanceDisplay
            address={wallet.address}
            refreshKey={refreshKey}
          />
          <button
            onClick={onSend}
            className="mt-3 shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
