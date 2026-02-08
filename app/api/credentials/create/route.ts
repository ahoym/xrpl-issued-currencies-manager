import { NextRequest } from "next/server";
import { Wallet, CredentialCreate, isValidClassicAddress } from "xrpl";
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

    let wallet;
    try {
      wallet = Wallet.fromSeed(body.seed);
    } catch {
      return Response.json({ error: "Invalid seed format" }, { status: 400 });
    }

    if (!isValidClassicAddress(body.subject)) {
      return Response.json({ error: "Invalid subject address" }, { status: 400 });
    }

    if (body.credentialType.length > 128) {
      return Response.json({ error: "credentialType must not exceed 128 characters" }, { status: 400 });
    }

    if (body.uri && Buffer.byteLength(body.uri, "utf-8") > 256) {
      return Response.json({ error: "URI must not exceed 256 bytes" }, { status: 400 });
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

    const result = await client.submitAndWait(tx, { wallet });

    const failure = txFailureResponse(result);
    if (failure) return failure;

    return Response.json({ result: result.result }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err, "Failed to create credential");
  }
}
