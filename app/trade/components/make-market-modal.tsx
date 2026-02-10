"use client";

import { useState } from "react";
import type { WalletInfo } from "@/lib/types";
import { inputClass, labelClass, errorTextClass } from "@/lib/ui/ui";

interface CurrencyOption {
  currency: string;
  issuer?: string;
}

export interface MakeMarketOrder {
  side: "Bid" | "Ask";
  level: number;
  price: string;
  qty: string;
  wallet: WalletInfo;
}

interface MakeMarketModalProps {
  baseCurrency: CurrencyOption | null;
  quoteCurrency: CurrencyOption | null;
  recipients: WalletInfo[];
  activeDomainID?: string;
  onClose: () => void;
  onExecute: (orders: MakeMarketOrder[]) => void;
}

interface LadderLevel {
  spreadPct: number;
  qty: number;
}

const DEFAULT_LEVELS: LadderLevel[] = [
  { spreadPct: 2, qty: 5 },
  { spreadPct: 5, qty: 10 },
  { spreadPct: 10, qty: 20 },
];

export function MakeMarketModal({
  baseCurrency,
  quoteCurrency,
  recipients,
  activeDomainID,
  onClose,
  onExecute,
}: MakeMarketModalProps) {
  // Form state
  const [bidWalletIdx, setBidWalletIdx] = useState(0);
  const [askWalletIdx, setAskWalletIdx] = useState(
    recipients.length > 1 ? 1 : 0,
  );
  const [midPrice, setMidPrice] = useState("");
  const [levels, setLevels] = useState<LadderLevel[]>(
    DEFAULT_LEVELS.map((l) => ({ ...l })),
  );

  // Flow state
  const [step, setStep] = useState<"form" | "preview">("form");
  const [plannedOrders, setPlannedOrders] = useState<MakeMarketOrder[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Validation
  const midPriceNum = parseFloat(midPrice);
  const midPriceValid =
    midPrice !== "" && !isNaN(midPriceNum) && midPriceNum > 0;

  if (recipients.length === 0) {
    return (
      <ModalShell onClose={onClose}>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Make Market
        </h2>
        <p className={`mt-4 ${errorTextClass}`}>
          No recipient wallets configured. Add wallets in Setup first.
        </p>
      </ModalShell>
    );
  }

  if (!baseCurrency || !quoteCurrency) {
    return (
      <ModalShell onClose={onClose}>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Make Market
        </h2>
        <p className={`mt-4 ${errorTextClass}`}>
          Select a currency pair first.
        </p>
      </ModalShell>
    );
  }

  function updateLevel(
    index: number,
    field: keyof LadderLevel,
    value: string,
  ) {
    setLevels((prev) =>
      prev.map((l, i) =>
        i === index ? { ...l, [field]: parseFloat(value) || 0 } : l,
      ),
    );
  }

  function handlePreview() {
    if (!midPriceValid || !baseCurrency || !quoteCurrency) return;

    const orders: MakeMarketOrder[] = [];
    const bidWallet = recipients[bidWalletIdx];
    const askWallet = recipients[askWalletIdx];

    for (let i = 0; i < levels.length; i++) {
      const { spreadPct, qty } = levels[i];
      const halfSpread = spreadPct / 2 / 100;

      const bidPrice = midPriceNum * (1 - halfSpread);
      const askPrice = midPriceNum * (1 + halfSpread);

      orders.push({
        side: "Bid",
        level: i + 1,
        price: bidPrice.toFixed(6),
        qty: qty.toString(),
        wallet: bidWallet,
      });
      orders.push({
        side: "Ask",
        level: i + 1,
        price: askPrice.toFixed(6),
        qty: qty.toString(),
        wallet: askWallet,
      });
    }

    setPlannedOrders(orders);
    setStep("preview");
  }

  function handleConfirm() {
    onExecute(plannedOrders);
  }

  // --- RENDER ---

  if (step === "preview") {
    return (
      <ModalShell onClose={onClose}>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Preview Orders
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {baseCurrency.currency} / {quoteCurrency.currency} &middot; Mid
          price: {midPrice}
        </p>

        <div className="mt-4 max-h-80 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                <th className="pb-1 pr-2">Side</th>
                <th className="pb-1 pr-2">Level</th>
                <th className="pb-1 pr-2">Price</th>
                <th className="pb-1 pr-2">Qty</th>
                <th className="pb-1">Wallet</th>
              </tr>
            </thead>
            <tbody>
              {plannedOrders.map((o, i) => (
                <tr
                  key={i}
                  className="border-b border-zinc-100 dark:border-zinc-800"
                >
                  <td
                    className={`py-1 pr-2 font-medium ${
                      o.side === "Bid"
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {o.side}
                  </td>
                  <td className="py-1 pr-2 text-zinc-700 dark:text-zinc-300">
                    {o.level}
                  </td>
                  <td className="py-1 pr-2 font-mono text-zinc-700 dark:text-zinc-300">
                    {o.price}
                  </td>
                  <td className="py-1 pr-2 text-zinc-700 dark:text-zinc-300">
                    {o.qty}
                  </td>
                  <td className="py-1 break-all font-mono text-zinc-500 dark:text-zinc-400">
                    {o.wallet.address}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setStep("form")}
            className="flex-1 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Back
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
          >
            Place Orders
          </button>
        </div>
      </ModalShell>
    );
  }

  // step === "form"
  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Make Market
        </h2>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          ✕
        </button>
      </div>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Place a 3-level bid/ask ladder for {baseCurrency.currency} /{" "}
        {quoteCurrency.currency}
      </p>

      {error && <p className={`mt-2 ${errorTextClass}`}>{error}</p>}

      <div className="mt-4 space-y-4">
        {/* Bid wallet */}
        <div>
          <label className={labelClass}>Bid Wallet</label>
          <select
            value={bidWalletIdx}
            onChange={(e) => setBidWalletIdx(Number(e.target.value))}
            className={inputClass}
          >
            {recipients.map((r, i) => (
              <option key={r.address} value={i}>
                {r.address}
              </option>
            ))}
          </select>
        </div>

        {/* Ask wallet */}
        <div>
          <label className={labelClass}>Ask Wallet</label>
          <select
            value={askWalletIdx}
            onChange={(e) => setAskWalletIdx(Number(e.target.value))}
            className={inputClass}
          >
            {recipients.map((r, i) => (
              <option key={r.address} value={i}>
                {r.address}
              </option>
            ))}
          </select>
        </div>

        {/* Mid price */}
        <div>
          <label className={labelClass}>
            Mid Price ({quoteCurrency.currency} per {baseCurrency.currency})
          </label>
          <input
            type="number"
            step="any"
            min="0"
            value={midPrice}
            onChange={(e) => setMidPrice(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>

        {/* Ladder config */}
        <div>
          <label className={labelClass}>Ladder Levels</label>
          <div className="mt-1 space-y-2">
            {levels.map((level, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-14 text-xs text-zinc-500 dark:text-zinc-400">
                  Level {i + 1}
                </span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={level.spreadPct || ""}
                  onChange={(e) => updateLevel(i, "spreadPct", e.target.value)}
                  className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                  placeholder="%"
                />
                <span className="text-xs text-zinc-400">% spread</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={level.qty || ""}
                  onChange={(e) => updateLevel(i, "qty", e.target.value)}
                  className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                  placeholder="qty"
                />
                <span className="text-xs text-zinc-400">qty</span>
              </div>
            ))}
          </div>
        </div>

        {activeDomainID && (
          <p className="rounded-md bg-purple-50 px-3 py-2 text-xs text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
            Domain: {activeDomainID.slice(0, 16)}...
          </p>
        )}

        <button
          onClick={handlePreview}
          disabled={!midPriceValid}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-600"
        >
          Preview Orders
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        {children}
      </div>
    </div>
  );
}
