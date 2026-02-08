import { Wallet, PermissionedDomainDelete } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { getTransactionResult, apiErrorResponse } from "@/lib/api";
import type { DeleteDomainRequest, ApiError } from "@/lib/xrpl/types";

export async function POST(request: Request) {
  try {
    const body: DeleteDomainRequest = await request.json();

    if (!body.seed || !body.domainID) {
      return Response.json(
        { error: "Missing required fields: seed, domainID" } satisfies ApiError,
        { status: 400 },
      );
    }

    const client = await getClient(resolveNetwork(body.network));
    const wallet = Wallet.fromSeed(body.seed);

    const tx: PermissionedDomainDelete = {
      TransactionType: "PermissionedDomainDelete",
      Account: wallet.address,
      DomainID: body.domainID,
    };

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
    return apiErrorResponse(err, "Failed to delete domain");
  }
}
