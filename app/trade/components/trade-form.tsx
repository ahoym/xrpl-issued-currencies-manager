"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { WalletInfo, BalanceEntry } from "@/lib/types";
import { matchesCurrency } from "@/lib/xrpl/match-currency";
import { useAppState } from "@/lib/hooks/use-app-state";
import type { OfferFlag } from "@/lib/xrpl/types";
import { toRippleEpoch } from "@/lib/xrpl/constants";
import { inputClass, labelClass, errorTextClass, SUCCESS_MESSAGE_DURATION_MS } from "@/lib/ui/ui";
import { buildDexAmount } from "@/lib/xrpl/build-dex-amount";

interface CurrencyOption {
  currency: string;
  issuer?: string;
  label: string;
}

export interface TradeFormPrefill {
  tab: "buy" | "sell";
  price: string;
  amount: string;
  key: number;
}

interface TradeFormProps {
  focusedWallet: WalletInfo;
  sellingCurrency: CurrencyOption;
  buyingCurrency: CurrencyOption;
  prefill?: TradeFormPrefill;
  domainID?: string;
  balances?: BalanceEntry[];
  onSubmitted: () => void;
}

type ExecutionType = "" | "passive" | "immediateOrCancel" | "fillOrKill";

const EXECUTION_OPTIONS: { value: ExecutionType; label: string }[] = [
  { value: "", label: "Default (Limit)" },
  { value: "passive", label: "Passive" },
  { value: "immediateOrCancel", label: "Immediate or Cancel" },
  { value: "fillOrKill", label: "Fill or Kill" },
];

