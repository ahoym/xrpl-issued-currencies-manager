"use client";

import type { CurrencyOption } from "@/lib/hooks/use-trading-data";

interface CurrencyPairSelectorProps {
  sellingValue: string;
  buyingValue: string;
  currencyOptions: CurrencyOption[];
  onSellingChange: (value: string) => void;
  onBuyingChange: (value: string) => void;
  onToggleCustomForm: () => void;
}

export function CurrencyPairSelector({
  sellingValue,
  buyingValue,
  currencyOptions,
  onSellingChange,
  onBuyingChange,
  onToggleCustomForm,
}: CurrencyPairSelectorProps) {
  return (
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <div className="min-w-[180px] flex-1">
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Base
        </label>
        <select
          value={sellingValue}
          onChange={(e) => onSellingChange(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="">Select currency...</option>
          {currencyOptions
            .filter((o) => o.value !== buyingValue)
            .map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
        </select>
      </div>
      <div className="min-w-[180px] flex-1">
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Quote
        </label>
        <select
          value={buyingValue}
          onChange={(e) => onBuyingChange(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="">Select currency...</option>
          {currencyOptions
            .filter((o) => o.value !== sellingValue)
            .map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
        </select>
      </div>
      <button
        type="button"
        onClick={onToggleCustomForm}
        className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        + Custom Currency
      </button>
    </div>
  );
}
