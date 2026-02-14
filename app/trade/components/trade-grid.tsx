"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { OrderBook, type DepthLevel } from "./order-book";
import { TradeForm } from "./trade-form";
import { MyOpenOrders } from "./my-open-orders";
import { RecentTrades } from "./recent-trades";
import { BalancesPanel } from "./balances-panel";
import { matchesCurrency } from "@/lib/xrpl/match-currency";
import type { TradeFormPrefill } from "./trade-form";
import type { WalletInfo, BalanceEntry } from "@/lib/types";
import type { CurrencyOption, OrderBookData, AccountOffer } from "@/lib/hooks/use-trading-data";
import type { RecentTrade } from "./recent-trades";

interface TradeGridProps {
  focusedWallet: WalletInfo | null;
  sellingCurrency: CurrencyOption | null;
  buyingCurrency: CurrencyOption | null;
  activeDomainID: string | undefined;
  orderBook: OrderBookData | null;
  loadingOrderBook: boolean;
  accountOffers: AccountOffer[];
  loadingOffers: boolean;
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
  accountOffers,
  loadingOffers,
  recentTrades,
  loadingTrades,
  balances,
  loadingBalances,
  network,
  onRefresh,
  depth,
  onDepthChange,
}: TradeGridProps) {
  const [cancellingSeq, setCancellingSeq] = useState<number | null>(null);
  const [prefill, setPrefill] = useState<TradeFormPrefill | undefined>(undefined);
  const prefillKeyRef = useRef(0);

  const pairSelected = sellingCurrency !== null && buyingCurrency !== null;

  // Filter offers to the selected pair and domain
  const pairOffers = useMemo(() => {
    if (!sellingCurrency || !buyingCurrency) return [];
    return accountOffers.filter((o) => {
      if (activeDomainID) {
        if (o.domainID !== activeDomainID) return false;
      } else {
        if (o.domainID) return false;
      }

      const getsMatchesSelling = matchesCurrency(
        o.taker_gets,
        sellingCurrency.currency,
        sellingCurrency.issuer,
      );
      const paysMatchesBuying = matchesCurrency(
        o.taker_pays,
        buyingCurrency.currency,
        buyingCurrency.issuer,
      );
      const getsMatchesBuying = matchesCurrency(
        o.taker_gets,
        buyingCurrency.currency,
        buyingCurrency.issuer,
      );
      const paysMatchesSelling = matchesCurrency(
        o.taker_pays,
        sellingCurrency.currency,
        sellingCurrency.issuer,
      );
      return (
        (getsMatchesSelling && paysMatchesBuying) ||
        (getsMatchesBuying && paysMatchesSelling)
      );
    });
  }, [accountOffers, sellingCurrency, buyingCurrency, activeDomainID]);

  // Cancel an offer
  const handleCancel = useCallback(
    async (seq: number) => {
      if (!focusedWallet || cancellingSeq !== null) return;
      setCancellingSeq(seq);
      try {
        const res = await fetch("/api/dex/offers/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seed: focusedWallet.seed,
            offerSequence: seq,
            network,
          }),
        });
        if (res.ok) {
          onRefresh();
        }
      } catch {
        // ignore
      } finally {
        setCancellingSeq(null);
      }
    },
    [focusedWallet, cancellingSeq, network, onRefresh],
  );

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

      {/* Middle column: Order Book + My Open Orders */}
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
              onRefresh={onRefresh}
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

        <MyOpenOrders
          offers={pairOffers}
          loading={loadingOffers}
          pairSelected={pairSelected}
          baseCurrency={sellingCurrency?.currency}
          quoteCurrency={buyingCurrency?.currency}
          cancellingSeq={cancellingSeq}
          onCancel={handleCancel}
        />
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
              balances={balances}
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
