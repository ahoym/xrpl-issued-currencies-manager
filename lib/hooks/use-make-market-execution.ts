"use client";

import { useState, useRef, useCallback } from "react";
import { buildDexAmount } from "@/lib/xrpl/build-dex-amount";
import type { MakeMarketOrder } from "@/app/trade/components/make-market-modal";

interface CurrencyRef {
  currency: string;
  issuer?: string;
}

interface UseMakeMarketExecutionOptions {
  sellingCurrency: CurrencyRef | null;
  buyingCurrency: CurrencyRef | null;
  activeDomainID: string | undefined;
  network: string;
  onRefresh: () => void;
}

export function useMakeMarketExecution({
  sellingCurrency,
  buyingCurrency,
  activeDomainID,
  network,
  onRefresh,
}: UseMakeMarketExecutionOptions) {
  const [showMakeMarket, setShowMakeMarket] = useState(false);
  const [marketExec, setMarketExec] = useState<{ current: number; total: number } | null>(null);
  const [marketResult, setMarketResult] = useState<{ ok: number; failed: number; firstError?: string } | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMakeMarketExecute = useCallback(
    async (orders: MakeMarketOrder[]) => {
      setShowMakeMarket(false);

      if (resultTimerRef.current) {
        clearTimeout(resultTimerRef.current);
        resultTimerRef.current = null;
      }
      setMarketResult(null);
      setMarketExec({ current: 0, total: orders.length });

      const base = sellingCurrency;
      const quote = buyingCurrency;
      if (!base || !quote) return;

      let ok = 0;
      let failed = 0;
      let firstError: string | undefined;

      for (let i = 0; i < orders.length; i++) {
        setMarketExec({ current: i + 1, total: orders.length });
        const order = orders[i];
        const priceNum = parseFloat(order.price);
        const qtyNum = parseFloat(order.qty);
        const total = (qtyNum * priceNum).toFixed(6);

        let takerGets;
        let takerPays;

        if (order.side === "Bid") {
          takerGets = buildDexAmount(quote.currency, quote.issuer, total);
          takerPays = buildDexAmount(base.currency, base.issuer, order.qty);
        } else {
          takerGets = buildDexAmount(base.currency, base.issuer, order.qty);
          takerPays = buildDexAmount(quote.currency, quote.issuer, total);
        }

        const payload: Record<string, unknown> = {
          seed: order.wallet.seed,
          takerGets,
          takerPays,
          network,
        };

        if (activeDomainID) {
          payload.domainID = activeDomainID;
        }

        try {
          const res = await fetch("/api/dex/offers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            ok += 1;
            onRefresh();
          } else {
            failed += 1;
            if (!firstError) {
              const errData = await res.json().catch(() => null);
              firstError = errData?.error ?? `HTTP ${res.status}`;
            }
          }
        } catch {
          failed += 1;
          if (!firstError) firstError = "Network error";
        }
      }

      setMarketExec(null);
      setMarketResult({ ok, failed, firstError });
      onRefresh();

      resultTimerRef.current = setTimeout(() => {
        setMarketResult(null);
        resultTimerRef.current = null;
      }, 4000);
    },
    [sellingCurrency, buyingCurrency, activeDomainID, network, onRefresh],
  );

  // Button label / disabled / class
  let makeMarketLabel = "Make Market";
  let makeMarketDisabled = false;
  let makeMarketExtraClass = "bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600";

  if (marketExec) {
    makeMarketLabel = `Placing ${marketExec.current}/${marketExec.total}...`;
    makeMarketDisabled = true;
    makeMarketExtraClass = "bg-blue-500 dark:bg-blue-600 cursor-wait";
  } else if (marketResult) {
    const { ok, failed } = marketResult;
    makeMarketLabel = failed > 0 ? `${ok}/${ok + failed} placed` : `${ok}/${ok} placed`;
    makeMarketExtraClass = failed > 0
      ? "bg-amber-600 dark:bg-amber-700"
      : "bg-green-600 dark:bg-green-700";
  }

  const marketError = marketResult?.firstError ?? null;

  return {
    showMakeMarket,
    setShowMakeMarket,
    handleMakeMarketExecute,
    makeMarketLabel,
    makeMarketDisabled,
    makeMarketExtraClass,
    marketError,
  };
}
