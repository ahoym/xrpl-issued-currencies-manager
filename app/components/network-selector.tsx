"use client";

import type { PersistedState } from "@/lib/types";

interface NetworkSelectorProps {
  network: PersistedState["network"];
  onChange: (network: PersistedState["network"]) => void;
}

const explorerUrls: Record<PersistedState["network"], string> = {
  testnet: "https://testnet.xrpl.org",
  devnet: "https://devnet.xrpl.org",
};

export function NetworkSelector({ network, onChange }: NetworkSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      <a
        href={explorerUrls[network]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        Network
      </a>
      <select
        id="network"
        value={network}
        onChange={(e) => onChange(e.target.value as PersistedState["network"])}
        className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="testnet">Testnet</option>
        <option value="devnet">Devnet</option>
      </select>
    </div>
  );
}
