import { Wallet, CredentialDelete } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { encodeCredentialType } from "@/lib/xrpl/credentials";
import { getTransactionResult, apiErrorResponse } from "@/lib/api";
import type { DeleteCredentialRequest, ApiError } from "@/lib/xrpl/types";

export async function POST(request: Request) {
  try {
    const body: DeleteCredentialRequest = await request.json();

    if (!body.seed || !body.credentialType) {
      return Response.json(
        { error: "Missing required fields: seed, credentialType" } satisfies ApiError,
        { status: 400 },
      );
    }

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

    const txResult = getTransactionResult(result.result.meta);
    if (txResult && txResult !== "tesSUCCESS") {
      return Response.json(
        { error: `Transaction failed: ${txResult}`, result: result.result },
        { status: 422 },
      );
    }

    return Response.json({ result: result.result }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err, "Failed to delete credential");
  }
}
