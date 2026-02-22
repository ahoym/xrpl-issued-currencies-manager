import { NextRequest } from "next/server";
import { AMMWithdraw, AMMWithdrawFlags } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { toXrplAmount } from "@/lib/xrpl/currency";
import { buildCurrencySpec } from "@/lib/xrpl/amm-helpers";
import { validateRequired, walletFromSeed, txFailureResponse, apiErrorResponse } from "@/lib/api";
import type { WithdrawAmmRequest, ApiError } from "@/lib/xrpl/types";

const AMM_WITHDRAW_ERRORS: Record<string, string> = {
  tecAMM_EMPTY: "This pool has no assets to withdraw.",
  tecAMM_BALANCE: "Cannot complete withdrawal: would drain one side of the pool entirely.",
  tecAMM_FAILED: "Withdrawal failed: the effective price is below your specified limit.",
  tecAMM_INVALID_TOKENS: "Withdrawal amount is too small to process.",
  tecFROZEN: "Cannot withdraw: this currency is frozen by its issuer.",
  tecINSUF_RESERVE_LINE: "Not enough XRP reserve for this withdrawal.",
  tecNO_AUTH: "You are not authorized to hold one of the withdrawn assets.",
  temBAD_AMM_TOKENS: "Invalid LP token specification.",
  terNO_AMM: "No AMM pool exists for this currency pair.",
};

const flagMap: Record<string, number> = {
  "withdraw-all": AMMWithdrawFlags.tfWithdrawAll,
  "two-asset": AMMWithdrawFlags.tfTwoAsset,
  "single-asset": AMMWithdrawFlags.tfSingleAsset,
};

export async function POST(request: NextRequest) {
  try {
    const body: WithdrawAmmRequest = await request.json();

    const invalid = validateRequired(body as unknown as Record<string, unknown>, ["seed", "asset", "asset2", "mode"]);
    if (invalid) return invalid;

    if (!flagMap[body.mode]) {
      return Response.json(
        { error: `Invalid mode. Must be one of: ${Object.keys(flagMap).join(", ")}` } satisfies ApiError,
        { status: 400 },
      );
    }

    if (body.mode === "two-asset") {
      if (!body.amount) {
        return Response.json(
          { error: "amount is required for two-asset mode" } satisfies ApiError,
          { status: 400 },
        );
      }
      if (!body.amount2) {
        return Response.json(
          { error: "amount2 is required for two-asset mode" } satisfies ApiError,
          { status: 400 },
        );
      }
    }

    if (body.mode === "single-asset") {
      if (!body.amount) {
        return Response.json(
          { error: "amount is required for single-asset mode" } satisfies ApiError,
          { status: 400 },
        );
      }
    }

    const seedResult = walletFromSeed(body.seed);
    if ("error" in seedResult) return seedResult.error;
    const wallet = seedResult.wallet;

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

    return Response.json({ result: result.result, ...(poolDeleted ? { poolDeleted: true } : {}) });
  } catch (err) {
    return apiErrorResponse(err, "Failed to withdraw from AMM pool");
  }
}
