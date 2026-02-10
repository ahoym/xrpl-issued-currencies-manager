import { NextRequest } from "next/server";
import { Wallet, AccountSet, AccountSetAsfFlags } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { getTransactionResult, apiErrorResponse } from "@/lib/api";
import type { GenerateAccountResponse, ApiError } from "@/lib/xrpl/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const networkId = resolveNetwork(body.network);
    const client = await getClient(networkId);

    const wallet = Wallet.generate();
    const { balance } = await client.fundWallet(wallet, { amount: "1000" });

    // Enable DefaultRipple so issued currencies can be transferred
    // between non-issuer wallets (rippling through the issuer)
    if (body.isIssuer) {
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
    }

    const response: GenerateAccountResponse = {
      address: wallet.address,
      seed: wallet.seed!,
      publicKey: wallet.publicKey,
      balance: String(balance),
    };

    return Response.json(response, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return apiErrorResponse(err, "Failed to generate account");
  }
}
