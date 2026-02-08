import { NextRequest } from "next/server";
import { Wallet, CredentialAccept } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { encodeCredentialType } from "@/lib/xrpl/credentials";
import { validateRequired, txFailureResponse, apiErrorResponse } from "@/lib/api";
import type { AcceptCredentialRequest } from "@/lib/xrpl/types";

export async function POST(request: NextRequest) {
  try {
    const body: AcceptCredentialRequest = await request.json();

    const invalid = validateRequired(body as unknown as Record<string, unknown>, ["seed", "issuer", "credentialType"]);
    if (invalid) return invalid;

    const client = await getClient(resolveNetwork(body.network));
    const wallet = Wallet.fromSeed(body.seed);

    const tx: CredentialAccept = {
      TransactionType: "CredentialAccept",
      Account: wallet.address,
      Issuer: body.issuer,
      CredentialType: encodeCredentialType(body.credentialType),
    };

    const result = await client.submitAndWait(tx, { wallet });

    const failure = txFailureResponse(result);
    if (failure) return failure;

    return Response.json({ result: result.result }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err, "Failed to accept credential");
  }
}
