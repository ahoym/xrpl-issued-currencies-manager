import { NextRequest } from "next/server";
import { OfferCancel } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { validateRequired, walletFromSeed, txFailureResponse, apiErrorResponse } from "@/lib/api";
import type { CancelOfferRequest, ApiError } from "@/lib/xrpl/types";

export async function POST(request: NextRequest) {
  try {
    const body: CancelOfferRequest = await request.json();

    const invalid = validateRequired(body as unknown as Record<string, unknown>, ["seed"]);
    if (invalid) return invalid;

    if (body.offerSequence === undefined) {
      return Response.json(
        { error: "Missing required fields: offerSequence" } satisfies ApiError,
        { status: 400 },
      );
    }

    const seedResult = walletFromSeed(body.seed);
    if ("error" in seedResult) return seedResult.error;
    const wallet = seedResult.wallet;

    const client = await getClient(resolveNetwork(body.network));

    const tx: OfferCancel = {
      TransactionType: "OfferCancel",
      Account: wallet.address,
      OfferSequence: body.offerSequence,
    };

    const result = await client.submitAndWait(tx, { wallet });

    const failure = txFailureResponse(result);
    if (failure) return failure;

    return Response.json({ result: result.result }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err, "Failed to cancel offer");
  }
}
