"use client";

import { useState } from "react";
import type { WalletInfo } from "@/lib/types";
import { useAppState } from "@/lib/hooks/use-app-state";
import { toRippleEpoch } from "@/lib/xrpl/constants";
import { inputClass, labelClass, primaryButtonClass, errorTextClass, successBannerClass, SUCCESS_MESSAGE_DURATION_MS } from "@/lib/ui/ui";

interface IssueCredentialFormProps {
  credentialIssuer: WalletInfo;
  recipients: WalletInfo[];
  onIssued: () => void;
}

export function IssueCredentialForm({
  credentialIssuer,
  recipients,
  onIssued,
}: IssueCredentialFormProps) {
  const { state: { network } } = useAppState();
  const [subject, setSubject] = useState("");
  const [credType, setCredType] = useState("");
  const [expiration, setExpiration] = useState("");
  const [uri, setUri] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

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
        payload.expiration = toRippleEpoch(epochMs);
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
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Issue Credential
        </h3>
        <span className="ml-4 text-zinc-400 dark:text-zinc-500">
          {collapsed ? "▸" : "▾"}
        </span>
      </button>
      {!collapsed && (success ? (
        <div className={`mx-4 mb-4 ${successBannerClass}`}>
          Credential issued!
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3 px-4 pb-4">
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
      ))}
    </div>
  );
}
