import { NextRequest } from "next/server";
import { Wallet, PermissionedDomainDelete } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { validateRequired, txFailureResponse, apiErrorResponse } from "@/lib/api";
import type { DeleteDomainRequest } from "@/lib/xrpl/types";

export async function POST(request: NextRequest) {
  try {
    const body: DeleteDomainRequest = await request.json();

    const invalid = validateRequired(body as unknown as Record<string, unknown>, ["seed", "domainID"]);
    if (invalid) return invalid;

    const client = await getClient(resolveNetwork(body.network));
    const wallet = Wallet.fromSeed(body.seed);

    const tx: PermissionedDomainDelete = {
      TransactionType: "PermissionedDomainDelete",
      Account: wallet.address,
      DomainID: body.domainID,
    };

    const result = await client.submitAndWait(tx, { wallet });

    const failure = txFailureResponse(result);
    if (failure) return failure;

    return Response.json({ result: result.result }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err, "Failed to delete domain");
  }
}
