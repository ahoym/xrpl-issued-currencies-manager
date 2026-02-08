"use client";

import { useState } from "react";
import type { WalletInfo, PersistedState } from "@/lib/types";
import { RIPPLE_EPOCH_OFFSET } from "@/lib/xrpl/constants";
import { inputClass, labelClass, primaryButtonClass, errorTextClass, successBannerClass } from "@/lib/ui/styles";
import { SUCCESS_MESSAGE_DURATION_MS } from "@/lib/ui/constants";

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
        payload.expiration = Math.floor(epochMs / 1000) - RIPPLE_EPOCH_OFFSET;
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
        setTimeout(() => setSuccess(false), SUCCESS_MESSAGE_DURATION_MS);
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
        <div className={successBannerClass}>
          Credential issued!
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div>
            <label className={labelClass}>
              Subject
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={inputClass}
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
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              Credential Type
            </label>
            <input
              type="text"
              value={credType}
              onChange={(e) => setCredType(e.target.value)}
              placeholder="e.g. KYC"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              Expiration (optional)
            </label>
            <input
              type="datetime-local"
              value={expiration}
              onChange={(e) => setExpiration(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              URI (optional)
            </label>
            <input
              type="text"
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              placeholder="https://..."
              className={inputClass}
            />
          </div>
          {error && (
            <p className={errorTextClass}>{error}</p>
          )}
          <button
            type="submit"
            disabled={submitting || !subject || !credType}
            className={primaryButtonClass}
          >
            {submitting ? "Issuing..." : "Issue Credential"}
          </button>
        </form>
      )}
    </div>
  );
}