export function TradeForm({
  focusedWallet,
  sellingCurrency,
  buyingCurrency,
  prefill,
  domainID,
  balances,
  onSubmitted,
}: TradeFormProps) {
  const { state: { network } } = useAppState();
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [executionType, setExecutionType] = useState<ExecutionType>("");
  const [sellMode, setSellMode] = useState(false);
  const [hybrid, setHybrid] = useState(false);
  const [expiration, setExpiration] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const lastPrefillKey = useRef(prefill?.key);
  useEffect(() => {
    if (prefill && prefill.key !== lastPrefillKey.current) {
      lastPrefillKey.current = prefill.key;
      setTab(prefill.tab);
      setPrice(prefill.price);
      setAmount(prefill.amount);
      setError(null);
      setSuccess(false);
    }
  }, [prefill]);

  const total =
    amount && price
      ? (parseFloat(amount) * parseFloat(price)).toFixed(6)
      : "";

  const insufficientBalance = useMemo(() => {
    if (!balances || !amount || !price) return false;
    const amtNum = parseFloat(amount);
    const priceNum = parseFloat(price);
    if (isNaN(amtNum) || isNaN(priceNum) || amtNum <= 0 || priceNum <= 0) return false;

    // Buy tab: spending quote currency (buyingCurrency), spending total
    // Sell tab: spending base currency (sellingCurrency), spending amount
    const spendCurrency = tab === "buy" ? buyingCurrency : sellingCurrency;
    const spendAmount = tab === "buy" ? amtNum * priceNum : amtNum;

    const bal = balances.find((b) => matchesCurrency(b, spendCurrency.currency, spendCurrency.issuer));
    if (!bal) return spendAmount > 0;
    return spendAmount > parseFloat(bal.value);
  }, [balances, amount, price, tab, sellingCurrency, buyingCurrency]);

  const canSubmit =
    !submitting &&
    !insufficientBalance &&
    amount !== "" &&
    !isNaN(parseFloat(amount)) &&
    parseFloat(amount) > 0 &&
    price !== "" &&
    !isNaN(parseFloat(price)) &&
    parseFloat(price) > 0;

  function buildFlags(): OfferFlag[] {
    const flags: OfferFlag[] = [];
    if (executionType) flags.push(executionType);
    if (sellMode) flags.push("sell");
    if (hybrid) flags.push("hybrid");
    return flags;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    // Buy: user wants to acquire selling currency, pays with buying currency
    //   takerGets = buying currency (what the creator offers up)
    //   takerPays = selling currency (what the creator wants back)
    // Sell: user wants to sell selling currency, receives buying currency
    //   takerGets = selling currency (what the creator offers up)
    //   takerPays = buying currency (what the creator wants back)

    let takerGets;
    let takerPays;

    if (tab === "buy") {
      takerGets = buildDexAmount(
        buyingCurrency.currency,
        buyingCurrency.issuer,
        total,
      );
      takerPays = buildDexAmount(
        sellingCurrency.currency,
        sellingCurrency.issuer,
        amount,
      );
    } else {
      takerGets = buildDexAmount(
        sellingCurrency.currency,
        sellingCurrency.issuer,
        amount,
      );
      takerPays = buildDexAmount(
        buyingCurrency.currency,
        buyingCurrency.issuer,
        total,
      );
    }

    const payload: Record<string, unknown> = {
      seed: focusedWallet.seed,
      takerGets,
      takerPays,
      network,
    };

    if (domainID) {
      payload.domainID = domainID;
    }

    const flags = buildFlags();
    if (flags.length > 0) {
      payload.flags = flags;
    }

    if (expiration) {
      const epochMs = new Date(expiration).getTime();
      if (!isNaN(epochMs)) {
        payload.expiration = toRippleEpoch(epochMs);
      }
    }

    try {
      const res = await fetch("/api/dex/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to place offer");
      } else {
        setSuccess(true);
        setAmount("");
        setPrice("");
        setExecutionType("");
        setSellMode(false);
        setHybrid(false);
        setExpiration("");
        setTimeout(() => {
          setSuccess(false);
          onSubmitted();
        }, SUCCESS_MESSAGE_DURATION_MS);
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Place Order
      </h3>

      {/* Buy / Sell tabs */}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setTab("buy")}
          className={`rounded-md px-3 py-1 text-xs font-medium ${
            tab === "buy"
              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
        >
          Buy {sellingCurrency.currency}
        </button>
        <button
          type="button"
          onClick={() => setTab("sell")}
          className={`rounded-md px-3 py-1 text-xs font-medium ${
            tab === "sell"
              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
        >
          Sell {sellingCurrency.currency}
        </button>
      </div>

      {success ? (
        <div className="mt-4 rounded-md bg-green-50 p-3 text-center text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
          Order placed successfully!
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div>
            <label className={labelClass}>
              Amount ({sellingCurrency.currency})
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              Price ({buyingCurrency.currency} per {sellingCurrency.currency})
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              Total ({buyingCurrency.currency})
            </label>
            <div className="mt-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300">
              {total || "—"}
            </div>
          </div>

          {amount && price && total && (
            <div className="rounded-md bg-zinc-100 px-3 py-2 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {tab === "buy" ? (
                <>Pay <span className="font-semibold">{total} {buyingCurrency.currency}</span> to receive <span className="font-semibold">{amount} {sellingCurrency.currency}</span></>
              ) : (
                <>Sell <span className="font-semibold">{amount} {sellingCurrency.currency}</span> to receive <span className="font-semibold">{total} {buyingCurrency.currency}</span></>
              )}
            </div>
          )}

          {insufficientBalance && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Insufficient balance
            </p>
          )}

          <div>
            <label className={labelClass}>
              Execution Type
            </label>
            <select
              value={executionType}
              onChange={(e) => setExecutionType(e.target.value as ExecutionType)}
              className={inputClass}
            >
              {EXECUTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={sellMode}
                onChange={(e) => setSellMode(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-600"
              />
              Sell Mode
            </label>
            {domainID && (
              <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={hybrid}
                  onChange={(e) => setHybrid(e.target.checked)}
                  className="rounded border-zinc-300 dark:border-zinc-600"
                />
                Hybrid
              </label>
            )}
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

          {error && (
            <p className={errorTextClass}>{error}</p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
              tab === "buy"
                ? "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                : "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
            }`}
          >
            {submitting
              ? "Placing..."
              : tab === "buy"
                ? "Place Buy Order"
                : "Place Sell Order"}
          </button>
        </form>
      )}
    </div>
  );
}
