import { NextRequest } from "next/server";
import { AMMDeposit, AMMDepositFlags } from "xrpl";
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
import { AMM_DEPOSIT_ERRORS } from "@/lib/xrpl/amm-errors";
import type { DepositAmmRequest, ApiError } from "@/lib/xrpl/types";

const flagMap: Record<string, number> = {
  "two-asset": AMMDepositFlags.tfTwoAsset,
  "single-asset": AMMDepositFlags.tfSingleAsset,
  "two-asset-if-empty": AMMDepositFlags.tfTwoAssetIfEmpty,
};

export async function POST(request: NextRequest) {
  try {
    const body: DepositAmmRequest = await request.json();

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

    return Response.json({ result: result.result }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err, "Failed to deposit into AMM pool");
  }
}
