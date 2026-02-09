import { NextRequest } from "next/server";
import { CredentialCreate } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { encodeCredentialType } from "@/lib/xrpl/credentials";
import { validateRequired, walletFromSeed, validateAddress, validateCredentialType, txFailureResponse, apiErrorResponse } from "@/lib/api";
import type { CreateCredentialRequest, ApiError } from "@/lib/xrpl/types";

export async function POST(request: NextRequest) {
  try {
    const body: CreateCredentialRequest = await request.json();

    const invalid = validateRequired(body as unknown as Record<string, unknown>, ["seed", "subject", "credentialType"]);
    if (invalid) return invalid;

    const result = walletFromSeed(body.seed);
    if ("error" in result) return result.error;
    const { wallet } = result;

    const badSubject = validateAddress(body.subject, "subject address");
    if (badSubject) return badSubject;

    const badType = validateCredentialType(body.credentialType);
    if (badType) return badType;

    if (body.uri && Buffer.byteLength(body.uri, "utf-8") > 256) {
      return Response.json({ error: "URI must not exceed 256 bytes" } satisfies ApiError, { status: 400 });
    }

    const client = await getClient(resolveNetwork(body.network));

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

    const submitted = await client.submitAndWait(tx, { wallet });

    const failure = txFailureResponse(submitted);
    if (failure) return failure;

    return Response.json({ result: submitted.result }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err, "Failed to create credential");
  }
}
