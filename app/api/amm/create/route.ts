import { NextRequest } from "next/server";
import { AMMCreate } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { toXrplAmount } from "@/lib/xrpl/currency";
import { AMM_MAX_TRADING_FEE } from "@/lib/xrpl/constants";
import {
  validateRequired,
  walletFromSeed,
  validateDexAmount,
  txFailureResponse,
  apiErrorResponse,
} from "@/lib/api";
import { AMM_CREATE_ERRORS } from "@/lib/xrpl/amm-errors";
import type { CreateAmmRequest, ApiError } from "@/lib/xrpl/types";

export async function POST(request: NextRequest) {
  try {
    const body: CreateAmmRequest = await request.json();

    const invalid = validateRequired(body, [
      "seed",
      "amount",
      "amount2",
      "tradingFee",
    ]);
    if (invalid) return invalid;

    const badAmount = validateDexAmount(body.amount, "amount");
    if (badAmount) return badAmount;

    const badAmount2 = validateDexAmount(body.amount2, "amount2");
    if (badAmount2) return badAmount2;

    if (
      !Number.isInteger(body.tradingFee) ||
      body.tradingFee < 0 ||
      body.tradingFee > AMM_MAX_TRADING_FEE
    ) {
      return Response.json(
        {
          error: `tradingFee must be an integer between 0 and ${AMM_MAX_TRADING_FEE}`,
        } satisfies ApiError,
        { status: 400 },
      );
    }

    const wallet = walletFromSeed(body.seed);
    if (wallet instanceof Response) return wallet;

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
