import { Wallet, CredentialCreate } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { encodeCredentialType } from "@/lib/xrpl/credentials";
import { getTransactionResult, apiErrorResponse } from "@/lib/api";
import type { CreateCredentialRequest, ApiError } from "@/lib/xrpl/types";

export async function POST(request: Request) {
  try {
    const body: CreateCredentialRequest = await request.json();

    if (!body.seed || !body.subject || !body.credentialType) {
      return Response.json(
        { error: "Missing required fields: seed, subject, credentialType" } satisfies ApiError,
        { status: 400 },
      );
    }

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

    const txResult = getTransactionResult(result.result.meta);
    if (txResult && txResult !== "tesSUCCESS") {
      return Response.json(
        { error: `Transaction failed: ${txResult}`, result: result.result },
        { status: 422 },
      );
    }

    return Response.json({ result: result.result }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err, "Failed to create credential");
  }
}
