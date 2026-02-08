"use client";

import { useState } from "react";
import { MAX_CURRENCY_CODE_LENGTH } from "@/lib/xrpl/constants";

interface CustomCurrencyFormProps {
  onAdd: (currency: string, issuer: string) => void;
  onClose: () => void;
}

export function CustomCurrencyForm({ onAdd, onClose }: CustomCurrencyFormProps) {
  const [currency, setCurrency] = useState("");
  const [issuer, setIssuer] = useState("");

  function handleAdd() {
    const cur = currency.trim().toUpperCase();
    const iss = issuer.trim();
    if (!cur || !iss) return;
    onAdd(cur, iss);
    setCurrency("");
    setIssuer("");
    onClose();
  }

  return (
    <div className="mt-3 flex items-end gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex-1">
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Currency Code
        </label>
        <input
          type="text"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          placeholder="USD"
          maxLength={MAX_CURRENCY_CODE_LENGTH}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
      </div>
      <div className="flex-[2]">
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Issuer Address
        </label>
        <input
          type="text"
          value={issuer}
          onChange={(e) => setIssuer(e.target.value)}
          placeholder="rXXXXXXXX..."
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
      </div>
      <button
        type="button"
        onClick={handleAdd}
        disabled={!currency.trim() || !issuer.trim()}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-600"
      >
        Add
      </button>
    </div>
  );
}
