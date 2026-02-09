import { NextRequest } from "next/server";
import { CredentialDelete } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { encodeCredentialType } from "@/lib/xrpl/credentials";
import { validateRequired, walletFromSeed, validateAddress, validateCredentialType, txFailureResponse, apiErrorResponse } from "@/lib/api";
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

    const result = walletFromSeed(body.seed);
    if ("error" in result) return result.error;
    const { wallet } = result;

    if (body.subject) {
      const badSubject = validateAddress(body.subject, "subject address");
      if (badSubject) return badSubject;
    }

    if (body.issuer) {
      const badIssuer = validateAddress(body.issuer, "issuer address");
      if (badIssuer) return badIssuer;
    }

    const badType = validateCredentialType(body.credentialType);
    if (badType) return badType;

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

    const submitted = await client.submitAndWait(tx, { wallet });

    const failure = txFailureResponse(submitted);
    if (failure) return failure;

    return Response.json({ result: submitted.result }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err, "Failed to delete credential");
  }
}
