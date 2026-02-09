"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppState } from "./use-app-state";
import { useBalances } from "./use-balances";
import type { OrderBookAmount, OrderBookEntry } from "@/lib/types";
import type { RecentTrade } from "@/app/components/trade/recent-trades";
import { Assets, WELL_KNOWN_CURRENCIES } from "@/lib/assets";
import { decodeCurrency } from "@/lib/xrpl/decode-currency-client";

export interface CurrencyOption {
  currency: string;
  issuer?: string;
  label: string;
  value: string; // encoded as "currency|issuer"
}

export interface OrderBookData {
  buy: OrderBookEntry[];
  sell: OrderBookEntry[];
}

export interface AccountOffer {
  seq: number;
  flags: number;
  taker_gets: OrderBookAmount;
  taker_pays: OrderBookAmount;
  quality: string;
  expiration?: number;
  domainID?: string;
}

interface UseTradingDataOptions {
  address: string | undefined;
  sellingValue: string;
  buyingValue: string;
  activeDomainID: string | undefined;
  refreshKey: number;
  customCurrencies: { currency: string; issuer: string }[];
}

export function useTradingData({
  address,
  sellingValue,
  buyingValue,
  activeDomainID,
  refreshKey,
  customCurrencies,
}: UseTradingDataOptions) {
  const { state: { network } } = useAppState();
  const { balances, loading: loadingBalances } = useBalances(address, network, refreshKey);

  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [loadingOrderBook, setLoadingOrderBook] = useState(false);
  const [accountOffers, setAccountOffers] = useState<AccountOffer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(false);

  // Build currency options from balances + well-known + custom
  const currencyOptions = useMemo<CurrencyOption[]>(() => {
    const opts: CurrencyOption[] = [];
    const seen = new Set<string>();

    const xrpKey = `${Assets.XRP}|`;
    opts.push({ currency: Assets.XRP, label: Assets.XRP, value: xrpKey });
    seen.add(xrpKey);

    for (const [currency, issuer] of Object.entries(WELL_KNOWN_CURRENCIES[network] ?? {})) {
      const key = `${currency}|${issuer}`;
      if (!seen.has(key)) {
        seen.add(key);
        opts.push({ currency, issuer, label: `${currency} (${issuer})`, value: key });
      }
    }

    for (const b of balances) {
      const cur = decodeCurrency(b.currency);
      if (cur === Assets.XRP) continue;
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
      opts.push({ currency: c.currency, issuer: c.issuer, label: `${c.currency} (${c.issuer})`, value: key });
    }

    return opts;
  }, [balances, customCurrencies, network]);

  // Resolve selected currencies from string values
  const sellingCurrency = useMemo(
    () => currencyOptions.find((o) => o.value === sellingValue) ?? null,
    [currencyOptions, sellingValue],
  );
  const buyingCurrency = useMemo(
    () => currencyOptions.find((o) => o.value === buyingValue) ?? null,
    [currencyOptions, buyingValue],
  );

  // Fetch order book
  const fetchOrderBook = useCallback(
    async (selling: CurrencyOption, buying: CurrencyOption, net: string, domain?: string) => {
      setLoadingOrderBook(true);
      try {
        const params = new URLSearchParams({ base_currency: selling.currency, quote_currency: buying.currency, network: net });
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
      fetchOrderBook(sellingCurrency, buyingCurrency, network, activeDomainID || undefined);
    }
  }, [sellingCurrency, buyingCurrency, network, refreshKey, fetchOrderBook, activeDomainID]);

  // Fetch account offers
  const fetchAccountOffers = useCallback(
    async (addr: string, net: string) => {
      setLoadingOffers(true);
      try {
        const res = await fetch(`/api/accounts/${addr}/offers?network=${net}`);
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
    if (address) {
      fetchAccountOffers(address, network);
    }
  }, [address, network, refreshKey, fetchAccountOffers]);

  // Fetch recent trades
  const fetchRecentTrades = useCallback(
    async (selling: CurrencyOption, buying: CurrencyOption, net: string, domain?: string) => {
      setLoadingTrades(true);
      try {
        const params = new URLSearchParams({ base_currency: selling.currency, quote_currency: buying.currency, network: net });
        if (selling.issuer) params.set("base_issuer", selling.issuer);
        if (buying.issuer) params.set("quote_issuer", buying.issuer);
        if (domain) params.set("domain", domain);

        const res = await fetch(`/api/dex/trades?${params}`);
        const data = await res.json();
        if (res.ok) {
          setRecentTrades(data.trades ?? []);
        } else {
          setRecentTrades([]);
        }
      } catch {
        setRecentTrades([]);
      } finally {
        setLoadingTrades(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (sellingCurrency && buyingCurrency) {
      fetchRecentTrades(sellingCurrency, buyingCurrency, network, activeDomainID || undefined);
    }
  }, [sellingCurrency, buyingCurrency, network, refreshKey, fetchRecentTrades, activeDomainID]);

  return {
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
  };
}
