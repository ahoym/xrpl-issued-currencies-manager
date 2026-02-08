"use client";

import { useState, useEffect } from "react";
import type { WalletInfo, PersistedState } from "@/lib/types";

interface CreateDomainFormProps {
  domainOwner: WalletInfo;
  defaultCredentialIssuer?: string;
  network: PersistedState["network"];
  onCreated: () => void;
}

export function CreateDomainForm({
  domainOwner,
  defaultCredentialIssuer,
  network,
  onCreated,
}: CreateDomainFormProps) {
  const [credentials, setCredentials] = useState<
    { issuer: string; credentialType: string }[]
  >([{ issuer: defaultCredentialIssuer ?? "", credentialType: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Update default issuer when it becomes available
  useEffect(() => {
    if (defaultCredentialIssuer) {
      setCredentials((prev) =>
        prev.map((dc) => ({
          ...dc,
          issuer: dc.issuer || defaultCredentialIssuer,
        })),
      );
    }
  }, [defaultCredentialIssuer]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const valid = credentials.filter((dc) => dc.issuer && dc.credentialType);
    if (valid.length === 0) return;

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/domains/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed: domainOwner.seed,
          acceptedCredentials: valid,
          network,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create domain");
      } else {
        setSuccess(true);
        setCredentials([{ issuer: defaultCredentialIssuer ?? "", credentialType: "" }]);
        onCreated();
        setTimeout(() => setSuccess(false), 2000);
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Create Domain
      </h3>
      {success ? (
        <div className="mt-3 rounded-md bg-green-50 p-3 text-center text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
          Domain created!
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Accepted Credentials
            </label>
            {credentials.map((dc, i) => (
              <div key={i} className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={dc.issuer}
                  onChange={(e) => {
                    const next = [...credentials];
                    next[i] = { ...next[i], issuer: e.target.value };
                    setCredentials(next);
                  }}
                  placeholder="Credential issuer address"
                  className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
                <input
                  type="text"
                  value={dc.credentialType}
                  onChange={(e) => {
                    const next = [...credentials];
                    next[i] = { ...next[i], credentialType: e.target.value };
                    setCredentials(next);
                  }}
                  placeholder="Credential type"
                  className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
                {credentials.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setCredentials((prev) => prev.filter((_, j) => j !== i))}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            {credentials.length < 10 && (
              <button
                type="button"
                onClick={() =>
                  setCredentials((prev) => [
                    ...prev,
                    { issuer: defaultCredentialIssuer ?? "", credentialType: "" },
                  ])
                }
                className="mt-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
              >
                + Add credential
              </button>
            )}
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={submitting || credentials.every((dc) => !dc.issuer || !dc.credentialType)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Domain"}
          </button>
        </form>
      )}
    </div>
  );
}
