"use client";

import { useState } from "react";
import type { FilledOrder, AccountOffer } from "@/lib/types";
import { matchesCurrency } from "@/lib/xrpl/match-currency";
import { fromRippleEpoch } from "@/lib/xrpl/constants";
import { EXPLORER_URLS, type NetworkId } from "@/lib/xrpl/networks";

interface OrdersProps {
  filledOrders: FilledOrder[];
  loadingFilled: boolean;
  offers: AccountOffer[];
  loadingOffers: boolean;
  pairSelected: boolean;
  baseCurrency?: string;
  baseIssuer?: string;
  quoteCurrency?: string;
  quoteIssuer?: string;
  cancellingSeq: number | null;
  onCancel: (seq: number) => void;
  network: string;
}

function computeOfferFields(
  offer: AccountOffer,
  baseCurrency: string,
  baseIssuer: string | undefined,
) {
  // If taker_pays matches base, it's a buy (the creator wants to receive base)
  const isBuy = matchesCurrency(offer.taker_pays, baseCurrency, baseIssuer);

  if (isBuy) {
    // Buy: taker_gets = quote (what creator gives), taker_pays = base (what creator receives)
    const baseAmount = parseFloat(offer.taker_pays.value);
    const quoteAmount = parseFloat(offer.taker_gets.value);
    const price = baseAmount > 0 ? quoteAmount / baseAmount : 0;
    return { side: "buy" as const, price, baseAmount, quoteAmount };
  } else {
    // Sell: taker_gets = base (what creator gives), taker_pays = quote (what creator receives)
    const baseAmount = parseFloat(offer.taker_gets.value);
    const quoteAmount = parseFloat(offer.taker_pays.value);
    const price = baseAmount > 0 ? quoteAmount / baseAmount : 0;
    return { side: "sell" as const, price, baseAmount, quoteAmount };
  }
}

function formatExpiration(expiration: number): string {
  const date = fromRippleEpoch(expiration);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return "Expired";
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  return `${mins}m`;
}

function formatTime(iso: string): string {
  if (!iso) return "\u2014";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "\u2014";
  }
}

