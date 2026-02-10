"use client";

import type { WalletInfo } from "@/lib/types";
import { useWalletGeneration } from "@/lib/hooks/use-wallet-generation";
import { useAppState } from "@/lib/hooks/use-app-state";
import { RecipientCard } from "./recipient-card";

interface RecipientWalletsProps {
  recipients: WalletInfo[];
  issuer: WalletInfo | null;
  currencies: string[];
  refreshKey: number;
  onGenerate: (wallet: WalletInfo) => void;
  onRefresh: () => void;
}

export function RecipientWallets({
  recipients,
  issuer,
  currencies,
  refreshKey,
  onGenerate,
  onRefresh,
}: RecipientWalletsProps) {
  const { state: { network } } = useAppState();
  const { loading, error, generate } = useWalletGeneration();

  return (
    <section
      className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800"
    >
      <h2 className="text-lg font-semibold">3. Recipient Wallets</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Generate recipient wallets and issue currencies to them on the XRPL.
        {!issuer && " Set up an issuer wallet above to issue your own currencies, or use the custom trust line form to connect to any external issuer."}
      </p>

      <div className="mt-4">
        <button
          onClick={() => generate(network, onGenerate)}
          disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Generating..." : "Generate Recipient Wallet"}
        </button>
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      {recipients.length > 0 && (
        <div className="mt-4 space-y-4">
          {recipients.map((recipient) => (
            <RecipientCard
              key={recipient.address}
              recipient={recipient}
              issuer={issuer}
              currencies={currencies}
              refreshKey={refreshKey}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </section>
  );
}
