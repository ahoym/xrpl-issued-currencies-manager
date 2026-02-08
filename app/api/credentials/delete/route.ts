import { NextRequest } from "next/server";
import { Wallet, CredentialDelete } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { encodeCredentialType } from "@/lib/xrpl/credentials";
import { validateRequired, txFailureResponse, apiErrorResponse } from "@/lib/api";
import type { DeleteCredentialRequest, ApiError } from "@/lib/xrpl/types";

export async function POST(request: NextRequest) {
  try {
    const body: DeleteCredentialRequest = await request.json();

    const invalid = validateRequired(body as unknown as Record<string, unknown>, ["seed", "credentialType"]);
    if (invalid) return invalid;

    if (!body.subject && !body.issuer) {
      return Response.json(
        { error: "At least one of subject or issuer is required" } satisfies ApiError,
        { status: 400 },
      );
    }

    const client = await getClient(resolveNetwork(body.network));
    const wallet = Wallet.fromSeed(body.seed);

    const tx: CredentialDelete = {
      TransactionType: "CredentialDelete",
      Account: wallet.address,
      CredentialType: encodeCredentialType(body.credentialType),
    };

    if (body.subject) {
      tx.Subject = body.subject;
    }

    if (body.issuer) {
      tx.Issuer = body.issuer;
    }

    const result = await client.submitAndWait(tx, { wallet });

    const failure = txFailureResponse(result);
    if (failure) return failure;

    return Response.json({ result: result.result }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err, "Failed to delete credential");
  }
}
