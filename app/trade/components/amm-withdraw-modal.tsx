"use client";

import { useState } from "react";
import type { AmmPoolInfo } from "@/lib/types";
import type { CurrencyOption } from "@/lib/hooks/use-trading-data";
import { useApiMutation } from "@/lib/hooks/use-api-mutation";
import { ModalShell } from "@/app/components/modal-shell";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  errorTextClass,
  successBannerClass,
  SUCCESS_MESSAGE_DURATION_MS,
} from "@/lib/ui/ui";

interface AmmWithdrawModalProps {
  pool: AmmPoolInfo;
  baseCurrency: CurrencyOption;
  quoteCurrency: CurrencyOption;
  walletSeed: string;
  network: string;
  onClose: () => void;
  onSuccess: () => void;
}

type WithdrawMode = "withdraw-all" | "two-asset" | "single-asset";

interface WithdrawResponse {
  poolDeleted?: boolean;
  [key: string]: unknown;
}

export function AmmWithdrawModal({
  pool,
  baseCurrency,
  quoteCurrency,
  walletSeed,
  network,
  onClose,
  onSuccess,
}: AmmWithdrawModalProps) {
  const [mode, setMode] = useState<WithdrawMode>("withdraw-all");
  const [amount1, setAmount1] = useState("");
  const [amount2, setAmount2] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<"base" | "quote">("base");
  const [singleAmount, setSingleAmount] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { loading, error, mutate } = useApiMutation<WithdrawResponse>();

  const selectedCurrency =
    selectedAsset === "base" ? baseCurrency.currency : quoteCurrency.currency;
  const selectedIssuer =
    selectedAsset === "base" ? baseCurrency.issuer : quoteCurrency.issuer;

  const lpTokenBalance = pool.lpToken?.value ?? "0";

  const isSubmitDisabled =
    loading ||
    (mode === "two-asset"
      ? amount1.trim() === "" || amount2.trim() === ""
      : mode === "single-asset"
        ? singleAmount.trim() === ""
        : false);

  async function handleSubmit() {
    const body: Record<string, unknown> = {
      seed: walletSeed,
      asset: {
        currency: baseCurrency.currency,
        issuer: baseCurrency.issuer,
      },
      asset2: {
        currency: quoteCurrency.currency,
        issuer: quoteCurrency.issuer,
      },
      mode,
      network,
    };

    if (mode === "two-asset") {
      body.amount = {
        currency: baseCurrency.currency,
        issuer: baseCurrency.issuer,
        value: amount1,
      };
      body.amount2 = {
        currency: quoteCurrency.currency,
        issuer: quoteCurrency.issuer,
        value: amount2,
      };
    } else if (mode === "single-asset") {
      body.amount = {
        currency: selectedCurrency,
        issuer: selectedIssuer,
        value: singleAmount,
      };
    }

    const result = await mutate(
      "/api/amm/withdraw",
      body,
      "Withdrawal failed",
    );

    if (result !== null) {
      const message =
        result.poolDeleted === true
          ? "Pool has been deleted."
          : "Withdrawal successful!";
      setSuccessMessage(message);
      setTimeout(() => {
        setSuccessMessage(null);
        onSuccess();
        onClose();
      }, SUCCESS_MESSAGE_DURATION_MS);
    }
  }

  return (
    <ModalShell title="Withdraw from AMM Pool" onClose={onClose}>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {baseCurrency.currency} / {quoteCurrency.currency}
      </p>

      {/* Mode selector */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setMode("withdraw-all")}
          className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === "withdraw-all"
              ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
        >
          Withdraw All
        </button>
        <button
          onClick={() => setMode("two-asset")}
          className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === "two-asset"
              ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
        >
          Both Assets
        </button>
        <button
          onClick={() => setMode("single-asset")}
          className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === "single-asset"
              ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
        >
          Single Asset
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {mode === "withdraw-all" && (
          <>
            <div className="rounded-md bg-zinc-50 px-3 py-3 dark:bg-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Your LP token balance
              </p>
              <p className="mt-0.5 font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {lpTokenBalance}
              </p>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              This will redeem all your LP tokens for both pool assets.
            </p>
          </>
        )}

        {mode === "two-asset" && (
          <>
            <div>
              <label className={labelClass}>
                {baseCurrency.currency} Amount
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={amount1}
                onChange={(e) => setAmount1(e.target.value)}
                placeholder="0.00"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                {quoteCurrency.currency} Amount
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={amount2}
                onChange={(e) => setAmount2(e.target.value)}
                placeholder="0.00"
                className={inputClass}
              />
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              LP tokens burned will be proportional to the amounts withdrawn.
            </p>
          </>
        )}

        {mode === "single-asset" && (
          <>
            <div>
              <label className={labelClass}>Asset</label>
              <select
                value={selectedAsset}
                onChange={(e) =>
                  setSelectedAsset(e.target.value as "base" | "quote")
                }
                className={inputClass}
              >
                <option value="base">{baseCurrency.currency}</option>
                <option value="quote">{quoteCurrency.currency}</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Amount</label>
              <input
                type="number"
                step="any"
                min="0"
                value={singleAmount}
                onChange={(e) => setSingleAmount(e.target.value)}
                placeholder="0.00"
                className={inputClass}
              />
            </div>

            <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Single-asset withdrawals incur the pool&apos;s trading fee (
              {pool.tradingFeeDisplay ?? "unknown"}).
            </div>
          </>
        )}

        {error && <p className={errorTextClass}>{error}</p>}
        {successMessage && (
          <p className={successBannerClass}>{successMessage}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={isSubmitDisabled}
          className={`w-full ${primaryButtonClass}`}
        >
          {loading ? "Submitting..." : "Confirm"}
        </button>
      </div>
    </ModalShell>
  );
}
