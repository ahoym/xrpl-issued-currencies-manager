"use client";

import { useState } from "react";
import type { PersistedState, WalletInfo } from "@/lib/types";

interface WalletSetupModalProps {
  recipient: WalletInfo;
  issuer: WalletInfo;
  currencies: string[];
  network: PersistedState["network"];
  trustLineCurrencies: Set<string>;
  onComplete: () => void;
  onClose: () => void;
}

type SetupStep = "idle" | "trustline" | "issuing" | "done" | "error";

export function WalletSetupModal({
  recipient,
  issuer,
  currencies,
  network,
  trustLineCurrencies,
  onComplete,
  onClose,
}: WalletSetupModalProps) {
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [amount, setAmount] = useState("1000");
  const [step, setStep] = useState<SetupStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [completedCurrency, setCompletedCurrency] = useState("");
  const [completedAmount, setCompletedAmount] = useState("");

  // Derive effective selection: use selectedCurrency if still valid, otherwise first currency
  const effectiveCurrency = currencies.includes(selectedCurrency)
    ? selectedCurrency
    : currencies[0] ?? "";

  const hasTrustLine = trustLineCurrencies.has(effectiveCurrency);

  async function handleSetup() {
    if (!effectiveCurrency) return;
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Amount must be a positive number");
      return;
    }

    // Step 1: Create trust line (skip if already exists on ledger)
    if (!trustLineCurrencies.has(effectiveCurrency)) {
      setStep("trustline");
      try {
        const trustRes = await fetch(`/api/accounts/${recipient.address}/trustlines`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seed: recipient.seed,
            currency: effectiveCurrency,
            issuer: issuer.address,
            limit: "1000000",
            network,
          }),
        });
        const trustData = await trustRes.json();
        if (!trustRes.ok) {
          setError(trustData.error ?? "Failed to create trust line");
          setStep("error");
          return;
        }
      } catch {
        setError("Network error during trust line creation");
        setStep("error");
        return;
      }
    }

    // Step 2: Issue currency
    setStep("issuing");
    try {
      const issueRes = await fetch("/api/currencies/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issuerSeed: issuer.seed,
          recipientAddress: recipient.address,
          currencyCode: effectiveCurrency,
          amount,
          network,
        }),
      });
      const issueData = await issueRes.json();
      if (!issueRes.ok) {
        setError(issueData.error ?? "Failed to issue currency");
        setStep("error");
        return;
      }
    } catch {
      setError("Network error during currency issuance");
      setStep("error");
      return;
    }

    setCompletedCurrency(effectiveCurrency);
    setCompletedAmount(amount);
    onComplete();
    setStep("done");
  }

  const isRunning = step === "trustline" || step === "issuing";

  return (
    <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Receive Currency</h4>
        <button
          onClick={onClose}
          disabled={isRunning}
          className="text-xs text-zinc-500 hover:text-zinc-700 disabled:opacity-50 dark:text-zinc-400"
        >
          Close
        </button>
      </div>

      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        This will submit transactions to the XRPL.
      </p>

      {step === "done" ? (
        <p className="mt-2 text-sm text-green-700 dark:text-green-400">
          Successfully received {Number(completedAmount).toLocaleString()} {completedCurrency} tokens.
        </p>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2">
            <select
              value={effectiveCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              disabled={isRunning}
              className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}{trustLineCurrencies.has(c) ? " (issued)" : ""}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isRunning}
              placeholder="Amount"
              min="0"
              step="any"
              className="w-28 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
            <button
              onClick={handleSetup}
              disabled={isRunning}
              className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {isRunning ? "Working..." : hasTrustLine ? "Issue More" : "Set Up"}
            </button>
          </div>

          {isRunning && (
            <p className="mt-2 text-sm text-blue-600 dark:text-blue-400">
              {step === "trustline" && `Creating trust line for ${effectiveCurrency}...`}
              {step === "issuing" && `Receiving ${Number(amount).toLocaleString()} ${effectiveCurrency}...`}
            </p>
          )}
          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </>
      )}
    </div>
  );
}
