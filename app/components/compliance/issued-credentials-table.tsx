"use client";

import { useState } from "react";
import type { CredentialInfo, PersistedState } from "@/lib/types";
import { fromRippleEpoch } from "@/lib/xrpl/constants";

interface IssuedCredentialsTableProps {
  credentials: CredentialInfo[];
  loading: boolean;
  issuerSeed: string;
  network: PersistedState["network"];
  onDeleted: () => void;
}

export function IssuedCredentialsTable({
  credentials,
  loading,
  issuerSeed,
  network,
  onDeleted,
}: IssuedCredentialsTableProps) {
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  async function handleDelete(subject: string, credentialType: string) {
    const key = `${subject}:${credentialType}`;
    setDeletingKey(key);
    try {
      const res = await fetch("/api/credentials/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed: issuerSeed,
          subject,
          credentialType,
          network,
        }),
      });
      if (res.ok) onDeleted();
    } catch {
      // ignore
    } finally {
      setDeletingKey(null);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Issued Credentials
      </h3>
      {loading ? (
        <p className="mt-2 text-xs text-zinc-500">Loading...</p>
      ) : credentials.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          No credentials issued yet.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="py-1.5 text-left font-medium text-zinc-600 dark:text-zinc-400">Subject</th>
                <th className="py-1.5 text-left font-medium text-zinc-600 dark:text-zinc-400">Type</th>
                <th className="py-1.5 text-left font-medium text-zinc-600 dark:text-zinc-400">Accepted</th>
                <th className="py-1.5 text-left font-medium text-zinc-600 dark:text-zinc-400">URI</th>
                <th className="py-1.5 text-left font-medium text-zinc-600 dark:text-zinc-400">Expiration</th>
                <th className="py-1.5 text-right font-medium text-zinc-600 dark:text-zinc-400"></th>
              </tr>
            </thead>
            <tbody>
              {credentials.map((c) => {
                const key = `${c.subject}:${c.credentialType}`;
                return (
                  <tr key={key} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-1.5 font-mono">{c.subject}</td>
                    <td className="py-1.5">{c.credentialType}</td>
                    <td className="py-1.5">
                      <span className={c.accepted ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}>
                        {c.accepted ? "Yes" : "Pending"}
                      </span>
                    </td>
                    <td className="py-1.5 font-mono">
                      {c.uri ? (
                        <a href={c.uri} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{c.uri}</a>
                      ) : "\u2014"}
                    </td>
                    <td className="py-1.5">
                      {c.expiration
                        ? fromRippleEpoch(c.expiration).toLocaleString()
                        : "\u2014"}
                    </td>
                    <td className="py-1.5 text-right">
                      <button
                        onClick={() => handleDelete(c.subject, c.credentialType)}
                        disabled={deletingKey === key}
                        className="text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        {deletingKey === key ? "..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
