"use client";

import { useState } from "react";
import type { DomainInfo, WalletInfo } from "@/lib/types";
import { useAppState } from "@/lib/hooks/use-app-state";

interface DomainsListProps {
  domains: DomainInfo[];
  loading: boolean;
  domainOwner: WalletInfo;
  onDeleted: () => void;
  onEdit: (domain: DomainInfo) => void;
}

export function DomainsList({
  domains,
  loading,
  domainOwner,
  onDeleted,
  onEdit,
}: DomainsListProps) {
  const { state: { network } } = useAppState();
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
                  {d.domainID}
                </span>
                <span className="flex gap-2">
                  <button
                    onClick={() => onEdit(d)}
                    className="text-xs text-blue-500 hover:text-blue-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(d.domainID)}
                    disabled={deletingID === d.domainID}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                  >
                    {deletingID === d.domainID ? "Deleting..." : "Delete"}
                  </button>
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Owner: <span className="font-mono text-zinc-700 dark:text-zinc-300">{d.owner}</span>
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-700">
                      <th className="py-1 text-left font-medium text-zinc-600 dark:text-zinc-400">Credential Type</th>
                      <th className="py-1 text-left font-medium text-zinc-600 dark:text-zinc-400">Issuer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.acceptedCredentials.map((ac) => (
                      <tr key={`${ac.issuer}:${ac.credentialType}`} className="border-b border-zinc-100 dark:border-zinc-800">
                        <td className="py-1">{ac.credentialType}</td>
                        <td className="py-1 font-mono">{ac.issuer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
