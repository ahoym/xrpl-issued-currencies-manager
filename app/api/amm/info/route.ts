import { NextRequest } from "next/server";
import BigNumber from "bignumber.js";
import {
  validateCurrencyPair,
  getNetworkParam,
  apiErrorResponse,
} from "@/lib/api";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { buildCurrencySpec } from "@/lib/xrpl/amm-helpers";
import { formatAmmFee } from "@/lib/xrpl/amm-fee";
import { fromXrplAmount } from "@/lib/xrpl/currency";
import {
  buildAmmPoolParams,
  ammMarginalBuyPrice,
  ammMarginalSellPrice,
} from "@/lib/xrpl/amm-math";
import { Assets } from "@/lib/assets";
import type { Amount } from "xrpl";

/** Typed subset of the amm_info response fields that xrpl.js doesn't fully type */
interface AmmFields {
  account: string;
  amount: Amount;
  amount2: Amount;
  lp_token: Amount;
  trading_fee: number;
  asset_frozen?: boolean;
  asset2_frozen?: boolean;
  auction_slot?: {
    account: string;
    discounted_fee: number;
    expiration?: number;
    price: Amount;
    time_interval?: number;
  };
  vote_slots?: { account: string; trading_fee: number; vote_weight: number }[];
}

export async function GET(request: NextRequest) {
  // 1. Parse & validate query params
  const pairResult = validateCurrencyPair(request);
  if (pairResult instanceof Response) return pairResult;
  const { baseCurrency, baseIssuer, quoteCurrency, quoteIssuer } = pairResult;
  const network = getNetworkParam(request);

  // 2. Build XRPL Currency specs for amm_info
  const asset = buildCurrencySpec({
    currency: baseCurrency,
    issuer: baseIssuer,
  });
  const asset2 = buildCurrencySpec({
    currency: quoteCurrency,
    issuer: quoteIssuer,
  });

  try {
    const client = await getClient(resolveNetwork(network));
    const response = await client.request({
      command: "amm_info",
      asset,
      asset2,
    });

    const amm = response.result.amm as AmmFields;

    // 3. Extract and normalize amounts
    const amount1 = fromXrplAmount(amm.amount);
    const amount2Val = fromXrplAmount(amm.amount2);

    // 4. Determine if response asset order matches query base/quote
    const amount1IsBase =
      amount1.currency === baseCurrency &&
      (baseCurrency === Assets.XRP || amount1.issuer === baseIssuer);

    const [baseAmount, quoteAmount] = amount1IsBase
      ? [amount1, amount2Val]
      : [amount2Val, amount1];

    // 5. Calculate spot price (price of 1 base in quote terms)
    const baseVal = new BigNumber(baseAmount.value);
    const quoteVal = new BigNumber(quoteAmount.value);
    const spotPrice = baseVal.gt(0) ? quoteVal.div(baseVal).toFixed() : "0";

    // 6. Normalize frozen flags to match user's base/quote orientation
    const rawAssetFrozen = !!amm.asset_frozen;
    const rawAsset2Frozen = !!amm.asset2_frozen;
    const [assetFrozen, asset2Frozen] = amount1IsBase
      ? [rawAssetFrozen, rawAsset2Frozen]
      : [rawAsset2Frozen, rawAssetFrozen];

    // 7. Compute enriched price fields
    let invertedSpotPrice: string | undefined;
    let effectivePrice: string | undefined;
    let marginalBuyPrice: string | undefined;
    let marginalSellPrice: string | undefined;

    if (baseVal.gt(0) && quoteVal.gt(0)) {
      const spot = quoteVal.div(baseVal);
      invertedSpotPrice = new BigNumber(1).div(spot).toFixed();

      const feeRate = new BigNumber(amm.trading_fee).div(100_000);
      const oneMinusFee = new BigNumber(1).minus(feeRate);
      if (oneMinusFee.gt(0)) {
        effectivePrice = new BigNumber(1).div(spot).div(oneMinusFee).toFixed();
      }

      const poolParams = buildAmmPoolParams({
        exists: true,
        asset1: baseAmount,
        asset2: quoteAmount,
        tradingFee: amm.trading_fee,
        assetFrozen,
        asset2Frozen,
      });
      if (poolParams) {
        marginalBuyPrice = ammMarginalBuyPrice(
          poolParams,
          new BigNumber(0),
        ).toFixed();
        marginalSellPrice = ammMarginalSellPrice(
          poolParams,
          new BigNumber(0),
        ).toFixed();
      }
    }

    // 8. Build response
    return Response.json({
      exists: true,
      account: amm.account,
      asset1: baseAmount,
      asset2: quoteAmount,
      lpToken: fromXrplAmount(amm.lp_token),
      tradingFee: amm.trading_fee,
      tradingFeeDisplay: formatAmmFee(amm.trading_fee),
      spotPrice,
      invertedSpotPrice,
      effectivePrice,
      marginalBuyPrice,
      marginalSellPrice,
      assetFrozen,
      asset2Frozen,
      auctionSlot: amm.auction_slot
        ? {
            account: amm.auction_slot.account,
            discountedFee: amm.auction_slot.discounted_fee,
            expiration: amm.auction_slot.expiration?.toString() ?? "",
            price: fromXrplAmount(amm.auction_slot.price),
            timeInterval: amm.auction_slot.time_interval ?? 0,
          }
        : null,
      voteSlots: (amm.vote_slots ?? []).map((v) => ({
        account: v.account,
        tradingFee: v.trading_fee,
        voteWeight: v.vote_weight,
      })),
    });
  } catch (err: unknown) {
    // amm_info returns error when no AMM exists for the pair
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("actNotFound") ||
      msg.includes("ammNotFound") ||
      msg.includes("Account not found")
    ) {
      return Response.json({ exists: false });
    }
    return apiErrorResponse(err, "Failed to fetch AMM info");
  }
}
