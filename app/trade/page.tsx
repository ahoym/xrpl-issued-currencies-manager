"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAppState } from "@/lib/hooks/use-app-state";
import { OrderBook } from "../components/trade/order-book";
import { TradeForm } from "../components/trade/trade-form";
import { WalletSelector } from "../components/trade/wallet-selector";
import { CustomCurrencyForm } from "../components/trade/custom-currency-form";
import { MyOpenOrders } from "../components/trade/my-open-orders";
import { LoadingScreen } from "../components/loading-screen";
import { EmptyWallets } from "../components/empty-wallets";
import type { TradeFormPrefill } from "../components/trade/trade-form";
import type { WalletInfo, PersistedState, BalanceEntry, OrderBookAmount, OrderBookEntry, DomainInfo } from "@/lib/types";
import { WELL_KNOWN_CURRENCIES } from "@/lib/well-known-currencies";
import { decodeCurrency } from "@/lib/xrpl/decode-currency-client";
import { matchesCurrency } from "@/lib/xrpl/match-currency";

interface CurrencyOption {
  currency: string;
  issuer?: string;
  label: string;
  value: string; // encoded as "currency|issuer"
}

interface OrderBookData {
  buy: OrderBookEntry[];
  sell: OrderBookEntry[];
}

interface AccountOffer {
  seq: number;
  flags: number;
  taker_gets: OrderBookAmount;
  taker_pays: OrderBookAmount;
  quality: string;
  expiration?: number;
}

