"use client";

import { useState } from "react";
import Link from "next/link";
import { useAppState } from "@/lib/hooks/use-app-state";
import { BalanceDisplay } from "../components/balance-display";
import { TransferModal } from "../components/transfer-modal";
import type { WalletInfo } from "@/lib/types";

export default function TransactPage() {
  const { state, hydrated } = useAppState();
  const [refreshKey, setRefreshKey] = useState(0);
  const [sendingFrom, setSendingFrom] = useState<WalletInfo | null>(null);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    );
  }

  if (state.recipients.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold">Transact</h1>
        <div className="mt-8 rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No recipient wallets found. Set up wallets on the{" "}
            <Link href="/" className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
              Setup page
            </Link>{" "}
            first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Transact</h1>

      <div className="mt-6 space-y-4">
        {state.recipients.map((wallet) => (
          <div
            key={wallet.address}
            className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm text-zinc-900 dark:text-zinc-100">
                  {wallet.address}
                </p>
                <BalanceDisplay
                  address={wallet.address}
                  network={state.network}
                  refreshKey={refreshKey}
                />
              </div>
              <button
                onClick={() => setSendingFrom(wallet)}
                className="ml-4 shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
              >
                Send
              </button>
            </div>
          </div>
        ))}
      </div>

      {sendingFrom && (
        <TransferModal
          sender={sendingFrom}
          network={state.network}
          recipients={state.recipients}
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
