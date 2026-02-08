"use client";

import { useState } from "react";
import type { WalletInfo, PersistedState } from "@/lib/types";

interface IssueCredentialFormProps {
  credentialIssuer: WalletInfo;
  recipients: WalletInfo[];
  network: PersistedState["network"];
  onIssued: () => void;
}

export function IssueCredentialForm({
  credentialIssuer,
  recipients,
  network,
  onIssued,
}: IssueCredentialFormProps) {
  const [subject, setSubject] = useState("");
  const [credType, setCredType] = useState("");
  const [expiration, setExpiration] = useState("");
  const [uri, setUri] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject || !credType) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const payload: Record<string, unknown> = {
      seed: credentialIssuer.seed,
      subject,
      credentialType: credType,
      network,
    };

    if (expiration) {
      const epochMs = new Date(expiration).getTime();
      if (!isNaN(epochMs)) {
        payload.expiration = Math.floor(epochMs / 1000) - 946684800;
      }
    }

    if (uri) {
      payload.uri = uri;
    }

    try {
      const res = await fetch("/api/credentials/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to issue credential");
      } else {
        setSuccess(true);
        setSubject("");
        setCredType("");
        setExpiration("");
        setUri("");
        onIssued();
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
        Issue Credential
      </h3>
      {success ? (
        <div className="mt-3 rounded-md bg-green-50 p-3 text-center text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
          Credential issued!
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Subject
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="">Select recipient...</option>
              {recipients.map((r) => (
                <option key={r.address} value={r.address}>
                  {r.address}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Or enter address manually"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Credential Type
            </label>
            <input
              type="text"
              value={credType}
              onChange={(e) => setCredType(e.target.value)}
              placeholder="e.g. KYC"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Expiration (optional)
            </label>
            <input
              type="datetime-local"
              value={expiration}
              onChange={(e) => setExpiration(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              URI (optional)
            </label>
            <input
              type="text"
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              placeholder="https://..."
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={submitting || !subject || !credType}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Issuing..." : "Issue Credential"}
          </button>
        </form>
      )}
    </div>
  );
}
