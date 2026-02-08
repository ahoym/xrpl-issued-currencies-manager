import { Wallet, PermissionedDomainSet } from "xrpl";
import type { AuthorizeCredential } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { encodeCredentialType } from "@/lib/xrpl/credentials";
import { getTransactionResult, apiErrorResponse } from "@/lib/api";
import type { CreateDomainRequest, ApiError } from "@/lib/xrpl/types";

export async function POST(request: Request) {
  try {
    const body: CreateDomainRequest = await request.json();

    if (!body.seed || !body.acceptedCredentials || body.acceptedCredentials.length === 0) {
      return Response.json(
        { error: "Missing required fields: seed, acceptedCredentials (1-10 entries)" } satisfies ApiError,
        { status: 400 },
      );
    }

    if (body.acceptedCredentials.length > 10) {
      return Response.json(
        { error: "acceptedCredentials must have at most 10 entries" } satisfies ApiError,
        { status: 400 },
      );
    }

    const client = await getClient(resolveNetwork(body.network));
    const wallet = Wallet.fromSeed(body.seed);

    const acceptedCredentials: AuthorizeCredential[] = body.acceptedCredentials.map((ac) => ({
      Credential: {
        Issuer: ac.issuer,
        CredentialType: encodeCredentialType(ac.credentialType),
      },
    }));

    const tx: PermissionedDomainSet = {
      TransactionType: "PermissionedDomainSet",
      Account: wallet.address,
      AcceptedCredentials: acceptedCredentials,
    };

    if (body.domainID) {
      tx.DomainID = body.domainID;
    }

    const result = await client.submitAndWait(tx, { wallet });

    const txResult = getTransactionResult(result.result.meta);
    if (txResult && txResult !== "tesSUCCESS") {
      return Response.json(
        { error: `Transaction failed: ${txResult}`, result: result.result },
        { status: 422 },
      );
    }

    // Extract DomainID from created node in metadata
    let domainID: string | undefined;
    const meta = result.result.meta;
    if (typeof meta === "object" && meta !== null && "AffectedNodes" in meta) {
      const nodes = (meta as unknown as { AffectedNodes: Array<Record<string, unknown>> }).AffectedNodes;
      for (const node of nodes) {
        if ("CreatedNode" in node) {
          const created = node.CreatedNode as {
            LedgerEntryType: string;
            LedgerIndex: string;
          };
          if (created.LedgerEntryType === "PermissionedDomain") {
            domainID = created.LedgerIndex;
            break;
          }
        }
      }
    }

    return Response.json({ result: result.result, domainID }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err, "Failed to create domain");
  }
}
