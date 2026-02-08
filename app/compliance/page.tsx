"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppState } from "@/lib/hooks/use-app-state";
import { LoadingScreen } from "../components/loading-screen";
import type { WalletInfo, CredentialInfo, DomainInfo } from "@/lib/types";

export default function CompliancePage() {
  const {
    state,
    hydrated,
    setCredentialIssuer,
    setDomainOwner,
  } = useAppState();

  // --- Wallet generation ---
  const [genCredLoading, setGenCredLoading] = useState(false);
  const [genDomainLoading, setGenDomainLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  async function generateWallet(
    setter: (w: WalletInfo) => void,
    setLoading: (v: boolean) => void,
  ) {
    setLoading(true);
    setGenError(null);
    try {
      const res = await fetch("/api/accounts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network: state.network }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenError(data.error ?? "Failed to generate wallet");
        return;
      }
      setter({ address: data.address, seed: data.seed, publicKey: data.publicKey });
    } catch {
      setGenError("Network error");
    } finally {
      setLoading(false);
    }
  }

  // --- Credentials state ---
  const [credSubject, setCredSubject] = useState("");
  const [credType, setCredType] = useState("");
  const [credExpiration, setCredExpiration] = useState("");
  const [credUri, setCredUri] = useState("");
  const [credSubmitting, setCredSubmitting] = useState(false);
  const [credError, setCredError] = useState<string | null>(null);
  const [credSuccess, setCredSuccess] = useState(false);

  const [issuedCredentials, setIssuedCredentials] = useState<CredentialInfo[]>([]);
  const [loadingIssued, setLoadingIssued] = useState(false);
  const [recipientCredentials, setRecipientCredentials] = useState<
    Record<string, CredentialInfo[]>
  >({});
  const [deletingCred, setDeletingCred] = useState<string | null>(null);
  const [acceptingCred, setAcceptingCred] = useState<string | null>(null);
  const [credRefreshKey, setCredRefreshKey] = useState(0);

  // --- Domains state ---
  const [domainCredentials, setDomainCredentials] = useState<
    { issuer: string; credentialType: string }[]
  >([{ issuer: state.credentialIssuer?.address ?? "", credentialType: "" }]);
  const [domainSubmitting, setDomainSubmitting] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [domainSuccess, setDomainSuccess] = useState(false);

  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [deletingDomain, setDeletingDomain] = useState<string | null>(null);
  const [domainRefreshKey, setDomainRefreshKey] = useState(0);

  // Fetch issued credentials
  const fetchIssuedCredentials = useCallback(async () => {
    if (!state.credentialIssuer) return;
    setLoadingIssued(true);
    try {
      const res = await fetch(
        `/api/accounts/${state.credentialIssuer.address}/credentials?network=${state.network}&role=issuer`,
      );
      const data = await res.json();
      if (res.ok) {
        setIssuedCredentials(data.credentials ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingIssued(false);
    }
  }, [state.credentialIssuer, state.network]);

  useEffect(() => {
    fetchIssuedCredentials();
  }, [fetchIssuedCredentials, credRefreshKey]);

  // Fetch recipient credentials
  const fetchRecipientCredentials = useCallback(async () => {
    if (state.recipients.length === 0) return;
    const result: Record<string, CredentialInfo[]> = {};
    await Promise.all(
      state.recipients.map(async (r) => {
        try {
          const res = await fetch(
            `/api/accounts/${r.address}/credentials?network=${state.network}&role=subject`,
          );
          const data = await res.json();
          if (res.ok) {
            result[r.address] = data.credentials ?? [];
          }
        } catch {
          // ignore
        }
      }),
    );
    setRecipientCredentials(result);
  }, [state.recipients, state.network]);

  useEffect(() => {
    fetchRecipientCredentials();
  }, [fetchRecipientCredentials, credRefreshKey]);

  // Fetch domains
  const fetchDomains = useCallback(async () => {
    if (!state.domainOwner) return;
    setLoadingDomains(true);
    try {
      const res = await fetch(
        `/api/accounts/${state.domainOwner.address}/domains?network=${state.network}`,
      );
      const data = await res.json();
      if (res.ok) {
        setDomains(data.domains ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingDomains(false);
    }
  }, [state.domainOwner, state.network]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains, domainRefreshKey]);

  // Update default issuer in domain form when credential issuer changes
  useEffect(() => {
    if (state.credentialIssuer) {
      setDomainCredentials((prev) =>
        prev.map((dc) => ({
          ...dc,
          issuer: dc.issuer || state.credentialIssuer!.address,
        })),
      );
    }
  }, [state.credentialIssuer]);

  // --- Handlers ---

  async function handleIssueCredential(e: React.FormEvent) {
    e.preventDefault();
    if (!state.credentialIssuer || !credSubject || !credType) return;
    setCredSubmitting(true);
    setCredError(null);
    setCredSuccess(false);

    const payload: Record<string, unknown> = {
      seed: state.credentialIssuer.seed,
      subject: credSubject,
      credentialType: credType,
      network: state.network,
    };

    if (credExpiration) {
      const epochMs = new Date(credExpiration).getTime();
      if (!isNaN(epochMs)) {
        payload.expiration = Math.floor(epochMs / 1000) - 946684800;
      }
    }

    if (credUri) {
      payload.uri = credUri;
    }

    try {
      const res = await fetch("/api/credentials/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setCredError(data.error ?? "Failed to issue credential");
      } else {
        setCredSuccess(true);
        setCredSubject("");
        setCredType("");
        setCredExpiration("");
        setCredUri("");
        setCredRefreshKey((k) => k + 1);
        setTimeout(() => setCredSuccess(false), 2000);
      }
    } catch {
      setCredError("Network error");
    } finally {
      setCredSubmitting(false);
    }
  }

  async function handleAcceptCredential(
    recipientSeed: string,
    issuer: string,
    credentialType: string,
  ) {
    const key = `${issuer}:${credentialType}`;
    setAcceptingCred(key);
    try {
      const res = await fetch("/api/credentials/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed: recipientSeed,
          issuer,
          credentialType,
          network: state.network,
        }),
      });
      if (res.ok) {
        setCredRefreshKey((k) => k + 1);
      }
    } catch {
      // ignore
    } finally {
      setAcceptingCred(null);
    }
  }

  async function handleDeleteCredential(
    senderSeed: string,
    subject: string | undefined,
    issuer: string | undefined,
    credentialType: string,
  ) {
    const key = `${subject ?? ""}:${issuer ?? ""}:${credentialType}`;
    setDeletingCred(key);
    try {
      const res = await fetch("/api/credentials/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed: senderSeed,
          subject,
          issuer,
          credentialType,
          network: state.network,
        }),
      });
      if (res.ok) {
        setCredRefreshKey((k) => k + 1);
      }
    } catch {
      // ignore
    } finally {
      setDeletingCred(null);
    }
  }

  async function handleCreateDomain(e: React.FormEvent) {
    e.preventDefault();
    if (!state.domainOwner) return;
    const valid = domainCredentials.filter((dc) => dc.issuer && dc.credentialType);
    if (valid.length === 0) return;

    setDomainSubmitting(true);
    setDomainError(null);
    setDomainSuccess(false);

    try {
      const res = await fetch("/api/domains/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed: state.domainOwner.seed,
          acceptedCredentials: valid,
          network: state.network,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDomainError(data.error ?? "Failed to create domain");
      } else {
        setDomainSuccess(true);
        setDomainCredentials([
          { issuer: state.credentialIssuer?.address ?? "", credentialType: "" },
        ]);
        setDomainRefreshKey((k) => k + 1);
        setTimeout(() => setDomainSuccess(false), 2000);
      }
    } catch {
      setDomainError("Network error");
    } finally {
      setDomainSubmitting(false);
    }
  }

  async function handleDeleteDomain(domainID: string) {
    if (!state.domainOwner) return;
    setDeletingDomain(domainID);
    try {
      const res = await fetch("/api/domains/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed: state.domainOwner.seed,
          domainID,
          network: state.network,
        }),
      });
      if (res.ok) {
        setDomainRefreshKey((k) => k + 1);
      }
    } catch {
      // ignore
    } finally {
      setDeletingDomain(null);
    }
  }

  // --- Render ---

  if (!hydrated) return <LoadingScreen />;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">Compliance</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Manage credentials (XLS-70) and permissioned domains (XLS-80).
      </p>

      {/* Wallet Setup */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {/* Credential Issuer Wallet */}
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Credential Issuer
          </h3>
          {state.credentialIssuer ? (
            <div className="mt-2 rounded-md bg-zinc-50 p-2 font-mono text-xs dark:bg-zinc-900">
              <span className="text-zinc-500 dark:text-zinc-400">Address: </span>
              <span className="break-all">{state.credentialIssuer.address}</span>
            </div>
          ) : (
            <button
              onClick={() => generateWallet(setCredentialIssuer, setGenCredLoading)}
              disabled={genCredLoading}
              className="mt-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {genCredLoading ? "Generating..." : "Generate Wallet"}
            </button>
          )}
        </div>

        {/* Domain Owner Wallet */}
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Domain Owner
          </h3>
          {state.domainOwner ? (
            <div className="mt-2 rounded-md bg-zinc-50 p-2 font-mono text-xs dark:bg-zinc-900">
              <span className="text-zinc-500 dark:text-zinc-400">Address: </span>
              <span className="break-all">{state.domainOwner.address}</span>
            </div>
          ) : (
            <button
              onClick={() => generateWallet(setDomainOwner, setGenDomainLoading)}
              disabled={genDomainLoading}
              className="mt-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {genDomainLoading ? "Generating..." : "Generate Wallet"}
            </button>
          )}
        </div>
      </div>

      {genError && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{genError}</p>
      )}

      {/* Credentials Section */}
      {state.credentialIssuer && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Credentials</h2>

          {/* Issue Credential Form */}
          <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Issue Credential
            </h3>
            {credSuccess ? (
              <div className="mt-3 rounded-md bg-green-50 p-3 text-center text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Credential issued!
              </div>
            ) : (
              <form onSubmit={handleIssueCredential} className="mt-3 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Subject
                  </label>
                  <select
                    value={credSubject}
                    onChange={(e) => setCredSubject(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <option value="">Select recipient...</option>
                    {state.recipients.map((r) => (
                      <option key={r.address} value={r.address}>
                        {r.address}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={credSubject}
                    onChange={(e) => setCredSubject(e.target.value)}
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
                    value={credExpiration}
                    onChange={(e) => setCredExpiration(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    URI (optional)
                  </label>
                  <input
                    type="text"
                    value={credUri}
                    onChange={(e) => setCredUri(e.target.value)}
                    placeholder="https://..."
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
                {credError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{credError}</p>
                )}
                <button
                  type="submit"
                  disabled={credSubmitting || !credSubject || !credType}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {credSubmitting ? "Issuing..." : "Issue Credential"}
                </button>
              </form>
            )}
          </div>

          {/* Issued Credentials Table */}
          <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Issued Credentials
            </h3>
            {loadingIssued ? (
              <p className="mt-2 text-xs text-zinc-500">Loading...</p>
            ) : issuedCredentials.length === 0 ? (
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
                      <th className="py-1.5 text-left font-medium text-zinc-600 dark:text-zinc-400">Expiration</th>
                      <th className="py-1.5 text-right font-medium text-zinc-600 dark:text-zinc-400"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {issuedCredentials.map((c) => {
                      const delKey = `${c.subject}:${c.issuer}:${c.credentialType}`;
                      return (
                        <tr key={delKey} className="border-b border-zinc-100 dark:border-zinc-800">
                          <td className="py-1.5 font-mono">{c.subject.slice(0, 12)}...</td>
                          <td className="py-1.5">{c.credentialType}</td>
                          <td className="py-1.5">
                            <span className={c.accepted ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}>
                              {c.accepted ? "Yes" : "Pending"}
                            </span>
                          </td>
                          <td className="py-1.5">
                            {c.expiration
                              ? new Date((c.expiration + 946684800) * 1000).toLocaleString()
                              : "—"}
                          </td>
                          <td className="py-1.5 text-right">
                            <button
                              onClick={() =>
                                handleDeleteCredential(
                                  state.credentialIssuer!.seed,
                                  c.subject,
                                  undefined,
                                  c.credentialType,
                                )
                              }
                              disabled={deletingCred === delKey}
                              className="text-red-500 hover:text-red-700 disabled:opacity-50"
                            >
                              {deletingCred === delKey ? "..." : "Delete"}
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

          {/* Recipient Credentials */}
          {state.recipients.length > 0 && (
            <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Recipient Credentials
              </h3>
              {state.recipients.map((r) => {
                const creds = recipientCredentials[r.address] ?? [];
                return (
                  <div key={r.address} className="mt-3">
                    <p className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {r.address.slice(0, 16)}...
                    </p>
                    {creds.length === 0 ? (
                      <p className="mt-1 text-xs text-zinc-400">No credentials</p>
                    ) : (
                      <div className="mt-1 space-y-1">
                        {creds.map((c) => {
                          const accKey = `${c.issuer}:${c.credentialType}`;
                          const delKey = `${c.subject}:${c.issuer}:${c.credentialType}`;
                          return (
                            <div
                              key={accKey}
                              className="flex items-center justify-between rounded-md bg-zinc-50 px-2 py-1 text-xs dark:bg-zinc-900"
                            >
                              <span>
                                <span className="font-medium">{c.credentialType}</span>
                                {" from "}
                                <span className="font-mono">{c.issuer.slice(0, 12)}...</span>
                                {" — "}
                                <span className={c.accepted ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}>
                                  {c.accepted ? "Accepted" : "Pending"}
                                </span>
                              </span>
                              <span className="flex gap-2">
                                {!c.accepted && (
                                  <button
                                    onClick={() =>
                                      handleAcceptCredential(r.seed, c.issuer, c.credentialType)
                                    }
                                    disabled={acceptingCred === accKey}
                                    className="text-blue-500 hover:text-blue-700 disabled:opacity-50"
                                  >
                                    {acceptingCred === accKey ? "..." : "Accept"}
                                  </button>
                                )}
                                <button
                                  onClick={() =>
                                    handleDeleteCredential(r.seed, undefined, c.issuer, c.credentialType)
                                  }
                                  disabled={deletingCred === delKey}
                                  className="text-red-500 hover:text-red-700 disabled:opacity-50"
                                >
                                  {deletingCred === delKey ? "..." : "Delete"}
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
          )}
        </section>
      )}

      {/* Domains Section */}
      {state.domainOwner && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Permissioned Domains</h2>

          {/* Create Domain Form */}
          <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Create Domain
            </h3>
            {domainSuccess ? (
              <div className="mt-3 rounded-md bg-green-50 p-3 text-center text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Domain created!
              </div>
            ) : (
              <form onSubmit={handleCreateDomain} className="mt-3 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Accepted Credentials
                  </label>
                  {domainCredentials.map((dc, i) => (
                    <div key={i} className="mt-1 flex gap-2">
                      <input
                        type="text"
                        value={dc.issuer}
                        onChange={(e) => {
                          const next = [...domainCredentials];
                          next[i] = { ...next[i], issuer: e.target.value };
                          setDomainCredentials(next);
                        }}
                        placeholder="Credential issuer address"
                        className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                      />
                      <input
                        type="text"
                        value={dc.credentialType}
                        onChange={(e) => {
                          const next = [...domainCredentials];
                          next[i] = { ...next[i], credentialType: e.target.value };
                          setDomainCredentials(next);
                        }}
                        placeholder="Credential type"
                        className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                      />
                      {domainCredentials.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setDomainCredentials((prev) => prev.filter((_, j) => j !== i))
                          }
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  {domainCredentials.length < 10 && (
                    <button
                      type="button"
                      onClick={() =>
                        setDomainCredentials((prev) => [
                          ...prev,
                          { issuer: state.credentialIssuer?.address ?? "", credentialType: "" },
                        ])
                      }
                      className="mt-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    >
                      + Add credential
                    </button>
                  )}
                </div>
                {domainError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{domainError}</p>
                )}
                <button
                  type="submit"
                  disabled={
                    domainSubmitting ||
                    domainCredentials.every((dc) => !dc.issuer || !dc.credentialType)
                  }
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {domainSubmitting ? "Creating..." : "Create Domain"}
                </button>
              </form>
            )}
          </div>

          {/* My Domains Table */}
          <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              My Domains
            </h3>
            {loadingDomains ? (
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
                        onClick={() => handleDeleteDomain(d.domainID)}
                        disabled={deletingDomain === d.domainID}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        {deletingDomain === d.domainID ? "Deleting..." : "Delete"}
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
        </section>
      )}
    </div>
  );
}
