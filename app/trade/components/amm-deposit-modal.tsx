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

interface AmmDepositModalProps {
  pool: AmmPoolInfo;
  baseCurrency: CurrencyOption;
  quoteCurrency: CurrencyOption;
  walletSeed: string;
  network: string;
  onClose: () => void;
  onSuccess: () => void;
}

type DepositMode = "two-asset" | "single-asset" | "two-asset-if-empty";

export function AmmDepositModal({
  pool,
  baseCurrency,
  quoteCurrency,
  walletSeed,
  network,
  onClose,
  onSuccess,
}: AmmDepositModalProps) {
  const isPoolEmpty =
    pool.asset1?.value === "0" && pool.asset2?.value === "0";

  const [mode, setMode] = useState<DepositMode>(
    isPoolEmpty ? "two-asset-if-empty" : "two-asset",
  );
  const [amount1, setAmount1] = useState("");
  const [amount2, setAmount2] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<"base" | "quote">("base");
  const [singleAmount, setSingleAmount] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { loading, error, mutate } = useApiMutation<Record<string, unknown>>();

  const selectedCurrency =
    selectedAsset === "base" ? baseCurrency.currency : quoteCurrency.currency;
  const selectedIssuer =
    selectedAsset === "base" ? baseCurrency.issuer : quoteCurrency.issuer;

  const poolRatio =
    pool.asset1?.value && pool.asset2?.value && Number(pool.asset2.value) !== 0
      ? (Number(pool.asset1.value) / Number(pool.asset2.value)).toFixed(6)
      : null;

  const isTwoAsset = mode === "two-asset" || mode === "two-asset-if-empty";

  const isSubmitDisabled =
    loading ||
    (isTwoAsset
      ? amount1.trim() === "" || amount2.trim() === ""
      : singleAmount.trim() === "");

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

    if (isTwoAsset) {
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
    } else {
      body.amount = {
        currency: selectedCurrency,
        issuer: selectedIssuer,
        value: singleAmount,
      };
    }

    const result = await mutate(
      "/api/amm/deposit",
      body,
      "Deposit failed",
    );

    if (result !== null) {
      setSuccessMessage("Deposit successful!");
      setTimeout(() => {
        setSuccessMessage(null);
        onSuccess();
        onClose();
      }, SUCCESS_MESSAGE_DURATION_MS);
    }
  }

  return (
    <ModalShell title="Deposit into AMM Pool" onClose={onClose}>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {baseCurrency.currency} / {quoteCurrency.currency}
      </p>

      {isPoolEmpty && (
        <div className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          This pool is empty — provide both assets to re-fund it.
        </div>
      )}

      {/* Mode selector — hidden when pool is empty (forced to two-asset-if-empty) */}
      {!isPoolEmpty && (
        <div className="mt-4 flex gap-2">
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
      )}

      <div className="mt-4 space-y-4">
        {isTwoAsset ? (
          <>
            {/* Both Assets mode */}
            {poolRatio !== null && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Current pool ratio: {poolRatio}{" "}
                {baseCurrency.currency}/{quoteCurrency.currency}
              </p>
            )}

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
              Proportional deposits incur no trading fee.
            </p>
          </>
        ) : (
          <>
            {/* Single Asset mode */}
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
              Single-asset deposits incur the pool&apos;s trading fee (
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
