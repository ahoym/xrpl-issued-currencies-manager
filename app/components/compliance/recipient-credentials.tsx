"use client";

import { useState, useMemo } from "react";
import type { WalletInfo, CredentialInfo, PersistedState } from "@/lib/types";

interface RecipientCredentialsProps {
  recipients: WalletInfo[];
  issuedCredentials: CredentialInfo[];
  network: PersistedState["network"];
  onChanged: () => void;
}

export function RecipientCredentials({
  recipients,
  issuedCredentials,
  network,
  onChanged,
}: RecipientCredentialsProps) {
  const [acceptingKey, setAcceptingKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const credentialsByAddress = useMemo(() => {
    const result: Record<string, CredentialInfo[]> = {};
    for (const r of recipients) {
      result[r.address] = [];
    }
    for (const c of issuedCredentials) {
      if (result[c.subject]) {
        result[c.subject].push(c);
      }
    }
    return result;
  }, [recipients, issuedCredentials]);

  async function handleAccept(recipientSeed: string, issuer: string, credentialType: string) {
    const key = `${issuer}:${credentialType}`;
    setAcceptingKey(key);
    try {
      const res = await fetch("/api/credentials/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: recipientSeed, issuer, credentialType, network }),
      });
      if (res.ok) onChanged();
    } catch {
      // ignore
    } finally {
      setAcceptingKey(null);
    }
  }

  async function handleDelete(senderSeed: string, issuer: string, credentialType: string) {
    const key = `${issuer}:${credentialType}`;
    setDeletingKey(key);
    try {
      const res = await fetch("/api/credentials/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: senderSeed, issuer, credentialType, network }),
      });
      if (res.ok) onChanged();
    } catch {
      // ignore
    } finally {
      setDeletingKey(null);
    }
  }

  if (recipients.length === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Recipient Credentials
      </h3>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Credentials issued to your recipient wallets. Accept or delete from here.
      </p>
      {recipients.map((r) => {
        const creds = credentialsByAddress[r.address] ?? [];
        return (
          <div key={r.address} className="mt-3">
            <p className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
              {r.address}
            </p>
            {creds.length === 0 ? (
              <p className="mt-1 text-xs text-zinc-400">No credentials</p>
            ) : (
              <div className="mt-1 space-y-1">
                {creds.map((c) => {
                  const key = `${c.issuer}:${c.credentialType}`;
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-md bg-zinc-50 px-2 py-1 text-xs dark:bg-zinc-900"
                    >
                      <span>
                        <span className="font-medium">{c.credentialType}</span>
                        {" from "}
                        <span className="font-mono">{c.issuer}</span>
                        {" \u2014 "}
                        <span className={c.accepted ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}>
                          {c.accepted ? "Accepted" : "Pending"}
                        </span>
                      </span>
                      <span className="flex gap-2">
                        {!c.accepted && (
                          <button
                            onClick={() => handleAccept(r.seed, c.issuer, c.credentialType)}
                            disabled={acceptingKey === key}
                            className="text-blue-500 hover:text-blue-700 disabled:opacity-50"
                          >
                            {acceptingKey === key ? "..." : "Accept"}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(r.seed, c.issuer, c.credentialType)}
                          disabled={deletingKey === key}
                          className="text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          {deletingKey === key ? "..." : "Delete"}
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
