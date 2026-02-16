"use client";

import { useState, useRef } from "react";
import { OrderBook, type DepthLevel } from "./order-book";
import { TradeForm } from "./trade-form";
import { RecentTrades } from "./recent-trades";
import { BalancesPanel } from "./balances-panel";
import type { TradeFormPrefill } from "./trade-form";
import type { WalletInfo, BalanceEntry } from "@/lib/types";
import type { CurrencyOption, OrderBookData } from "@/lib/hooks/use-trading-data";
import type { RecentTrade } from "./recent-trades";

interface TradeGridProps {
  focusedWallet: WalletInfo | null;
  sellingCurrency: CurrencyOption | null;
  buyingCurrency: CurrencyOption | null;
  activeDomainID: string | undefined;
  orderBook: OrderBookData | null;
  loadingOrderBook: boolean;
  recentTrades: RecentTrade[];
  loadingTrades: boolean;
  balances: BalanceEntry[];
  loadingBalances: boolean;
  network: string;
  onRefresh: () => void;
  depth: DepthLevel;
  onDepthChange: (d: DepthLevel) => void;
}

export function TradeGrid({
  focusedWallet,
  sellingCurrency,
  buyingCurrency,
  activeDomainID,
  orderBook,
  loadingOrderBook,
  recentTrades,
  loadingTrades,
  balances,
  loadingBalances,
  network,
  onRefresh,
  depth,
  onDepthChange,
}: TradeGridProps) {
  const [prefill, setPrefill] = useState<TradeFormPrefill | undefined>(undefined);
  const prefillKeyRef = useRef(0);

  const pairSelected = sellingCurrency !== null && buyingCurrency !== null;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-7">
      {/* Left column: Recent Trades */}
      <div className="space-y-6 lg:col-span-2">
        <RecentTrades
          trades={recentTrades}
          loading={loadingTrades}
          pairSelected={pairSelected}
          baseCurrency={sellingCurrency?.currency}
          quoteCurrency={buyingCurrency?.currency}
          network={network}
        />
      </div>

      {/* Middle column: Order Book */}
      <div className="space-y-6 lg:col-span-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          {activeDomainID && (
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-400">
                Domain: {activeDomainID.slice(0, 12)}...
              </span>
            </div>
          )}
          {pairSelected ? (
            <OrderBook
              orderBook={orderBook}
              loading={loadingOrderBook}
              baseCurrency={sellingCurrency!.currency}
              baseIssuer={sellingCurrency!.issuer}
              quoteCurrency={buyingCurrency!.currency}
              accountAddress={focusedWallet?.address}
              onSelectOrder={(price, amount, tab) => {
                prefillKeyRef.current += 1;
                setPrefill({ price, amount, tab, key: prefillKeyRef.current });
              }}
              depth={depth}
              onDepthChange={onDepthChange}
            />
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Select a currency pair to view the order book
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right column: Balances + Trade Form */}
      <div className="space-y-6 lg:col-span-2">
        <BalancesPanel balances={balances} loading={loadingBalances} onRefresh={onRefresh} />

        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          {pairSelected && focusedWallet ? (
            <TradeForm
              focusedWallet={focusedWallet}
              sellingCurrency={sellingCurrency!}
              buyingCurrency={buyingCurrency!}
              prefill={prefill}
              domainID={activeDomainID || undefined}
              onSubmitted={onRefresh}
            />
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Select a currency pair to place orders
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
