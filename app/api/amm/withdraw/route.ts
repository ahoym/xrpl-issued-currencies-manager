import { NextRequest } from "next/server";
import { AMMWithdraw, AMMWithdrawFlags } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { toXrplAmount } from "@/lib/xrpl/currency";
import { buildCurrencySpec } from "@/lib/xrpl/amm-helpers";
import {
  validateRequired,
  walletFromSeed,
  validateAmmModeAmounts,
  txFailureResponse,
  apiErrorResponse,
} from "@/lib/api";
import { AMM_WITHDRAW_ERRORS } from "@/lib/xrpl/amm-errors";
import type { WithdrawAmmRequest, ApiError } from "@/lib/xrpl/types";

const flagMap: Record<string, number> = {
  "withdraw-all": AMMWithdrawFlags.tfWithdrawAll,
  "two-asset": AMMWithdrawFlags.tfTwoAsset,
  "single-asset": AMMWithdrawFlags.tfSingleAsset,
};

export async function POST(request: NextRequest) {
  try {
    const body: WithdrawAmmRequest = await request.json();

    const invalid = validateRequired(body, ["seed", "asset", "asset2", "mode"]);
    if (invalid) return invalid;

    if (!flagMap[body.mode]) {
      return Response.json(
        {
          error: `Invalid mode. Must be one of: ${Object.keys(flagMap).join(", ")}`,
        } satisfies ApiError,
        { status: 400 },
      );
    }

    const badAmounts = validateAmmModeAmounts(
      body.mode,
      body.amount,
      body.amount2,
    );
    if (badAmounts) return badAmounts;

    const wallet = walletFromSeed(body.seed);
    if (wallet instanceof Response) return wallet;

    const client = await getClient(resolveNetwork(body.network));

    const tx: AMMWithdraw = {
      TransactionType: "AMMWithdraw",
      Account: wallet.address,
      Asset: buildCurrencySpec(body.asset),
      Asset2: buildCurrencySpec(body.asset2),
      Flags: flagMap[body.mode],
    };

    if (body.amount) tx.Amount = toXrplAmount(body.amount);
    if (body.amount2) tx.Amount2 = toXrplAmount(body.amount2);

    const result = await client.submitAndWait(tx, { wallet });

    const failure = txFailureResponse(result, AMM_WITHDRAW_ERRORS);
    if (failure) return failure;

    let poolDeleted = false;
    if (body.mode === "withdraw-all") {
      try {
        await client.request({
          command: "amm_info",
          asset: buildCurrencySpec(body.asset),
          asset2: buildCurrencySpec(body.asset2),
        });
      } catch {
        poolDeleted = true;
      }
    }

    return Response.json(
      {
        result: result.result,
        ...(poolDeleted ? { poolDeleted: true } : {}),
      },
      { status: 201 },
    );
  } catch (err) {
    return apiErrorResponse(err, "Failed to withdraw from AMM pool");
  }
}
