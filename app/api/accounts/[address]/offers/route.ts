import { NextRequest } from "next/server";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { DEFAULT_ACCOUNT_OFFERS_LIMIT, MAX_API_LIMIT } from "@/lib/xrpl/constants";
import { fromXrplAmount } from "@/lib/xrpl/currency";
import { getNetworkParam, validateAddress, apiErrorResponse } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;

    const badAddress = validateAddress(address, "XRPL address");
    if (badAddress) return badAddress;

    const sp = request.nextUrl.searchParams;
    const rawLimit = parseInt(sp.get("limit") ?? "", 10);
    const limit = Math.min(Number.isNaN(rawLimit) ? DEFAULT_ACCOUNT_OFFERS_LIMIT : rawLimit, MAX_API_LIMIT);
    const rawMarker = sp.get("marker") ?? undefined;
    if (rawMarker !== undefined && (rawMarker.length === 0 || rawMarker.length > 256)) {
      return Response.json({ error: "Invalid marker value" }, { status: 400 });
    }
    const marker = rawMarker;

    const client = await getClient(resolveNetwork(getNetworkParam(request)));

    const response = await client.request({
      command: "account_offers",
      account: address,
      limit,
      marker,
      ledger_index: "validated",
    });

    const offers = response.result.offers?.map((offer) => {
      const mapped: Record<string, unknown> = {
        seq: offer.seq,
        flags: offer.flags,
        taker_gets: fromXrplAmount(offer.taker_gets),
        taker_pays: fromXrplAmount(offer.taker_pays),
        quality: offer.quality,
        expiration: offer.expiration,
      };
      // XLS-80: include DomainID if the offer was placed on a permissioned DEX
      const domainID = (offer as unknown as Record<string, unknown>).DomainID;
      if (domainID) {
        mapped.domainID = domainID;
      }
      return mapped;
    }) ?? [];

    const result: Record<string, unknown> = { address, offers };
    if (response.result.marker) {
      result.marker = response.result.marker;
    }

    return Response.json(result);
  } catch (err) {
    return apiErrorResponse(err, "Failed to fetch offers", { checkNotFound: true });
  }
}
