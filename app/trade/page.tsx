"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAppState } from "@/lib/hooks/use-app-state";
import { useAccountDomains } from "@/lib/hooks/use-account-domains";
import { useTradingData } from "@/lib/hooks/use-trading-data";
import { OrderBook } from "./components/order-book";
import { TradeForm } from "./components/trade-form";
import { WalletSelector } from "./components/wallet-selector";
import { CustomCurrencyForm } from "./components/custom-currency-form";
import { MyOpenOrders } from "./components/my-open-orders";
import { RecentTrades } from "./components/recent-trades";
import { DomainSelector } from "./components/domain-selector";
import { CurrencyPairSelector } from "./components/currency-pair-selector";
import { BalancesPanel } from "./components/balances-panel";
import { LoadingScreen } from "../components/loading-screen";
import { EmptyWallets } from "../components/empty-wallets";
import type { TradeFormPrefill } from "./components/trade-form";
import type { WalletInfo } from "@/lib/types";
import { Assets, WELL_KNOWN_CURRENCIES } from "@/lib/assets";
import { matchesCurrency } from "@/lib/xrpl/match-currency";

export default function TradePage() {
  const { state, hydrated } = useAppState();

  const [focusedWallet, setFocusedWallet] = useState<WalletInfo | null>(null);
  const [sellingValue, setSellingValue] = useState(`${Assets.RLUSD}|${WELL_KNOWN_CURRENCIES[state.network]?.RLUSD ?? ""}`);
  const [buyingValue, setBuyingValue] = useState(`${Assets.XRP}|`);
  const [customCurrencies, setCustomCurrencies] = useState<
    { currency: string; issuer: string }[]
  >([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [cancellingSeq, setCancellingSeq] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [prefill, setPrefill] = useState<TradeFormPrefill | undefined>(undefined);
  const prefillKeyRef = useRef(0);

  // Domain state
  const [domainMode, setDomainMode] = useState<"open" | "select" | "custom">("open");
  const [selectedDomainID, setSelectedDomainID] = useState("");
  const [customDomainID, setCustomDomainID] = useState("");
  const { domains: availableDomains } = useAccountDomains(
    state.domainOwner?.address,
    state.network,
  );

  const activeDomainID =
    domainMode === "select"
      ? selectedDomainID
      : domainMode === "custom"
        ? customDomainID
        : undefined;

  // Trading data hook
  const {
    balances,
    loadingBalances,
    currencyOptions,
    sellingCurrency,
    buyingCurrency,
    orderBook,
    loadingOrderBook,
    accountOffers,
    loadingOffers,
    recentTrades,
    loadingTrades,
  } = useTradingData({
    address: focusedWallet?.address,
    sellingValue,
    buyingValue,
    activeDomainID,
    refreshKey,
    customCurrencies,
  });

  const pairSelected = sellingCurrency !== null && buyingCurrency !== null;

  // Auto-select first recipient on mount / when recipients change
  useEffect(() => {
    if (hydrated && state.recipients.length > 0 && !focusedWallet) {
      setFocusedWallet(state.recipients[0]);
    }
  }, [hydrated, state.recipients, focusedWallet]);

  // Reset pair when focused wallet changes
  const handleSelectWallet = useCallback((wallet: WalletInfo) => {
    setFocusedWallet(wallet);
    setSellingValue("");
    setBuyingValue("");
  }, []);

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
  async function handleCancel(seq: number) {
    if (!focusedWallet || cancellingSeq !== null) return;
    setCancellingSeq(seq);
    try {
      const res = await fetch("/api/dex/offers/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed: focusedWallet.seed,
          offerSequence: seq,
          network: state.network,
        }),
      });
      if (res.ok) {
        setRefreshKey((k) => k + 1);
      }
    } catch {
      // ignore
    } finally {
      setCancellingSeq(null);
    }
  }

  // --- RENDER ---

  if (!hydrated) {
    return <LoadingScreen />;
  }

  if (state.recipients.length === 0) {
    return <EmptyWallets title="Trade" />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold">Trade</h1>

      <WalletSelector
        wallets={state.recipients}
        focusedAddress={focusedWallet?.address}
        onSelect={handleSelectWallet}
      />

      <DomainSelector
        domainMode={domainMode}
        selectedDomainID={selectedDomainID}
        customDomainID={customDomainID}
        availableDomains={availableDomains}
        activeDomainID={activeDomainID}
        onDomainModeChange={setDomainMode}
        onSelectedDomainIDChange={setSelectedDomainID}
        onCustomDomainIDChange={setCustomDomainID}
      />

      <CurrencyPairSelector
        sellingValue={sellingValue}
        buyingValue={buyingValue}
        currencyOptions={currencyOptions}
        onSellingChange={setSellingValue}
        onBuyingChange={setBuyingValue}
        onToggleCustomForm={() => setShowCustomForm(!showCustomForm)}
      />

      {showCustomForm && (
        <CustomCurrencyForm
          onAdd={(currency, issuer) =>
            setCustomCurrencies((prev) => [...prev, { currency, issuer }])
          }
          onClose={() => setShowCustomForm(false)}
        />
      )}

      {/* Main three-column layout */}
      <div className="mt-6 grid gap-6 lg:grid-cols-7">
        {/* Left column: Recent Trades */}
        <div className="space-y-6 lg:col-span-2">
          <RecentTrades
            trades={recentTrades}
            loading={loadingTrades}
            pairSelected={pairSelected}
            baseCurrency={sellingCurrency?.currency}
            quoteCurrency={buyingCurrency?.currency}
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
                onRefresh={() => setRefreshKey((k) => k + 1)}
                onSelectOrder={(price, amount, tab) => {
                  prefillKeyRef.current += 1;
                  setPrefill({ price, amount, tab, key: prefillKeyRef.current });
                }}
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
          <BalancesPanel balances={balances} loading={loadingBalances} />

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            {pairSelected && focusedWallet ? (
              <TradeForm
                focusedWallet={focusedWallet}
                sellingCurrency={sellingCurrency!}
                buyingCurrency={buyingCurrency!}
                prefill={prefill}
                domainID={activeDomainID || undefined}
                onSubmitted={() => setRefreshKey((k) => k + 1)}
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
    </div>
  );
}
