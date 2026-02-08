"use client";

import type { WalletInfo } from "@/lib/types";
import { ExplorerLink } from "./explorer-link";

interface WalletSetupCardProps {
  title: string;
  wallet: WalletInfo | null;
  loading: boolean;
  onGenerate: () => void;
}

export function WalletSetupCard({
  title,
  wallet,
  loading,
  onGenerate,
}: WalletSetupCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h3>
      {wallet ? (
        <div className="mt-2 rounded-md bg-zinc-50 p-2 font-mono text-xs dark:bg-zinc-900">
          <span className="text-zinc-500 dark:text-zinc-400">Address: </span>
          <ExplorerLink address={wallet.address} />
        </div>
      ) : (
        <button
          onClick={onGenerate}
          disabled={loading}
          className="mt-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Generating..." : "Generate Wallet"}
        </button>
      )}
    </div>
  );
}
