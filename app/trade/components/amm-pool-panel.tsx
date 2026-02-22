"use client";

import BigNumber from "bignumber.js";
import type { AmmPoolInfo } from "@/lib/types";
import { decodeCurrency } from "@/lib/xrpl/decode-currency-client";

interface AmmPoolPanelProps {
  pool: AmmPoolInfo | null;
  loading: boolean;
  pairSelected: boolean;
  onCreatePool: () => void;
  onDeposit: () => void;
  onWithdraw: () => void;
}

export function AmmPoolPanel({
  pool,
  loading,
  pairSelected,
  onCreatePool,
  onDeposit,
  onWithdraw,
}: AmmPoolPanelProps) {
  const frozen = pool?.assetFrozen || pool?.asset2Frozen;

  const asset1Currency = pool?.asset1
    ? decodeCurrency(pool.asset1.currency)
    : "";
  const asset2Currency = pool?.asset2
    ? decodeCurrency(pool.asset2.currency)
    : "";

  const asset1Value = pool?.asset1?.value ?? "0";
  const asset2Value = pool?.asset2?.value ?? "0";

  const isEmpty =
    pool?.exists === true &&
    new BigNumber(asset1Value).isZero() &&
    new BigNumber(asset2Value).isZero();

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        AMM Pool
      </h3>

      {!pairSelected ? (
        <p className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Select a currency pair to view AMM pool info
        </p>
      ) : loading ? (
        <div className="mt-2 space-y-2">
          <div className="h-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
      ) : !pool || pool.exists === false ? (
        <div className="mt-2 space-y-2">
          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            No AMM Pool
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            No AMM pool exists for this pair
          </p>
          <button
            onClick={onCreatePool}
            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
          >
            Create Pool
          </button>
        </div>
      ) : isEmpty ? (
        <div className="mt-2 space-y-2">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
            Pool is Empty
          </p>
          <button
            onClick={onDeposit}
            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
          >
            Re-fund Pool
          </button>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {frozen && (
            <div className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              One or more pool assets are frozen.
            </div>
          )}

          {pool.spotPrice && (
            <div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Spot Price
              </span>
              <p className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                1 {asset1Currency} ={" "}
                {new BigNumber(pool.spotPrice).toFixed(4)} {asset2Currency}
              </p>
            </div>
          )}

          <div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Reserves
            </span>
            <p className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
              {new BigNumber(asset1Value).toFixed(4)} {asset1Currency} +{" "}
              {new BigNumber(asset2Value).toFixed(4)} {asset2Currency}
            </p>
          </div>

          {pool.tradingFeeDisplay && (
            <div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Trading Fee
              </span>
              <p className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                {pool.tradingFeeDisplay}
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onDeposit}
              disabled={!!frozen}
              className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Deposit
            </button>
            <button
              onClick={onWithdraw}
              disabled={!!frozen}
              className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Withdraw
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
