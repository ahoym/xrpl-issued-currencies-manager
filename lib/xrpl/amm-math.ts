import BigNumber from "bignumber.js";
import type { AmmPoolInfo } from "@/lib/types";

/**
 * AMM constant-product math for XRPL fill estimation.
 *
 * Formulas derived from the XRP Ledger's constant-product (x * y = k) AMM,
 * with trading fees applied to the input asset per the XLS-30d spec.
 *
 * @see https://xrpl.org/docs/concepts/tokens/decentralized-exchange/automated-market-makers
 * @see https://github.com/XRPLF/XRPL-Standards/discussions/78
 */

export interface AmmPoolParams {
  baseReserves: BigNumber;
  quoteReserves: BigNumber;
  /** tradingFee / 100_000 — see https://xrpl.org/docs/references/protocol/ledger-data/ledger-entry-types/amm */
  feeRate: BigNumber;
}

const FEE_DIVISOR = 100_000;

/**
 * Build AmmPoolParams from an AmmPoolInfo.
 * Returns null if pool doesn't exist, reserves are zero, or either asset is frozen.
 */
export function buildAmmPoolParams(pool: AmmPoolInfo | null | undefined): AmmPoolParams | null {
  if (!pool || !pool.exists) return null;
  if (pool.assetFrozen || pool.asset2Frozen) return null;

  const baseReserves = new BigNumber(pool.asset1?.value ?? "0");
  const quoteReserves = new BigNumber(pool.asset2?.value ?? "0");

  if (baseReserves.isZero() || quoteReserves.isZero()) return null;

  return {
    baseReserves,
    quoteReserves,
    feeRate: new BigNumber(pool.tradingFee ?? 0).div(FEE_DIVISOR),
  };
}

/**
 * Marginal buy price (quote/base) after `consumed` base has already been bought.
 *
 * Derived from the constant-product invariant (k = B * Q) with fee on quote input.
 * Formula: Q*B / ((B - consumed)^2 * (1-f))
 *
 * @see https://xrpl.org/docs/concepts/tokens/decentralized-exchange/automated-market-makers
 */
export function ammMarginalBuyPrice(pool: AmmPoolParams, consumed: BigNumber): BigNumber {
  const oneMinusF = new BigNumber(1).minus(pool.feeRate);
  const remaining = pool.baseReserves.minus(consumed);
  return pool.quoteReserves.times(pool.baseReserves).div(remaining.pow(2).times(oneMinusF));
}

/**
 * Marginal sell price (quote/base) after `consumed` base has already been sold.
 *
 * Derived from the constant-product invariant (k = B * Q) with fee on base input.
 * Formula: Q*B*(1-f) / (B + consumed*(1-f))^2
 *
 * @see https://xrpl.org/docs/concepts/tokens/decentralized-exchange/automated-market-makers
 */
export function ammMarginalSellPrice(pool: AmmPoolParams, consumed: BigNumber): BigNumber {
  const oneMinusF = new BigNumber(1).minus(pool.feeRate);
  const effective = pool.baseReserves.plus(consumed.times(oneMinusF));
  return pool.quoteReserves.times(pool.baseReserves).times(oneMinusF).div(effective.pow(2));
}

/**
 * Max base that can be bought before the marginal buy price reaches `priceLimit`.
 *
 * Solving ammMarginalBuyPrice(pool, consumed) = P for consumed.
 * Formula: B - sqrt(Q*B / (P*(1-f))), clamped to 0
 *
 * @see https://github.com/XRPLF/XRPL-Standards/discussions/78
 */
export function ammMaxBuyBeforePrice(pool: AmmPoolParams, priceLimit: BigNumber): BigNumber {
  const oneMinusF = new BigNumber(1).minus(pool.feeRate);
  const inner = pool.quoteReserves.times(pool.baseReserves).div(priceLimit.times(oneMinusF));
  const result = pool.baseReserves.minus(inner.sqrt());
  return BigNumber.max(result, 0);
}

/**
 * Max base that can be sold before the marginal sell price drops to `priceLimit`.
 *
 * Solving ammMarginalSellPrice(pool, consumed) = P for consumed.
 * Formula: (sqrt(Q*B*(1-f) / P) - B) / (1-f), clamped to 0
 *
 * @see https://github.com/XRPLF/XRPL-Standards/discussions/78
 */
export function ammMaxSellBeforePrice(pool: AmmPoolParams, priceLimit: BigNumber): BigNumber {
  const oneMinusF = new BigNumber(1).minus(pool.feeRate);
  const inner = pool.quoteReserves.times(pool.baseReserves).times(oneMinusF).div(priceLimit);
  const result = inner.sqrt().minus(pool.baseReserves).div(oneMinusF);
  return BigNumber.max(result, 0);
}

/**
 * Quote cost of buying `delta` base from the AMM, starting after `consumed` base
 * has already been bought.
 *
 * Integrates the marginal buy price over the delta interval.
 * Fee is on quote input (gross cost = effective / (1-f)).
 * Formula: Q*B*delta / ((B-consumed-delta)*(B-consumed)*(1-f))
 *
 * @see https://xrpl.org/docs/concepts/tokens/decentralized-exchange/automated-market-makers
 */
export function ammBuyCost(pool: AmmPoolParams, delta: BigNumber, consumed: BigNumber): BigNumber {
  const oneMinusF = new BigNumber(1).minus(pool.feeRate);
  const before = pool.baseReserves.minus(consumed);
  const after = before.minus(delta);
  // Effective quote needed = k/after - k/before = k * delta / (before * after)
  // Gross = effective / (1-f)
  return pool.quoteReserves
    .times(pool.baseReserves)
    .times(delta)
    .div(before.times(after).times(oneMinusF));
}

/**
 * Quote received for selling `delta` base to the AMM, starting after `consumed` base
 * has already been sold.
 *
 * Integrates the marginal sell price over the delta interval.
 * Fee is on base input (effective base = delta*(1-f)).
 * Formula: Q*B*delta*(1-f) / ((B+consumed*(1-f)) * (B+(consumed+delta)*(1-f)))
 *
 * @see https://xrpl.org/docs/concepts/tokens/decentralized-exchange/automated-market-makers
 */
export function ammSellProceeds(
  pool: AmmPoolParams,
  delta: BigNumber,
  consumed: BigNumber,
): BigNumber {
  const oneMinusF = new BigNumber(1).minus(pool.feeRate);
  const before = pool.baseReserves.plus(consumed.times(oneMinusF));
  const after = pool.baseReserves.plus(consumed.plus(delta).times(oneMinusF));
  return pool.quoteReserves
    .times(pool.baseReserves)
    .times(delta)
    .times(oneMinusF)
    .div(before.times(after));
}
