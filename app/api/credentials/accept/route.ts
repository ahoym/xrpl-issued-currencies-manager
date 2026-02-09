import { NextRequest } from "next/server";
import { CredentialAccept } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { encodeCredentialType } from "@/lib/xrpl/credentials";
import { validateRequired, walletFromSeed, validateAddress, validateCredentialType, txFailureResponse, apiErrorResponse } from "@/lib/api";
import type { AcceptCredentialRequest } from "@/lib/xrpl/types";

export async function POST(request: NextRequest) {
  try {
    const body: AcceptCredentialRequest = await request.json();

    const invalid = validateRequired(body as unknown as Record<string, unknown>, ["seed", "issuer", "credentialType"]);
    if (invalid) return invalid;

    const result = walletFromSeed(body.seed);
    if ("error" in result) return result.error;
    const { wallet } = result;

    const badIssuer = validateAddress(body.issuer, "issuer address");
    if (badIssuer) return badIssuer;

    const badType = validateCredentialType(body.credentialType);
    if (badType) return badType;

    const client = await getClient(resolveNetwork(body.network));

    const tx: CredentialAccept = {
      TransactionType: "CredentialAccept",
      Account: wallet.address,
      Issuer: body.issuer,
      CredentialType: encodeCredentialType(body.credentialType),
    };

    const submitted = await client.submitAndWait(tx, { wallet });

    const failure = txFailureResponse(submitted);
    if (failure) return failure;

    return Response.json({ result: submitted.result }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err, "Failed to accept credential");
  }
}
