import { NextRequest } from "next/server";
import { Wallet, CredentialCreate } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { encodeCredentialType } from "@/lib/xrpl/credentials";
import { validateRequired, txFailureResponse, apiErrorResponse } from "@/lib/api";
import type { CreateCredentialRequest } from "@/lib/xrpl/types";

export async function POST(request: NextRequest) {
  try {
    const body: CreateCredentialRequest = await request.json();

    const invalid = validateRequired(body as unknown as Record<string, unknown>, ["seed", "subject", "credentialType"]);
    if (invalid) return invalid;

    const client = await getClient(resolveNetwork(body.network));
    const wallet = Wallet.fromSeed(body.seed);

    const tx: CredentialCreate = {
      TransactionType: "CredentialCreate",
      Account: wallet.address,
      Subject: body.subject,
      CredentialType: encodeCredentialType(body.credentialType),
    };

    if (body.expiration !== undefined) {
      tx.Expiration = body.expiration;
    }

    if (body.uri) {
      tx.URI = Buffer.from(body.uri, "utf-8").toString("hex").toUpperCase();
    }

    const result = await client.submitAndWait(tx, { wallet });

    const failure = txFailureResponse(result);
    if (failure) return failure;

    return Response.json({ result: result.result }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err, "Failed to create credential");
  }
}
