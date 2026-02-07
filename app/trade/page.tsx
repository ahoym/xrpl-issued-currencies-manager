"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useAppState } from "@/lib/hooks/use-app-state";
import { OrderBook } from "../components/trade/order-book";
import { TradeForm } from "../components/trade/trade-form";
import type { TradeFormPrefill } from "../components/trade/trade-form";
import type { WalletInfo, PersistedState } from "@/lib/types";
import { WELL_KNOWN_CURRENCIES } from "@/lib/well-known-currencies";

function decodeCurrencyHex(code: string): string {
  if (code.length !== 40) return code;
  const stripped = code.replace(/0+$/, "");
  if (stripped.length === 0 || stripped.length % 2 !== 0) return code;
  let decoded = "";
  for (let i = 0; i < stripped.length; i += 2) {
    decoded += String.fromCharCode(parseInt(stripped.slice(i, i + 2), 16));
  }
  return decoded;
}

interface BalanceEntry {
  currency: string;
  value: string;
  issuer?: string;
}

interface CurrencyOption {
  currency: string;
  issuer?: string;
  label: string;
  value: string; // encoded as "currency|issuer"
}

interface OrderBookAmount {
  currency: string;
  value: string;
  issuer?: string;
}

interface OrderBookEntry {
  account: string;
  taker_gets: OrderBookAmount;
  taker_pays: OrderBookAmount;
  quality: string;
  sequence: number;
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

function currencyMatches(
  amt: OrderBookAmount,
  currency: string,
  issuer: string | undefined,
): boolean {
  const amtCurrency = decodeCurrencyHex(amt.currency);
  if (amtCurrency !== currency && amt.currency !== currency) return false;
  if (currency === "XRP") return true;
  return amt.issuer === issuer;
}

function formatOfferSide(amt: OrderBookAmount): string {
  const cur = decodeCurrencyHex(amt.currency);
  return `${parseFloat(amt.value).toFixed(4)} ${cur}`;
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
  const [customCurrency, setCustomCurrency] = useState("");
  const [customIssuer, setCustomIssuer] = useState("");

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
      const cur = decodeCurrencyHex(b.currency);
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
      fetchOrderBook(sellingCurrency, buyingCurrency, state.network);
    }
  }, [sellingCurrency, buyingCurrency, state.network, refreshKey, fetchOrderBook]);

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
      const getsMatchesSelling = currencyMatches(
        o.taker_gets,
        sellingCurrency.currency,
        sellingCurrency.issuer,
      );
      const paysMatchesBuying = currencyMatches(
        o.taker_pays,
        buyingCurrency.currency,
        buyingCurrency.issuer,
      );
      const getsMatchesBuying = currencyMatches(
        o.taker_gets,
        buyingCurrency.currency,
        buyingCurrency.issuer,
      );
      const paysMatchesSelling = currencyMatches(
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

  function handleAddCustomCurrency() {
    const cur = customCurrency.trim().toUpperCase();
    const iss = customIssuer.trim();
    if (!cur || !iss) return;
    setCustomCurrencies((prev) => [...prev, { currency: cur, issuer: iss }]);
    setCustomCurrency("");
    setCustomIssuer("");
    setShowCustomForm(false);
  }

  // --- RENDER ---

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    );
  }

  if (state.recipients.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold">Trade</h1>
        <div className="mt-8 rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No recipient wallets found. Set up wallets on the{" "}
            <Link
              href="/"
              className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Setup page
            </Link>{" "}
            first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">Trade</h1>

      {/* Wallet selector */}
      <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
        {state.recipients.map((wallet) => (
          <button
            key={wallet.address}
            onClick={() => handleSelectWallet(wallet)}
            className={`shrink-0 rounded-lg border px-4 py-2 text-left transition-colors ${
              focusedWallet?.address === wallet.address
                ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500 dark:border-blue-400 dark:bg-blue-900/20 dark:ring-blue-400"
                : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-zinc-600"
            }`}
          >
            <p className="font-mono text-xs text-zinc-900 dark:text-zinc-100">
              {wallet.address}
            </p>
          </button>
        ))}
      </div>

      {/* Currency pair selector */}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1">
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Selling
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
            Buying
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
        <div className="mt-3 flex items-end gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex-1">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Currency Code
            </label>
            <input
              type="text"
              value={customCurrency}
              onChange={(e) => setCustomCurrency(e.target.value)}
              placeholder="USD"
              maxLength={3}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          <div className="flex-[2]">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Issuer Address
            </label>
            <input
              type="text"
              value={customIssuer}
              onChange={(e) => setCustomIssuer(e.target.value)}
              placeholder="rXXXXXXXX..."
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          <button
            type="button"
            onClick={handleAddCustomCurrency}
            disabled={!customCurrency.trim() || !customIssuer.trim()}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-600"
          >
            Add
          </button>
        </div>
      )}

      {/* Main two-column layout */}
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Left column: Order Book + My Open Orders */}
        <div className="space-y-6 lg:col-span-3">
          {/* Order Book */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
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
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              My Open Orders
              {pairSelected && (
                <span className="ml-2 font-normal text-zinc-500 dark:text-zinc-400">
                  ({sellingCurrency!.currency}/{buyingCurrency!.currency})
                </span>
              )}
            </h3>
            {loadingOffers ? (
              <p className="mt-3 text-xs text-zinc-500">Loading offers...</p>
            ) : !pairSelected ? (
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                Select a pair to see your offers
              </p>
            ) : pairOffers.length === 0 ? (
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                No open orders for this pair
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {pairOffers.map((offer) => {
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
                        onClick={() => handleCancel(offer.seq)}
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
                  const cur = decodeCurrencyHex(b.currency);
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
