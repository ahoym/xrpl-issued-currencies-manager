"use client";

import type { WalletInfo } from "@/lib/types";

interface WalletSelectorProps {
  wallets: WalletInfo[];
  focusedAddress: string | undefined;
  onSelect: (wallet: WalletInfo) => void;
}

export function WalletSelector({ wallets, focusedAddress, onSelect }: WalletSelectorProps) {
  return (
    <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
      {wallets.map((wallet) => (
        <button
          key={wallet.address}
          onClick={() => onSelect(wallet)}
          className={`shrink-0 rounded-lg border px-4 py-2 text-left transition-colors ${
            focusedAddress === wallet.address
              ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500 dark:border-blue-400 dark:bg-blue-900/20 dark:ring-blue-400"
              : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-zinc-600"
          }`}
        >
          <p className="font-mono text-xs text-zinc-900 dark:text-zinc-100">
            {wallet.address}
          </p>
        </button>
      ))}
    </div>
  );
}
