import { NextRequest } from "next/server";
import { AMMDeposit, AMMDepositFlags } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { toXrplAmount } from "@/lib/xrpl/currency";
import { buildCurrencySpec } from "@/lib/xrpl/amm-helpers";
import { validateRequired, walletFromSeed, txFailureResponse, apiErrorResponse } from "@/lib/api";
import type { DepositAmmRequest, ApiError } from "@/lib/xrpl/types";

const AMM_DEPOSIT_ERRORS: Record<string, string> = {
  tecAMM_EMPTY: "This pool is empty. Use two-asset-if-empty mode to refund it.",
  tecAMM_NOT_EMPTY: "This pool already has assets. Use a standard deposit instead.",
  tecAMM_FAILED: "Deposit failed: the effective price exceeds your specified limit.",
  tecUNFUNDED_AMM: "Insufficient balance to make this deposit.",
  tecFROZEN: "Cannot deposit: this currency is frozen by its issuer.",
  tecINSUF_RESERVE_LINE: "Not enough XRP reserve to hold LP tokens.",
  temBAD_AMM_TOKENS: "Invalid LP token specification.",
  temBAD_AMOUNT: "Deposit amount must be positive.",
  terNO_AMM: "No AMM pool exists for this currency pair.",
};

const flagMap: Record<string, number> = {
  "two-asset": AMMDepositFlags.tfTwoAsset,
  "single-asset": AMMDepositFlags.tfSingleAsset,
  "two-asset-if-empty": AMMDepositFlags.tfTwoAssetIfEmpty,
};

export async function POST(request: NextRequest) {
  try {
    const body: DepositAmmRequest = await request.json();

    const invalid = validateRequired(body as unknown as Record<string, unknown>, ["seed", "asset", "asset2", "mode"]);
    if (invalid) return invalid;

    if (!flagMap[body.mode]) {
      return Response.json(
        { error: `Invalid mode. Must be one of: ${Object.keys(flagMap).join(", ")}` } satisfies ApiError,
        { status: 400 },
      );
    }

    if (body.mode === "two-asset" || body.mode === "two-asset-if-empty") {
      if (!body.amount) {
        return Response.json(
          { error: `amount is required for ${body.mode} mode` } satisfies ApiError,
          { status: 400 },
        );
      }
      if (!body.amount2) {
        return Response.json(
          { error: `amount2 is required for ${body.mode} mode` } satisfies ApiError,
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

    const tx: AMMDeposit = {
      TransactionType: "AMMDeposit",
      Account: wallet.address,
      Asset: buildCurrencySpec(body.asset),
      Asset2: buildCurrencySpec(body.asset2),
      Flags: flagMap[body.mode],
    };

    if (body.amount) tx.Amount = toXrplAmount(body.amount);
    if (body.amount2) tx.Amount2 = toXrplAmount(body.amount2);

    const result = await client.submitAndWait(tx, { wallet });

    const failure = txFailureResponse(result, AMM_DEPOSIT_ERRORS);
    if (failure) return failure;

    return Response.json({ result: result.result });
  } catch (err) {
    return apiErrorResponse(err, "Failed to deposit into AMM pool");
  }
}
