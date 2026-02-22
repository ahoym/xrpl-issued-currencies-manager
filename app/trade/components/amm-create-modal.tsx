"use client";

import { useState } from "react";
import type { CurrencyOption } from "@/lib/hooks/use-trading-data";
import { useApiMutation } from "@/lib/hooks/use-api-mutation";
import { ModalShell } from "@/app/components/modal-shell";
import { parseAmmFeeInput } from "@/lib/xrpl/amm-fee";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  errorTextClass,
  successBannerClass,
  SUCCESS_MESSAGE_DURATION_MS,
} from "@/lib/ui/ui";

interface AmmCreateModalProps {
  baseCurrency: CurrencyOption;
  quoteCurrency: CurrencyOption;
  walletSeed: string;
  network: string;
  onClose: () => void;
  onSuccess: () => void;
}

const FEE_PRESETS = [
  { label: "0.10%", value: "0.10" },
  { label: "0.30%", value: "0.30" },
  { label: "1.00%", value: "1.00" },
];

export function AmmCreateModal({
  baseCurrency,
  quoteCurrency,
  walletSeed,
  network,
  onClose,
  onSuccess,
}: AmmCreateModalProps) {
  const [step, setStep] = useState<"form" | "preview">("form");
  const [baseAmount, setBaseAmount] = useState("");
  const [quoteAmount, setQuoteAmount] = useState("");
  const [feeInput, setFeeInput] = useState("0.30");
  const [success, setSuccess] = useState(false);

  const { loading, error, mutate } = useApiMutation();

  const feeUnits = parseAmmFeeInput(feeInput);
  const feeDisplay = (feeUnits / 1000).toFixed(2) + "%";

  const baseAmountValid =
    baseAmount !== "" && Number.isFinite(parseFloat(baseAmount)) && parseFloat(baseAmount) > 0;
  const quoteAmountValid =
    quoteAmount !== "" && Number.isFinite(parseFloat(quoteAmount)) && parseFloat(quoteAmount) > 0;
  const formValid = baseAmountValid && quoteAmountValid;

  function handlePreview() {
    if (!formValid) return;
    setStep("preview");
  }

  async function handleConfirm() {
    const body = {
      seed: walletSeed,
      amount: {
        currency: baseCurrency.currency,
        issuer: baseCurrency.issuer,
        value: baseAmount,
      },
      amount2: {
        currency: quoteCurrency.currency,
        issuer: quoteCurrency.issuer,
        value: quoteAmount,
      },
      tradingFee: feeUnits,
      network,
    };

    const result = await mutate("/api/amm/create", body as Record<string, unknown>, "Failed to create AMM pool");

    if (result !== null) {
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, SUCCESS_MESSAGE_DURATION_MS);
    }
  }

  // --- RENDER ---

  if (step === "preview") {
    return (
      <ModalShell title="Preview AMM Pool" onClose={onClose}>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Create {baseCurrency.label} / {quoteCurrency.label} pool
        </p>

        <div className="mt-4 space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          <div>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Pool Amounts
            </span>
            <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
              {baseAmount} {baseCurrency.label} + {quoteAmount} {quoteCurrency.label}
            </p>
          </div>
          <div>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Trading Fee
            </span>
            <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
              {feeDisplay}
            </p>
          </div>
        </div>

        {success && (
          <p className={successBannerClass}>AMM pool created successfully!</p>
        )}

        {error && !success && (
          <p className={`mt-3 ${errorTextClass}`}>{error}</p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setStep("form")}
            disabled={loading || success}
            className="flex-1 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Back
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || success}
            className={`flex-1 ${primaryButtonClass}`}
          >
            {loading ? "Creating..." : "Confirm & Create"}
          </button>
        </div>
      </ModalShell>
    );
  }

  // step === "form"
  return (
    <ModalShell title="Create AMM Pool" onClose={onClose}>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Provide initial liquidity for {baseCurrency.label} / {quoteCurrency.label}
      </p>

      <div className="mt-4 space-y-4">
        {/* Base amount */}
        <div>
          <label className={labelClass}>{baseCurrency.label} Amount</label>
          <input
            type="number"
            step="any"
            min="0"
            value={baseAmount}
            onChange={(e) => setBaseAmount(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>

        {/* Quote amount */}
        <div>
          <label className={labelClass}>{quoteCurrency.label} Amount</label>
          <input
            type="number"
            step="any"
            min="0"
            value={quoteAmount}
            onChange={(e) => setQuoteAmount(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>

        {/* Trading fee */}
        <div>
          <label className={labelClass}>Trading Fee (%)</label>
          <div className="mt-1 flex gap-2">
            {FEE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setFeeInput(preset.value)}
                className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                  feeInput === preset.value
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300"
                    : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={feeInput}
            onChange={(e) => setFeeInput(e.target.value)}
            placeholder="0.30"
            className={`${inputClass} mt-2`}
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Fee units: {feeUnits} / 1000
          </p>
        </div>

        {/* Cost warning */}
        <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          Creating an AMM pool costs approximately 0.2 XRP (owner reserve).
          This is destroyed, not held in reserve.
        </div>

        <button
          onClick={handlePreview}
          disabled={!formValid}
          className={`w-full ${primaryButtonClass}`}
        >
          Preview
        </button>
      </div>
    </ModalShell>
  );
}
