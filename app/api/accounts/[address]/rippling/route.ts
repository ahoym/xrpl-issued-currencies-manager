import { NextRequest } from "next/server";
import { Wallet, AccountSet, AccountSetAsfFlags, TrustSet } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { getTransactionResult, apiErrorResponse } from "@/lib/api";
import type { ApiError } from "@/lib/xrpl/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;
    const body = await request.json();

    if (!body.seed) {
      return Response.json(
        { error: "Missing required field: seed" } satisfies ApiError,
        { status: 400 },
      );
    }

    const client = await getClient(resolveNetwork(body.network));
    const wallet = Wallet.fromSeed(body.seed);

    if (wallet.address !== address) {
      return Response.json(
        { error: "Seed does not match the account address in the URL" } satisfies ApiError,
        { status: 400 },
      );
    }

    // Enable DefaultRipple on the account
    const accountSet: AccountSet = {
      TransactionType: "AccountSet",
      Account: wallet.address,
      SetFlag: AccountSetAsfFlags.asfDefaultRipple,
    };

    const setResult = await client.submitAndWait(accountSet, { wallet });
    const setTxResult = getTransactionResult(setResult.result.meta);
    if (setTxResult && setTxResult !== "tesSUCCESS") {
      return Response.json(
        { error: `Failed to enable DefaultRipple: ${setTxResult}` } satisfies ApiError,
        { status: 422 },
      );
    }

    // Clear NoRipple on any existing trust lines so they can also ripple.
    // DefaultRipple only affects newly created trust lines — existing ones
    // retain their NoRipple flag and must be updated individually.
    const accountLines = await client.request({
      command: "account_lines",
      account: wallet.address,
      ledger_index: "validated",
    });

    const noRippleLines = accountLines.result.lines.filter(
      (line) => line.no_ripple === true,
    );

    for (const line of noRippleLines) {
      const trustSet: TrustSet = {
        TransactionType: "TrustSet",
        Account: wallet.address,
        LimitAmount: {
          currency: line.currency,
          issuer: line.account,
          value: line.limit,
        },
        Flags: 0x00040000, // tfClearNoRipple
      };
      const trustResult = await client.submitAndWait(trustSet, { wallet });
      const trustTxResult = getTransactionResult(trustResult.result.meta);
      if (trustTxResult && trustTxResult !== "tesSUCCESS") {
        return Response.json(
          { error: `Failed to clear NoRipple on trust line ${line.currency}: ${trustTxResult}` } satisfies ApiError,
          { status: 422 },
        );
      }
    }

    return Response.json({
      result: { message: "Rippling enabled", trustLinesUpdated: noRippleLines.length },
    }, { status: 200 });
  } catch (err) {
    return apiErrorResponse(err, "Failed to enable rippling");
  }
}
