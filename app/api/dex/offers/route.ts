import { NextRequest } from "next/server";
import { Wallet, OfferCreate } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { toXrplAmount } from "@/lib/xrpl/currency";
import { resolveOfferFlags, VALID_OFFER_FLAGS } from "@/lib/xrpl/offers";
import { validateRequired, txFailureResponse, apiErrorResponse } from "@/lib/api";
import type { CreateOfferRequest, OfferFlag, ApiError } from "@/lib/xrpl/types";

export async function POST(request: NextRequest) {
  try {
    const body: CreateOfferRequest = await request.json();

    const invalid = validateRequired(body as unknown as Record<string, unknown>, ["seed", "takerGets", "takerPays"]);
    if (invalid) return invalid;

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

    if (body.domainID) {
      tx.DomainID = body.domainID;
    }

    const result = await client.submitAndWait(tx, { wallet });

    const failure = txFailureResponse(result);
    if (failure) return failure;

    return Response.json({ result: result.result }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err, "Failed to create offer");
  }
}