export default function TradePage() {
  const { state, hydrated } = useAppState();

  const [focusedWallet, setFocusedWallet] = useState<WalletInfo | null>(null);
  const [sellingValue, setSellingValue] = useState("");
  const [buyingValue, setBuyingValue] = useState("");
  const [customCurrencies, setCustomCurrencies] = useState<
    { currency: string; issuer: string }[]
  >([]);
  const [showCustomForm, setShowCustomForm] = useState(false);

  const [balances, setBalances] = useState<BalanceEntry[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [loadingOrderBook, setLoadingOrderBook] = useState(false);
  const [accountOffers, setAccountOffers] = useState<AccountOffer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [cancellingSeq, setCancellingSeq] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [prefill, setPrefill] = useState<TradeFormPrefill | undefined>(undefined);
  const prefillKeyRef = useRef(0);

  // Domain state
  const [domainMode, setDomainMode] = useState<"open" | "select" | "custom">("open");
  const [selectedDomainID, setSelectedDomainID] = useState("");
  const [customDomainID, setCustomDomainID] = useState("");
  const [availableDomains, setAvailableDomains] = useState<DomainInfo[]>([]);

  const activeDomainID =
    domainMode === "select"
      ? selectedDomainID
      : domainMode === "custom"
        ? customDomainID
        : undefined;

  // Fetch available domains from domain owner
  useEffect(() => {
    if (!state.domainOwner) {
      setAvailableDomains([]);
      return;
    }
    async function fetchDomains() {
      try {
        const res = await fetch(
          `/api/accounts/${state.domainOwner!.address}/domains?network=${state.network}`,
        );
        const data = await res.json();
        if (res.ok) {
          setAvailableDomains(data.domains ?? []);
        }
      } catch {
        // ignore
      }
    }
    fetchDomains();
  }, [state.domainOwner, state.network]);

  // Auto-select first recipient on mount / when recipients change
  useEffect(() => {
    if (hydrated && state.recipients.length > 0 && !focusedWallet) {
      setFocusedWallet(state.recipients[0]);
    }
  }, [hydrated, state.recipients, focusedWallet]);

  // Reset pair + data when focused wallet changes
  const handleSelectWallet = useCallback((wallet: WalletInfo) => {
    setFocusedWallet(wallet);
    setSellingValue("");
    setBuyingValue("");
    setOrderBook(null);
    setAccountOffers([]);
  }, []);

  // Fetch balances
  const fetchBalances = useCallback(
    async (address: string, network: PersistedState["network"]) => {
      setLoadingBalances(true);
      try {
        const res = await fetch(
          `/api/accounts/${address}/balances?network=${network}`,
        );
        const data = await res.json();
        if (res.ok) {
          setBalances(data.balances ?? []);
        } else {
          setBalances([]);
        }
      } catch {
        setBalances([]);
      } finally {
        setLoadingBalances(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (focusedWallet) {
      fetchBalances(focusedWallet.address, state.network);
    }
  }, [focusedWallet, state.network, refreshKey, fetchBalances]);

  // Build currency options from balances + custom currencies
  const currencyOptions = useMemo<CurrencyOption[]>(() => {
    const opts: CurrencyOption[] = [];
    const seen = new Set<string>();

    // Always include XRP
    const xrpKey = "XRP|";
    opts.push({ currency: "XRP", label: "XRP", value: xrpKey });
    seen.add(xrpKey);

    // Well-known currencies
    for (const wk of WELL_KNOWN_CURRENCIES) {
      const key = `${wk.currency}|${wk.issuer}`;
      if (!seen.has(key)) {
        seen.add(key);
        opts.push({
          currency: wk.currency,
          issuer: wk.issuer,
          label: `${wk.currency} (${wk.issuer})`,
          value: key,
        });
      }
    }

    for (const b of balances) {
      const cur = decodeCurrency(b.currency);
      if (cur === "XRP") continue;
      const key = `${cur}|${b.issuer ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      opts.push({
        currency: cur,
        issuer: b.issuer,
        label: b.issuer ? `${cur} (${b.issuer})` : cur,
        value: key,
      });
    }

    for (const c of customCurrencies) {
      const key = `${c.currency}|${c.issuer}`;
      if (seen.has(key)) continue;
      seen.add(key);
      opts.push({
        currency: c.currency,
        issuer: c.issuer,
        label: `${c.currency} (${c.issuer})`,
        value: key,
      });
    }

    return opts;
  }, [balances, customCurrencies]);

  const sellingCurrency = useMemo(
    () => currencyOptions.find((o) => o.value === sellingValue) ?? null,
    [currencyOptions, sellingValue],
  );
  const buyingCurrency = useMemo(
    () => currencyOptions.find((o) => o.value === buyingValue) ?? null,
    [currencyOptions, buyingValue],
  );

  const pairSelected = sellingCurrency !== null && buyingCurrency !== null;

  // Fetch order book
  const fetchOrderBook = useCallback(
    async (
      selling: CurrencyOption,
      buying: CurrencyOption,
      network: PersistedState["network"],
      domain?: string,
    ) => {
      setLoadingOrderBook(true);
      try {
        const params = new URLSearchParams({
          base_currency: selling.currency,
          quote_currency: buying.currency,
          network,
        });
        if (selling.issuer) params.set("base_issuer", selling.issuer);
        if (buying.issuer) params.set("quote_issuer", buying.issuer);
        if (domain) params.set("domain", domain);

        const res = await fetch(`/api/dex/orderbook?${params}`);
        const data = await res.json();
        if (res.ok) {
          setOrderBook({ buy: data.buy ?? [], sell: data.sell ?? [] });
        } else {
          setOrderBook(null);
        }
      } catch {
        setOrderBook(null);
      } finally {
        setLoadingOrderBook(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (sellingCurrency && buyingCurrency) {
      fetchOrderBook(sellingCurrency, buyingCurrency, state.network, activeDomainID || undefined);
    }
  }, [sellingCurrency, buyingCurrency, state.network, refreshKey, fetchOrderBook, activeDomainID]);

  // Fetch account offers
  const fetchAccountOffers = useCallback(
    async (address: string, network: PersistedState["network"]) => {
      setLoadingOffers(true);
      try {
        const res = await fetch(
          `/api/accounts/${address}/offers?network=${network}`,
        );
        const data = await res.json();
        if (res.ok) {
          setAccountOffers(data.offers ?? []);
        } else {
          setAccountOffers([]);
        }
      } catch {
        setAccountOffers([]);
      } finally {
        setLoadingOffers(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (focusedWallet) {
      fetchAccountOffers(focusedWallet.address, state.network);
    }
  }, [focusedWallet, state.network, refreshKey, fetchAccountOffers]);

  // Filter offers to the selected pair
  const pairOffers = useMemo(() => {
    if (!sellingCurrency || !buyingCurrency) return [];
    return accountOffers.filter((o) => {
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
  }, [accountOffers, sellingCurrency, buyingCurrency]);

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
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">Trade</h1>

      {/* Wallet selector */}
      <WalletSelector
        wallets={state.recipients}
        focusedAddress={focusedWallet?.address}
        onSelect={handleSelectWallet}
      />

      {/* Domain selector */}
      <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            DEX Mode:
          </label>
          <select
            value={domainMode}
            onChange={(e) => {
              setDomainMode(e.target.value as "open" | "select" | "custom");
              setSelectedDomainID("");
              setCustomDomainID("");
            }}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="open">Open DEX</option>
            {availableDomains.length > 0 && <option value="select">Permissioned Domain</option>}
            <option value="custom">Custom Domain ID</option>
          </select>
          {domainMode === "select" && (
            <select
              value={selectedDomainID}
              onChange={(e) => setSelectedDomainID(e.target.value)}
              className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="">Select domain...</option>
              {availableDomains.map((d) => (
                <option key={d.domainID} value={d.domainID}>
                  {d.domainID.slice(0, 16)}... ({d.acceptedCredentials.map((ac) => ac.credentialType).join(", ")})
                </option>
              ))}
            </select>
          )}
          {domainMode === "custom" && (
            <input
              type="text"
              value={customDomainID}
              onChange={(e) => setCustomDomainID(e.target.value)}
              placeholder="Enter Domain ID (64-char hex)"
              className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          )}
          {activeDomainID && (
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-400">
              Permissioned
            </span>
          )}
        </div>
      </div>

      {/* Currency pair selector */}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1">
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Base
          </label>
          <select
            value={sellingValue}
            onChange={(e) => setSellingValue(e.target.value)}
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
            onChange={(e) => setBuyingValue(e.target.value)}
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
          onClick={() => setShowCustomForm(!showCustomForm)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          + Custom Currency
        </button>
      </div>

      {/* Custom currency form */}
      {showCustomForm && (
        <CustomCurrencyForm
          onAdd={(currency, issuer) =>
            setCustomCurrencies((prev) => [...prev, { currency, issuer }])
          }
          onClose={() => setShowCustomForm(false)}
        />
      )}

      {/* Main two-column layout */}
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Left column: Order Book + My Open Orders */}
        <div className="space-y-6 lg:col-span-3">
          {/* Order Book */}
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

          {/* My Open Orders */}
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
          {/* Balances */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Balances
            </h3>
            {loadingBalances ? (
              <p className="mt-2 text-xs text-zinc-500">Loading...</p>
            ) : balances.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                No balances
              </p>
            ) : (
              <div className="mt-2 space-y-1">
                {balances.map((b, i) => {
                  const cur = decodeCurrency(b.currency);
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {cur}
                      </span>
                      <span className="font-mono text-zinc-600 dark:text-zinc-400">
                        {parseFloat(b.value).toFixed(4)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Trade Form */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            {pairSelected && focusedWallet ? (
              <TradeForm
                focusedWallet={focusedWallet}
                sellingCurrency={sellingCurrency!}
                buyingCurrency={buyingCurrency!}
                network={state.network}
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
