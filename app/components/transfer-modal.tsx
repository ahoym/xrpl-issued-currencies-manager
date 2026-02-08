"use client";

import { useState, useEffect, useCallback } from "react";
import type { WalletInfo, PersistedState, BalanceEntry } from "@/lib/types";
import { decodeCurrency } from "@/lib/xrpl/decode-currency-client";
import { LSF_DEFAULT_RIPPLE } from "@/lib/xrpl/constants";
import { errorTextClass } from "@/lib/ui/styles";
import { SUCCESS_MESSAGE_DURATION_MS } from "@/lib/ui/constants";

interface TransferModalProps {
  sender: WalletInfo;
  network: PersistedState["network"];
  recipients: WalletInfo[];
  onComplete: () => void;
  onClose: () => void;
}

export function TransferModal({
  sender,
  network,
  recipients,
  onComplete,
  onClose,
}: TransferModalProps) {
  const [balances, setBalances] = useState<BalanceEntry[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [amount, setAmount] = useState("");
  const [recipientMode, setRecipientMode] = useState<"known" | "other">("known");
  const [selectedRecipient, setSelectedRecipient] = useState("");
  const [customRecipient, setCustomRecipient] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [trustLineOk, setTrustLineOk] = useState<boolean | null>(null);
  const [checkingTrustLine, setCheckingTrustLine] = useState(false);
  const [ripplingOk, setRipplingOk] = useState<boolean | null>(null);

  const otherRecipients = recipients.filter((r) => r.address !== sender.address);

  const fetchBalances = useCallback(async () => {
    setLoadingBalances(true);
    try {
      const res = await fetch(
        `/api/accounts/${sender.address}/balances?network=${network}`,
      );
      const data = await res.json();
      if (res.ok) {
        setBalances(data.balances);
        if (data.balances.length > 0) {
          setSelectedCurrency("0");
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingBalances(false);
    }
  }, [sender.address, network]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  useEffect(() => {
    if (otherRecipients.length > 0 && !selectedRecipient) {
      setSelectedRecipient(otherRecipients[0].address);
    }
  }, [otherRecipients, selectedRecipient]);

  const selectedBalance = balances[parseInt(selectedCurrency)] || null;

  const destinationAddress =
    recipientMode === "known" ? selectedRecipient : customRecipient.trim();

  // Check if the recipient has a trust line and the issuer has rippling enabled
  useEffect(() => {
    if (!selectedBalance || selectedBalance.currency === "XRP" || !destinationAddress) {
      setTrustLineOk(null);
      setRipplingOk(null);
      return;
    }

    let cancelled = false;
    setCheckingTrustLine(true);
    setTrustLineOk(null);
    setRipplingOk(null);

    (async () => {
      try {
        const res = await fetch(
          `/api/accounts/${destinationAddress}/trustlines?network=${network}`,
        );
        if (!res.ok || cancelled) {
          if (!cancelled) setTrustLineOk(null);
          return;
        }
        const data = await res.json();
        const lines: { currency: string; account: string }[] = data.trustLines ?? [];
        const match = lines.some(
          (l) => l.account === selectedBalance.issuer &&
            (l.currency === selectedBalance.currency ||
              // handle hex-encoded currency codes
              decodeCurrency(l.currency) === selectedBalance.currency),
        );
        if (!cancelled) setTrustLineOk(match);

        // If trust line exists and sender is not the issuer, check rippling
        if (match && selectedBalance.issuer && sender.address !== selectedBalance.issuer) {
          try {
            const issuerRes = await fetch(
              `/api/accounts/${selectedBalance.issuer}?network=${network}`,
            );
            if (issuerRes.ok && !cancelled) {
              const issuerData = await issuerRes.json();
              const flags: number = issuerData.account_data?.Flags ?? 0;
              if (!cancelled) setRipplingOk((flags & LSF_DEFAULT_RIPPLE) !== 0);
            }
          } catch {
            // non-fatal — leave as null
          }
        }
      } catch {
        if (!cancelled) setTrustLineOk(null);
      } finally {
        if (!cancelled) setCheckingTrustLine(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedBalance, destinationAddress, network, sender.address]);

  const currencyLabel = (b: BalanceEntry) => {
    if (b.currency === "XRP") return `XRP (${b.value})`;
    const issuerLabel = b.issuer ? ` — ${b.issuer}` : "";
    return `${b.currency} (${b.value}${issuerLabel})`;
  };

  const amountValid =
    amount !== "" &&
    !isNaN(parseFloat(amount)) &&
    parseFloat(amount) > 0 &&
    selectedBalance !== null &&
    parseFloat(amount) <= parseFloat(selectedBalance.value);

  const isIssuedCurrency = selectedBalance !== null && selectedBalance.currency !== "XRP";
  const trustLineBlocked = isIssuedCurrency && trustLineOk === false;
  const ripplingBlocked = isIssuedCurrency && trustLineOk === true && ripplingOk === false;

  const canSubmit =
    !submitting && amountValid && destinationAddress.length > 0 && selectedBalance !== null && !trustLineBlocked && !ripplingBlocked;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !selectedBalance) return;

    setSubmitting(true);
    setError(null);

    const isXrp = selectedBalance.currency === "XRP";

    const payload: Record<string, string> = {
      senderSeed: sender.seed,
      recipientAddress: destinationAddress,
      currencyCode: selectedBalance.currency,
      amount,
      network,
    };

    if (!isXrp && selectedBalance.issuer) {
      payload.issuerAddress = selectedBalance.issuer;
    }

    try {
      const res = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Transfer failed");
      } else {
        setSuccess(true);
        setTimeout(() => {
          onComplete();
        }, SUCCESS_MESSAGE_DURATION_MS);
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Send Currency
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            ✕
          </button>
        </div>

        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          From: <span className="font-mono">{sender.address}</span>
        </p>

        {success ? (
          <div className="mt-6 rounded-md bg-green-50 p-4 text-center text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Transfer successful!
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Currency
              </label>
              {loadingBalances ? (
                <p className="mt-1 text-xs text-zinc-500">Loading balances...</p>
              ) : balances.length === 0 ? (
                <p className="mt-1 text-xs text-zinc-500">No balances found</p>
              ) : (
                <select
                  value={selectedCurrency}
                  onChange={(e) => {
                    setSelectedCurrency(e.target.value);
                    setAmount("");
                  }}
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                >
                  {balances.map((b, i) => (
                    <option key={i} value={String(i)}>
                      {currencyLabel(b)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Amount
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={
                  selectedBalance
                    ? `Max: ${selectedBalance.value}`
                    : "0.00"
                }
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              {amount !== "" && !amountValid && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  Enter a valid amount within your balance
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Recipient
              </label>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setRecipientMode("known")}
                  aria-pressed={recipientMode === "known"}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${
                    recipientMode === "known"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  Known wallet
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientMode("other")}
                  aria-pressed={recipientMode === "other"}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${
                    recipientMode === "other"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  Other
                </button>
              </div>
              {recipientMode === "known" ? (
                otherRecipients.length === 0 ? (
                  <p className="mt-2 text-xs text-zinc-500">
                    No other wallets available
                  </p>
                ) : (
                  <select
                    value={selectedRecipient}
                    onChange={(e) => setSelectedRecipient(e.target.value)}
                    className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    {otherRecipients.map((r) => (
                      <option key={r.address} value={r.address}>
                        {r.address}
                      </option>
                    ))}
                  </select>
                )
              ) : (
                <input
                  type="text"
                  value={customRecipient}
                  onChange={(e) => setCustomRecipient(e.target.value)}
                  placeholder="rXXXXXXXX..."
                  className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
              )}
            </div>

            {isIssuedCurrency && destinationAddress && (
              checkingTrustLine ? (
                <p className="text-xs text-zinc-500">Checking trust line...</p>
              ) : trustLineOk === false ? (
                <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  Recipient does not have a trust line for {selectedBalance?.currency}. Set one up on the Setup page first.
                </p>
              ) : trustLineOk === true ? (
                ripplingOk === false ? (
                  <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    Trust line exists, but the issuer does not have rippling enabled. Enable it on the Setup page to allow peer-to-peer transfers.
                  </p>
                ) : (
                  <p className="text-xs text-green-600 dark:text-green-400">Trust line verified</p>
                )
              ) : null
            )}

            {error && (
              <p className={errorTextClass}>{error}</p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-600"
            >
              {submitting ? "Sending..." : "Send"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
