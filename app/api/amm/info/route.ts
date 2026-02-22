import { NextRequest } from "next/server";
import { validateCurrencyPair, getNetworkParam, apiErrorResponse } from "@/lib/api";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { buildCurrencySpec } from "@/lib/xrpl/amm-helpers";
import { formatAmmFee } from "@/lib/xrpl/amm-fee";
import { fromXrplAmount } from "@/lib/xrpl/currency";
import { Assets } from "@/lib/assets";

export async function GET(request: NextRequest) {
  // 1. Parse & validate query params
  const pairResult = validateCurrencyPair(request);
  if (pairResult instanceof Response) return pairResult;
  const { baseCurrency, baseIssuer, quoteCurrency, quoteIssuer } = pairResult;
  const network = getNetworkParam(request);

  // 2. Build XRPL Currency specs for amm_info
  const asset = buildCurrencySpec({ currency: baseCurrency, issuer: baseIssuer });
  const asset2 = buildCurrencySpec({ currency: quoteCurrency, issuer: quoteIssuer });

  try {
    const client = await getClient(resolveNetwork(network));
    const response = await client.request({
      command: "amm_info",
      asset,
      asset2,
    });

    const amm = response.result.amm;

    // 3. Extract and normalize amounts
    const amount1 = fromXrplAmount(amm.amount as any);
    const amount2Val = fromXrplAmount(amm.amount2 as any);

    // 4. Determine if response asset order matches query base/quote
    const amount1IsBase =
      amount1.currency === baseCurrency &&
      (baseCurrency === Assets.XRP || amount1.issuer === baseIssuer);

    const [baseAmount, quoteAmount] = amount1IsBase
      ? [amount1, amount2Val]
      : [amount2Val, amount1];

    // 5. Calculate spot price (price of 1 base in quote terms)
    const spotPrice =
      parseFloat(baseAmount.value) > 0
        ? (parseFloat(quoteAmount.value) / parseFloat(baseAmount.value)).toString()
        : "0";

    // 6. Normalize frozen flags to match user's base/quote orientation
    const rawAssetFrozen = !!(amm as any).asset_frozen;
    const rawAsset2Frozen = !!(amm as any).asset2_frozen;
    const [assetFrozen, asset2Frozen] = amount1IsBase
      ? [rawAssetFrozen, rawAsset2Frozen]
      : [rawAsset2Frozen, rawAssetFrozen];

    // 7. Build response
    return Response.json({
      exists: true,
      account: amm.account,
      asset1: baseAmount,
      asset2: quoteAmount,
      lpToken: fromXrplAmount(amm.lp_token as any),
      tradingFee: amm.trading_fee,
      tradingFeeDisplay: formatAmmFee(amm.trading_fee),
      spotPrice,
      assetFrozen,
      asset2Frozen,
      auctionSlot: amm.auction_slot
        ? {
            account: amm.auction_slot.account,
            discountedFee: amm.auction_slot.discounted_fee,
            expiration: amm.auction_slot.expiration?.toString() ?? "",
            price: fromXrplAmount(amm.auction_slot.price as any),
            timeInterval: amm.auction_slot.time_interval ?? 0,
          }
        : null,
      voteSlots: (amm.vote_slots ?? []).map((v: any) => ({
        account: v.account,
        tradingFee: v.trading_fee,
        voteWeight: v.vote_weight,
      })),
    });
  } catch (err: unknown) {
    // amm_info returns error when no AMM exists for the pair
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("actNotFound") || msg.includes("ammNotFound")) {
      return Response.json({ exists: false });
    }
    return apiErrorResponse(err, "Failed to fetch AMM info");
  }
}
