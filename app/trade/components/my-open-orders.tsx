"use client";

import type { OrderBookAmount } from "@/lib/types";
import { decodeCurrency } from "@/lib/xrpl/decode-currency-client";

interface AccountOffer {
  seq: number;
  flags: number;
  taker_gets: OrderBookAmount;
  taker_pays: OrderBookAmount;
  quality: string;
  expiration?: number;
}

interface MyOpenOrdersProps {
  offers: AccountOffer[];
  loading: boolean;
  pairSelected: boolean;
  baseCurrency?: string;
  quoteCurrency?: string;
  cancellingSeq: number | null;
  onCancel: (seq: number) => void;
}

function formatOfferSide(amt: OrderBookAmount): string {
  const cur = decodeCurrency(amt.currency);
  return `${parseFloat(amt.value).toFixed(4)} ${cur}`;
}

export function MyOpenOrders({
  offers,
  loading,
  pairSelected,
  baseCurrency,
  quoteCurrency,
  cancellingSeq,
  onCancel,
}: MyOpenOrdersProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        My Open Orders
        {pairSelected && baseCurrency && quoteCurrency && (
          <span className="ml-2 font-normal text-zinc-500 dark:text-zinc-400">
            ({baseCurrency}/{quoteCurrency})
          </span>
        )}
      </h3>
      {loading ? (
        <p className="mt-3 text-xs text-zinc-500">Loading offers...</p>
      ) : !pairSelected ? (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Select a pair to see your offers
        </p>
      ) : offers.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          No open orders for this pair
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {offers.map((offer) => {
            const getsLabel = formatOfferSide(offer.taker_gets);
            const paysLabel = formatOfferSide(offer.taker_pays);
            return (
              <div
                key={offer.seq}
                className="flex items-center justify-between rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="text-xs text-zinc-700 dark:text-zinc-300">
                  <span className="font-medium">Offer #{offer.seq}</span>
                  <span className="mx-2 text-zinc-400">|</span>
                  Give {getsLabel}
                  <span className="mx-1 text-zinc-400">for</span>
                  {paysLabel}
                </div>
                <button
                  onClick={() => onCancel(offer.seq)}
                  disabled={cancellingSeq !== null}
                  className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
                >
                  {cancellingSeq === offer.seq
                    ? "Cancelling..."
                    : "Cancel"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