function OrdersContent({
  filledOrders,
  loadingFilled,
  offers,
  loadingOffers,
  pairSelected,
  baseCurrency,
  baseIssuer,
  quoteCurrency,
  quoteIssuer,
  cancellingSeq,
  onCancel,
  network,
}: OrdersProps) {
  const [activeTab, setActiveTab] = useState<"open" | "filled">("open");
  const explorerBase = EXPLORER_URLS[network as NetworkId];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-zinc-100 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("open")}
          className={`px-3 py-1.5 text-xs font-medium ${
            activeTab === "open"
              ? "border-b-2 border-blue-500 text-zinc-900 dark:text-zinc-100"
              : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          Open ({offers.length})
        </button>
        <button
          onClick={() => setActiveTab("filled")}
          className={`px-3 py-1.5 text-xs font-medium ${
            activeTab === "filled"
              ? "border-b-2 border-blue-500 text-zinc-900 dark:text-zinc-100"
              : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          Filled ({filledOrders.length})
        </button>
      </div>

      {/* Open tab */}
      {activeTab === "open" && (
        <div className="mt-3">
          {!pairSelected ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Select a pair to see your orders
            </p>
          ) : loadingOffers && offers.length === 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Loading orders...</p>
          ) : offers.length === 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              No open orders for this pair
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    <th className="pb-1.5 pr-2 font-medium">Side</th>
                    <th className="pb-1.5 pr-2 font-medium text-right">Price</th>
                    <th className="pb-1.5 pr-2 font-medium text-right">Amount</th>
                    <th className="pb-1.5 pr-2 font-medium text-right">Total</th>
                    <th className="pb-1.5 pr-2 font-medium text-right">Expires</th>
                    <th className="pb-1.5 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((offer) => {
                    const { side, price, baseAmount, quoteAmount } = computeOfferFields(
                      offer,
                      baseCurrency!,
                      baseIssuer,
                    );
                    return (
                      <tr
                        key={offer.seq}
                        className="border-b border-zinc-50 dark:border-zinc-900"
                      >
                        <td className="py-1.5 pr-2">
                          <span
                            className={
                              side === "buy"
                                ? "font-medium text-green-600 dark:text-green-400"
                                : "font-medium text-red-600 dark:text-red-400"
                            }
                          >
                            {side === "buy" ? "Buy" : "Sell"}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                          {price.toFixed(4)}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                          {baseAmount.toFixed(4)}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                          {quoteAmount.toFixed(4)}
                        </td>
                        <td className="py-1.5 pr-2 text-right text-zinc-500 dark:text-zinc-400">
                          {offer.expiration ? (
                            <span
                              title={fromRippleEpoch(offer.expiration).toLocaleString()}
                            >
                              {formatExpiration(offer.expiration)}
                            </span>
                          ) : (
                            "\u2014"
                          )}
                        </td>
                        <td className="py-1.5 text-right">
                          <button
                            onClick={() => onCancel(offer.seq)}
                            disabled={cancellingSeq === offer.seq}
                            className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
                          >
                            {cancellingSeq === offer.seq ? "Cancelling..." : "Cancel"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Filled tab */}
      {activeTab === "filled" && (
        <div className="mt-3">
          {!pairSelected ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Select a pair to see filled orders
            </p>
          ) : loadingFilled && filledOrders.length === 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Loading filled orders...</p>
          ) : filledOrders.length === 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              No filled orders for this pair
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    <th className="pb-1.5 pr-2 font-medium">Side</th>
                    <th className="pb-1.5 pr-2 font-medium text-right">Price</th>
                    <th className="pb-1.5 pr-2 font-medium text-right">Amount</th>
                    <th className="pb-1.5 pr-2 font-medium text-right">Total</th>
                    <th className="pb-1.5 font-medium text-right">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filledOrders.map((order) => (
                    <tr
                      key={order.hash}
                      className="cursor-pointer border-b border-zinc-50 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-800/50"
                      onClick={() =>
                        window.open(
                          `${explorerBase}/transactions/${order.hash}`,
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                    >
                      <td className="py-1.5 pr-2">
                        <span
                          className={
                            order.side === "buy"
                              ? "font-medium text-green-600 dark:text-green-400"
                              : "font-medium text-red-600 dark:text-red-400"
                          }
                        >
                          {order.side === "buy" ? "Buy" : "Sell"}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                        {parseFloat(order.price).toFixed(4)}
                      </td>
                      <td className="py-1.5 pr-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                        {parseFloat(order.baseAmount).toFixed(4)}
                      </td>
                      <td className="py-1.5 pr-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                        {parseFloat(order.quoteAmount).toFixed(4)}
                      </td>
                      <td className="py-1.5 text-right text-zinc-500 dark:text-zinc-400">
                        {formatTime(order.time)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function OrdersSheet(props: OrdersProps) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 hidden lg:block">
      <div
        className="border-t-2 border-zinc-300 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.06)] dark:border-zinc-700 dark:bg-zinc-950 dark:shadow-[0_-2px_8px_rgba(0,0,0,0.3)]"
        style={{
          maxHeight: collapsed ? "2.5rem" : "33vh",
          transition: "max-height 0.3s ease-in-out",
          overflow: "hidden",
        }}
      >
        {/* Toggle bar */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          <span className="flex items-center gap-2">
            Orders
            {props.offers.length > 0 && (
              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                {props.offers.length}
              </span>
            )}
            {props.pairSelected && props.baseCurrency && props.quoteCurrency && (
              <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">
                {props.baseCurrency}/{props.quoteCurrency}
              </span>
            )}
          </span>
          <span className="flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500">
            {collapsed ? "Show Orders" : "Hide Orders"} {collapsed ? "\u25B2" : "\u25BC"}
          </span>
        </button>

        {/* Content */}
        <div className="overflow-y-auto px-4 pb-3" style={{ maxHeight: "calc(33vh - 2.5rem)" }}>
          <OrdersContent {...props} />
        </div>
      </div>
    </div>
  );
}

export function OrdersSection(props: OrdersProps) {
  return (
    <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 lg:hidden dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Orders
        {props.pairSelected && props.baseCurrency && props.quoteCurrency && (
          <span className="ml-2 font-normal text-zinc-500 dark:text-zinc-400">
            ({props.baseCurrency}/{props.quoteCurrency})
          </span>
        )}
      </h3>
      <OrdersContent {...props} />
    </div>
  );
}
