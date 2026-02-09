"use client";

import { useMemo, useState } from "react";
import { MIN_CURRENCY_CODE_LENGTH, MAX_CURRENCY_CODE_LENGTH } from "@/lib/xrpl/constants";
import { errorTextClass } from "@/lib/ui/ui";

interface CurrencyManagerProps {
  currencies: string[];
  onLedgerCurrencies: Set<string>;
  disabled: boolean;
  onAdd: (code: string) => void;
  onRemove: (code: string) => void;
}

export function CurrencyManager({
  currencies,
  onLedgerCurrencies,
  disabled,
  onAdd,
  onRemove,
}: CurrencyManagerProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Union of local currencies and on-ledger currencies
  const allCurrencies = useMemo(() => {
    const set = new Set(currencies);
    for (const code of onLedgerCurrencies) set.add(code);
    return Array.from(set);
  }, [currencies, onLedgerCurrencies]);

  function handleAdd() {
    const code = input.toUpperCase().trim();
    setError(null);

    if (code.length < MIN_CURRENCY_CODE_LENGTH || code.length > MAX_CURRENCY_CODE_LENGTH) {
      setError(`Currency code must be ${MIN_CURRENCY_CODE_LENGTH}\u2013${MAX_CURRENCY_CODE_LENGTH} uppercase characters (e.g. USD)`);
      return;
    }
    if (!/^[A-Z0-9]+$/.test(code)) {
      setError("Currency code must contain only uppercase letters and digits");
      return;
    }
    if (currencies.includes(code) || onLedgerCurrencies.has(code)) {
      setError(`${code} already added`);
      return;
    }
    onAdd(code);
    setInput("");
  }

  return (
    <section
      className={`rounded-lg border border-zinc-200 p-6 dark:border-zinc-800 ${
        disabled ? "pointer-events-none opacity-50" : ""
      }`}
    >
      <h2 className="text-lg font-semibold">2. Define Currencies</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Add currency codes for your issuer.{" "}
        <span className="text-green-700 dark:text-green-400">Green</span> = on-ledger (has trust lines),{" "}
        <span className="text-blue-700 dark:text-blue-400">blue</span> = local-only (not yet issued).
        {disabled && " Generate an issuer wallet first."}
      </p>

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase().slice(0, MAX_CURRENCY_CODE_LENGTH))}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="e.g. USD"
          maxLength={MAX_CURRENCY_CODE_LENGTH}
          className="w-48 rounded-md border border-zinc-300 px-3 py-1.5 text-sm uppercase dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          onClick={handleAdd}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add
        </button>
      </div>
      {error && <p className={`mt-2 ${errorTextClass}`}>{error}</p>}

      {allCurrencies.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {allCurrencies.map((code) => {
            const isOnLedger = onLedgerCurrencies.has(code);
            return (
              <span
                key={code}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${
                  isOnLedger
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                }`}
              >
                {isOnLedger && (
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                    />
                  </svg>
                )}
                {code}
                {!isOnLedger && (
                  <button
                    onClick={() => onRemove(code)}
                    className="ml-1 text-blue-600 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
                    aria-label={`Remove ${code}`}
                  >
                    &times;
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}
    </section>
  );
}
