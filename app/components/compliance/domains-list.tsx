"use client";

import { useState } from "react";
import type { DomainInfo, WalletInfo, PersistedState } from "@/lib/types";

interface DomainsListProps {
  domains: DomainInfo[];
  loading: boolean;
  domainOwner: WalletInfo;
  network: PersistedState["network"];
  onDeleted: () => void;
}

export function DomainsList({
  domains,
  loading,
  domainOwner,
  network,
  onDeleted,
}: DomainsListProps) {
  const [deletingID, setDeletingID] = useState<string | null>(null);

  async function handleDelete(domainID: string) {
    setDeletingID(domainID);
    try {
      const res = await fetch("/api/domains/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: domainOwner.seed, domainID, network }),
      });
      if (res.ok) onDeleted();
    } catch {
      // ignore
    } finally {
      setDeletingID(null);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        My Domains
      </h3>
      {loading ? (
        <p className="mt-2 text-xs text-zinc-500">Loading...</p>
      ) : domains.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          No domains created yet.
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          {domains.map((d) => (
            <div
              key={d.domainID}
              className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                  {d.domainID.slice(0, 16)}...
                </span>
                <button
                  onClick={() => handleDelete(d.domainID)}
                  disabled={deletingID === d.domainID}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  {deletingID === d.domainID ? "Deleting..." : "Delete"}
                </button>
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Accepted:{" "}
                {d.acceptedCredentials
                  .map((ac) => `${ac.credentialType} (${ac.issuer.slice(0, 8)}...)`)
                  .join(", ")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
