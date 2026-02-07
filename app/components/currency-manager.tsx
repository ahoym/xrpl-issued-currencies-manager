"use client";

import { useState } from "react";

interface CurrencyManagerProps {
  currencies: string[];
  disabled: boolean;
  onAdd: (code: string) => void;
  onRemove: (code: string) => void;
}

export function CurrencyManager({ currencies, disabled, onAdd, onRemove }: CurrencyManagerProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    const code = input.toUpperCase().trim();
    setError(null);

    if (code.length < 3 || code.length > 39) {
      setError("Currency code must be 3–39 uppercase characters (e.g. USD)");
      return;
    }
    if (!/^[A-Z0-9]+$/.test(code)) {
      setError("Currency code must contain only uppercase letters and digits");
      return;
    }
    if (currencies.includes(code)) {
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
        Choose the currency codes your issuer will offer. These are saved locally — nothing is created on the ledger yet.
        {disabled && " Generate an issuer wallet first."}
      </p>

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase().slice(0, 39))}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="e.g. USD"
          maxLength={39}
          className="w-48 rounded-md border border-zinc-300 px-3 py-1.5 text-sm uppercase dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          onClick={handleAdd}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {currencies.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {currencies.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200"
            >
              {code}
              <button
                onClick={() => onRemove(code)}
                className="ml-1 text-blue-600 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
                aria-label={`Remove ${code}`}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
