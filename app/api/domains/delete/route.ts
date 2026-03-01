import { NextRequest } from "next/server";
import { PermissionedDomainDelete } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import {
  validateRequired,
  walletFromSeed,
  txFailureResponse,
  apiErrorResponse,
} from "@/lib/api";
import { DOMAIN_ID_REGEX } from "@/lib/xrpl/constants";
import type { DeleteDomainRequest, ApiError } from "@/lib/xrpl/types";

export async function POST(request: NextRequest) {
  try {
    const body: DeleteDomainRequest = await request.json();

    const invalid = validateRequired(
      body,
      ["seed", "domainID"],
    );
    if (invalid) return invalid;

    const wallet = walletFromSeed(body.seed);
    if (wallet instanceof Response) return wallet;

    if (!DOMAIN_ID_REGEX.test(body.domainID.toUpperCase())) {
      return Response.json(
        {
          error: "domainID must be a 64-character hex string",
        } satisfies ApiError,
        { status: 400 },
      );
    }

    const client = await getClient(resolveNetwork(body.network));

    const tx: PermissionedDomainDelete = {
      TransactionType: "PermissionedDomainDelete",
      Account: wallet.address,
      DomainID: body.domainID,
    };

    const submitted = await client.submitAndWait(tx, { wallet });

    const failure = txFailureResponse(submitted);
    if (failure) return failure;

    return Response.json({ result: submitted.result }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err, "Failed to delete domain");
  }
}
