import { Wallet, CredentialAccept } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { encodeCredentialType } from "@/lib/xrpl/credentials";
import { getTransactionResult, apiErrorResponse } from "@/lib/api";
import type { AcceptCredentialRequest, ApiError } from "@/lib/xrpl/types";

export async function POST(request: Request) {
  try {
    const body: AcceptCredentialRequest = await request.json();

    if (!body.seed || !body.issuer || !body.credentialType) {
      return Response.json(
        { error: "Missing required fields: seed, issuer, credentialType" } satisfies ApiError,
        { status: 400 },
      );
    }

    const client = await getClient(resolveNetwork(body.network));
    const wallet = Wallet.fromSeed(body.seed);

    const tx: CredentialAccept = {
      TransactionType: "CredentialAccept",
      Account: wallet.address,
      Issuer: body.issuer,
      CredentialType: encodeCredentialType(body.credentialType),
    };

    const result = await client.submitAndWait(tx, { wallet });

    const txResult = getTransactionResult(result.result.meta);
    if (txResult && txResult !== "tesSUCCESS") {
      return Response.json(
        { error: `Transaction failed: ${txResult}`, result: result.result },
        { status: 422 },
      );
    }

    return Response.json({ result: result.result }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err, "Failed to accept credential");
  }
}
