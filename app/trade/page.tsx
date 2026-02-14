"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppState } from "@/lib/hooks/use-app-state";
import { useTradingData } from "@/lib/hooks/use-trading-data";
import { useMakeMarketExecution } from "@/lib/hooks/use-make-market-execution";
import { useDomainMode } from "@/lib/hooks/use-domain-mode";
import { matchesCurrency } from "@/lib/xrpl/match-currency";
import { WalletSelector } from "./components/wallet-selector";
import { CustomCurrencyForm } from "./components/custom-currency-form";
import { DomainSelector } from "./components/domain-selector";
import { CurrencyPairSelector } from "./components/currency-pair-selector";
import { TradeGrid } from "./components/trade-grid";
import { DEPTH_OPTIONS, type DepthLevel } from "./components/order-book";
import { OrdersSheet, OrdersSection } from "./components/orders-sheet";
import { MakeMarketModal } from "./components/make-market-modal";
import { LoadingScreen } from "../components/loading-screen";
import { EmptyWallets } from "../components/empty-wallets";
import type { WalletInfo } from "@/lib/types";
import { Assets, WELL_KNOWN_CURRENCIES } from "@/lib/assets";

export default function TradePage() {
  const { state, hydrated } = useAppState();

  const [focusedWallet, setFocusedWallet] = useState<WalletInfo | null>(null);
  const [sellingValue, setSellingValue] = useState("");
  const [buyingValue, setBuyingValue] = useState("");
  const [customCurrencies, setCustomCurrencies] = useState<
    { currency: string; issuer: string }[]
  >([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const onRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  const [depth, setDepth] = useState<DepthLevel>(DEPTH_OPTIONS[1]);

  // Smart defaults based on network
  useEffect(() => {
    if (!hydrated) return;
    const rlusdIssuer = WELL_KNOWN_CURRENCIES[state.network]?.RLUSD;
    if (rlusdIssuer) {
      setSellingValue(`${Assets.RLUSD}|${rlusdIssuer}`);
      setBuyingValue(`${Assets.XRP}|`);
    } else {
      setSellingValue(`${Assets.XRP}|`);
      setBuyingValue("");
    }
  }, [hydrated, state.network]);

  // Domain state
  const {
    domainMode,
    setDomainMode,
    selectedDomainID,
    setSelectedDomainID,
    customDomainID,
    setCustomDomainID,
    activeDomainID,
    availableDomains,
  } = useDomainMode(state.domainOwner?.address, state.network);

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
    filledOrders,
    loadingFilled,
  } = useTradingData({
    address: focusedWallet?.address,
    sellingValue,
    buyingValue,
    activeDomainID,
    refreshKey,
    customCurrencies,
  });

  // Make-market execution
  const {
    showMakeMarket,
    setShowMakeMarket,
    handleMakeMarketExecute,
    makeMarketLabel,
    makeMarketDisabled,
    makeMarketExtraClass,
    marketError,
  } = useMakeMarketExecution({
    sellingCurrency,
    buyingCurrency,
    activeDomainID,
    network: state.network,
    onRefresh,
  });

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
  const pairSelected = sellingCurrency !== null && buyingCurrency !== null;
  const pairOffers = useMemo(() => {
    if (!sellingCurrency || !buyingCurrency) return [];
    return accountOffers.filter((o) => {
      if (activeDomainID) {
        if (o.domainID !== activeDomainID) return false;
      } else {
        if (o.domainID) return false;
      }
      const getsMatchesSelling = matchesCurrency(o.taker_gets, sellingCurrency.currency, sellingCurrency.issuer);
      const paysMatchesBuying = matchesCurrency(o.taker_pays, buyingCurrency.currency, buyingCurrency.issuer);
      const getsMatchesBuying = matchesCurrency(o.taker_gets, buyingCurrency.currency, buyingCurrency.issuer);
      const paysMatchesSelling = matchesCurrency(o.taker_pays, sellingCurrency.currency, sellingCurrency.issuer);
      return (getsMatchesSelling && paysMatchesBuying) || (getsMatchesBuying && paysMatchesSelling);
    });
  }, [accountOffers, sellingCurrency, buyingCurrency, activeDomainID]);

  // Cancel an offer
  const [cancellingSeq, setCancellingSeq] = useState<number | null>(null);
  const handleCancel = useCallback(
    async (seq: number) => {
      if (!focusedWallet || cancellingSeq !== null) return;
      setCancellingSeq(seq);
      try {
        const res = await fetch("/api/dex/offers/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seed: focusedWallet.seed, offerSequence: seq, network: state.network }),
        });
        if (res.ok) onRefresh();
      } catch {
        // ignore
      } finally {
        setCancellingSeq(null);
      }
    },
    [focusedWallet, cancellingSeq, state.network, onRefresh],
  );

  // Shared orders props
  const ordersProps = {
    filledOrders,
    loadingFilled,
    offers: pairOffers,
    loadingOffers,
    pairSelected,
    baseCurrency: sellingCurrency?.currency,
    baseIssuer: sellingCurrency?.issuer,
    quoteCurrency: buyingCurrency?.currency,
    quoteIssuer: buyingCurrency?.issuer,
    cancellingSeq,
    onCancel: handleCancel,
    network: state.network,
  };

  // --- RENDER ---

  if (!hydrated) {
    return <LoadingScreen />;
  }

  if (state.recipients.length === 0) {
    return <EmptyWallets title="Trade" />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:pb-[calc(33vh+1.5rem)]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Trade</h1>
        <div className="flex items-center gap-3">
          {marketError && (
            <span className="max-w-xs truncate text-xs text-red-600 dark:text-red-400">
              {marketError}
            </span>
          )}
          <button
            onClick={() => setShowMakeMarket(true)}
            disabled={makeMarketDisabled}
            className={`rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-80 ${makeMarketExtraClass}`}
          >
            {makeMarketLabel}
          </button>
        </div>
      </div>

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

      <TradeGrid
        focusedWallet={focusedWallet}
        sellingCurrency={sellingCurrency}
        buyingCurrency={buyingCurrency}
        activeDomainID={activeDomainID}
        orderBook={orderBook}
        loadingOrderBook={loadingOrderBook}
        recentTrades={recentTrades}
        loadingTrades={loadingTrades}
        balances={balances}
        loadingBalances={loadingBalances}
        network={state.network}
        onRefresh={onRefresh}
        depth={depth}
        onDepthChange={setDepth}
      />

      <OrdersSection {...ordersProps} />

      {showMakeMarket && (
        <MakeMarketModal
          baseCurrency={sellingCurrency}
          quoteCurrency={buyingCurrency}
          recipients={state.recipients}
          activeDomainID={activeDomainID}
          onClose={() => setShowMakeMarket(false)}
          onExecute={handleMakeMarketExecute}
        />
      )}

      <OrdersSheet {...ordersProps} />
    </div>
  );
}
