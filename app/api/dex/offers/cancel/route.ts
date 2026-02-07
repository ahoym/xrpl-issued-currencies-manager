import { NextRequest } from "next/server";
import { Wallet, OfferCancel } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { getTransactionResult, apiErrorResponse } from "@/lib/api";
import type { CancelOfferRequest, ApiError } from "@/lib/xrpl/types";

export async function POST(request: NextRequest) {
  try {
    const body: CancelOfferRequest = await request.json();

    if (!body.seed || body.offerSequence === undefined) {
      return Response.json(
        { error: "Missing required fields: seed, offerSequence" } satisfies ApiError,
        { status: 400 },
      );
    }

    const client = await getClient(resolveNetwork(body.network));
    const wallet = Wallet.fromSeed(body.seed);

    const tx: OfferCancel = {
      TransactionType: "OfferCancel",
      Account: wallet.address,
      OfferSequence: body.offerSequence,
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
    return apiErrorResponse(err, "Failed to cancel offer");
  }
}
