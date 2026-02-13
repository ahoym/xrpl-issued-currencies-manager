"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppState } from "@/lib/hooks/use-app-state";
import { useTradingData } from "@/lib/hooks/use-trading-data";
import { useMakeMarketExecution } from "@/lib/hooks/use-make-market-execution";
import { useDomainMode } from "@/lib/hooks/use-domain-mode";
import { WalletSelector } from "./components/wallet-selector";
import { CustomCurrencyForm } from "./components/custom-currency-form";
import { DomainSelector } from "./components/domain-selector";
import { CurrencyPairSelector } from "./components/currency-pair-selector";
import { TradeGrid } from "./components/trade-grid";
import { MakeMarketModal } from "./components/make-market-modal";
import { LoadingScreen } from "../components/loading-screen";
import { EmptyWallets } from "../components/empty-wallets";
import type { WalletInfo } from "@/lib/types";
import { Assets, WELL_KNOWN_CURRENCIES } from "@/lib/assets";

export default function TradePage() {
  const { state, hydrated } = useAppState();

  const [focusedWallet, setFocusedWallet] = useState<WalletInfo | null>(null);
  const [sellingValue, setSellingValue] = useState(`${Assets.RLUSD}|${WELL_KNOWN_CURRENCIES[state.network]?.RLUSD ?? ""}`);
  const [buyingValue, setBuyingValue] = useState(`${Assets.XRP}|`);
  const [customCurrencies, setCustomCurrencies] = useState<
    { currency: string; issuer: string }[]
  >([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const onRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

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

  // --- RENDER ---

  if (!hydrated) {
    return <LoadingScreen />;
  }

  if (state.recipients.length === 0) {
    return <EmptyWallets title="Trade" />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
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
        accountOffers={accountOffers}
        loadingOffers={loadingOffers}
        recentTrades={recentTrades}
        loadingTrades={loadingTrades}
        balances={balances}
        loadingBalances={loadingBalances}
        network={state.network}
        onRefresh={onRefresh}
      />

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
    </div>
  );
}
