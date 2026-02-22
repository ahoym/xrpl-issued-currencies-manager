import { NextRequest } from "next/server";
import { AMMCreate } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { toXrplAmount } from "@/lib/xrpl/currency";
import { AMM_MAX_TRADING_FEE } from "@/lib/xrpl/constants";
import { validateRequired, walletFromSeed, validatePositiveAmount, txFailureResponse, apiErrorResponse } from "@/lib/api";
import type { CreateAmmRequest, ApiError } from "@/lib/xrpl/types";

const AMM_CREATE_ERRORS: Record<string, string> = {
  tecDUPLICATE: "An AMM pool already exists for this currency pair.",
  tecAMM_UNFUNDED: "Insufficient balance to fund the pool.",
  tecFROZEN: "Cannot create pool: one or both currencies are frozen.",
  tecNO_AUTH: "You are not authorized to hold one of the pool assets.",
  tecNO_LINE: "You need a trust line for both assets before creating a pool.",
  tecNO_PERMISSION: "One of the selected currencies cannot be used in an AMM pool.",
  tecAMM_INVALID_TOKENS: "Invalid asset selection. These currencies conflict with LP token encoding.",
  tecINSUF_RESERVE_LINE: "Not enough XRP reserve to hold LP tokens.",
  terNO_RIPPLE: "The token issuer must enable Default Ripple first.",
  temAMM_BAD_TOKENS: "Invalid asset pair. Both assets must be different currencies.",
  temBAD_FEE: "Trading fee must be between 0% and 1% (0-1000).",
};

export async function POST(request: NextRequest) {
  try {
    const body: CreateAmmRequest = await request.json();

    const invalid = validateRequired(body as unknown as Record<string, unknown>, ["seed", "amount", "amount2", "tradingFee"]);
    if (invalid) return invalid;

    if (!body.amount.currency || !body.amount.value) {
      return Response.json(
        { error: "amount must include currency and value" } satisfies ApiError,
        { status: 400 },
      );
    }

    if (!body.amount2.currency || !body.amount2.value) {
      return Response.json(
        { error: "amount2 must include currency and value" } satisfies ApiError,
        { status: 400 },
      );
    }

    if (body.amount.currency !== "XRP" && !body.amount.issuer) {
      return Response.json(
        { error: "amount.issuer is required for non-XRP currencies" } satisfies ApiError,
        { status: 400 },
      );
    }

    if (body.amount2.currency !== "XRP" && !body.amount2.issuer) {
      return Response.json(
        { error: "amount2.issuer is required for non-XRP currencies" } satisfies ApiError,
        { status: 400 },
      );
    }

    const badAmount = validatePositiveAmount(body.amount.value, "amount.value");
    if (badAmount) return badAmount;

    const badAmount2 = validatePositiveAmount(body.amount2.value, "amount2.value");
    if (badAmount2) return badAmount2;

    if (!Number.isInteger(body.tradingFee) || body.tradingFee < 0 || body.tradingFee > AMM_MAX_TRADING_FEE) {
      return Response.json(
        { error: `tradingFee must be an integer between 0 and ${AMM_MAX_TRADING_FEE}` } satisfies ApiError,
        { status: 400 },
      );
    }

    const seedResult = walletFromSeed(body.seed);
    if ("error" in seedResult) return seedResult.error;
    const wallet = seedResult.wallet;

    const client = await getClient(resolveNetwork(body.network));

    const tx: AMMCreate = {
      TransactionType: "AMMCreate",
      Account: wallet.address,
      Amount: toXrplAmount(body.amount),
      Amount2: toXrplAmount(body.amount2),
      TradingFee: body.tradingFee,
    };

    const result = await client.submitAndWait(tx, { wallet });

    const failure = txFailureResponse(result, AMM_CREATE_ERRORS);
    if (failure) return failure;

    return Response.json({ result: result.result }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err, "Failed to create AMM pool");
  }
}
