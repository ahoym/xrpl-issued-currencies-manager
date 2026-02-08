import { NextRequest } from "next/server";
import { Wallet, CredentialDelete, isValidClassicAddress } from "xrpl";
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

    let wallet;
    try {
      wallet = Wallet.fromSeed(body.seed);
    } catch {
      return Response.json({ error: "Invalid seed format" }, { status: 400 });
    }

    if (body.subject && !isValidClassicAddress(body.subject)) {
      return Response.json({ error: "Invalid subject address" }, { status: 400 });
    }

    if (body.issuer && !isValidClassicAddress(body.issuer)) {
      return Response.json({ error: "Invalid issuer address" }, { status: 400 });
    }

    if (body.credentialType.length > 128) {
      return Response.json({ error: "credentialType must not exceed 128 characters" }, { status: 400 });
    }

    const client = await getClient(resolveNetwork(body.network));

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
