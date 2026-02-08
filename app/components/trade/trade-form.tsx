"use client";

import { useState, useEffect, useRef } from "react";
import type { WalletInfo, PersistedState } from "@/lib/types";
import type { OfferFlag } from "@/lib/xrpl/types";
import { RIPPLE_EPOCH_OFFSET } from "@/lib/xrpl/constants";
import { inputClass, labelClass, errorTextClass } from "@/lib/ui/styles";
import { SUCCESS_MESSAGE_DURATION_MS } from "@/lib/ui/constants";

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
  network: PersistedState["network"];
  prefill?: TradeFormPrefill;
  domainID?: string;
  onSubmitted: () => void;
}

const FLAG_OPTIONS: { value: OfferFlag; label: string; domainOnly?: boolean }[] = [
  { value: "passive", label: "Passive" },
  { value: "immediateOrCancel", label: "Immediate or Cancel" },
  { value: "fillOrKill", label: "Fill or Kill" },
  { value: "sell", label: "Sell" },
  { value: "hybrid", label: "Hybrid", domainOnly: true },
];

function buildDexAmount(
  currency: string,
  issuer: string | undefined,
  value: string,
) {
  if (currency === "XRP") {
    return { currency: "XRP", value };
  }
  return { currency, issuer, value };
}

export function TradeForm({
  focusedWallet,
  sellingCurrency,
  buyingCurrency,
  network,
  prefill,
  domainID,
  onSubmitted,
}: TradeFormProps) {
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [flags, setFlags] = useState<Set<OfferFlag>>(new Set());
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

  const canSubmit =
    !submitting &&
    amount !== "" &&
    !isNaN(parseFloat(amount)) &&
    parseFloat(amount) > 0 &&
    price !== "" &&
    !isNaN(parseFloat(price)) &&
    parseFloat(price) > 0;

  function toggleFlag(flag: OfferFlag) {
    setFlags((prev) => {
      const next = new Set(prev);
      if (next.has(flag)) {
        next.delete(flag);
      } else {
        next.add(flag);
      }
      return next;
    });
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

    if (flags.size > 0) {
      payload.flags = Array.from(flags);
    }

    if (expiration) {
      const epochMs = new Date(expiration).getTime();
      if (!isNaN(epochMs)) {
        payload.expiration = Math.floor(epochMs / 1000) - RIPPLE_EPOCH_OFFSET;
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
        setFlags(new Set());
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

          <div>
            <label className={labelClass}>
              Flags
            </label>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {FLAG_OPTIONS.filter((f) => !f.domainOnly || domainID).map((f) => (
                <label
                  key={f.value}
                  className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400"
                >
                  <input
                    type="checkbox"
                    checked={flags.has(f.value)}
                    onChange={() => toggleFlag(f.value)}
                    className="rounded border-zinc-300 dark:border-zinc-600"
                  />
                  {f.label}
                </label>
              ))}
            </div>
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
