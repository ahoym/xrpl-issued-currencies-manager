"use client";

export function SecurityWarning() {
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950">
      <p className="text-sm text-amber-800 dark:text-amber-200">
        <strong>Security notice:</strong> Wallet seeds are stored in your browser&apos;s
        localStorage for convenience. This is suitable for testnet/devnet only. Never use this
        tool with mainnet wallets or real funds.
      </p>
    </div>
  );
}
