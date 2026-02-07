import { NextRequest } from "next/server";
import { Wallet, OfferCreate } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { toXrplAmount } from "@/lib/xrpl/currency";
import { resolveOfferFlags, VALID_OFFER_FLAGS } from "@/lib/xrpl/offers";
import { getTransactionResult, apiErrorResponse } from "@/lib/api";
import type { CreateOfferRequest, OfferFlag, ApiError } from "@/lib/xrpl/types";

export async function POST(request: NextRequest) {
  try {
    const body: CreateOfferRequest = await request.json();

    if (!body.seed || !body.takerGets || !body.takerPays) {
      return Response.json(
        { error: "Missing required fields: seed, takerGets, takerPays" } satisfies ApiError,
        { status: 400 },
      );
    }

    if (!body.takerGets.currency || !body.takerGets.value) {
      return Response.json(
        { error: "takerGets must include currency and value" } satisfies ApiError,
        { status: 400 },
      );
    }

    if (!body.takerPays.currency || !body.takerPays.value) {
      return Response.json(
        { error: "takerPays must include currency and value" } satisfies ApiError,
        { status: 400 },
      );
    }

    if (body.takerGets.currency !== "XRP" && !body.takerGets.issuer) {
      return Response.json(
        { error: "takerGets.issuer is required for non-XRP currencies" } satisfies ApiError,
        { status: 400 },
      );
    }

    if (body.takerPays.currency !== "XRP" && !body.takerPays.issuer) {
      return Response.json(
        { error: "takerPays.issuer is required for non-XRP currencies" } satisfies ApiError,
        { status: 400 },
      );
    }

    if (body.flags) {
      const invalid = body.flags.filter((f) => !VALID_OFFER_FLAGS.includes(f as OfferFlag));
      if (invalid.length > 0) {
        return Response.json(
          { error: `Unknown offer flags: ${invalid.join(", ")}. Valid flags: ${VALID_OFFER_FLAGS.join(", ")}` } satisfies ApiError,
          { status: 400 },
        );
      }
    }

    const client = await getClient(resolveNetwork(body.network));
    const wallet = Wallet.fromSeed(body.seed);

    const tx: OfferCreate = {
      TransactionType: "OfferCreate",
      Account: wallet.address,
      TakerGets: toXrplAmount(body.takerGets),
      TakerPays: toXrplAmount(body.takerPays),
    };

    const flags = resolveOfferFlags(body.flags);
    if (flags !== undefined) {
      tx.Flags = flags;
    }

    if (body.expiration !== undefined) {
      tx.Expiration = body.expiration;
    }

    if (body.offerSequence !== undefined) {
      tx.OfferSequence = body.offerSequence;
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
    return apiErrorResponse(err, "Failed to create offer");
  }
}
