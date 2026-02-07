import { NextRequest } from "next/server";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { fromXrplAmount } from "@/lib/xrpl/currency";
import type { ApiError } from "@/lib/xrpl/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;
    const network = request.nextUrl.searchParams.get("network") ?? undefined;
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "200");
    const marker = request.nextUrl.searchParams.get("marker") ?? undefined;

    const client = await getClient(resolveNetwork(network));

    const response = await client.request({
      command: "account_offers",
      account: address,
      limit,
      marker,
      ledger_index: "validated",
    });

    const offers = response.result.offers?.map((offer) => ({
      seq: offer.seq,
      flags: offer.flags,
      taker_gets: fromXrplAmount(offer.taker_gets),
      taker_pays: fromXrplAmount(offer.taker_pays),
      quality: offer.quality,
      expiration: offer.expiration,
    })) ?? [];

    const result: Record<string, unknown> = { address, offers };
    if (response.result.marker) {
      result.marker = response.result.marker;
    }

    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch offers";
    const status = message.includes("actNotFound") ? 404 : 500;
    return Response.json({ error: message } satisfies ApiError, { status });
  }
}
