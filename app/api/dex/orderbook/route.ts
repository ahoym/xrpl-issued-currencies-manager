import { NextRequest } from "next/server";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { encodeXrplCurrency, fromXrplAmount } from "@/lib/xrpl/currency";
import { apiErrorResponse } from "@/lib/api";
import type { ApiError } from "@/lib/xrpl/types";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const baseCurrency = sp.get("base_currency");
    const baseIssuer = sp.get("base_issuer") ?? undefined;
    const quoteCurrency = sp.get("quote_currency");
    const quoteIssuer = sp.get("quote_issuer") ?? undefined;
    const limit = Number(sp.get("limit") ?? "20");
    const network = sp.get("network") ?? undefined;

    if (!baseCurrency || !quoteCurrency) {
      return Response.json(
        { error: "Missing required query params: base_currency, quote_currency" } satisfies ApiError,
        { status: 400 },
      );
    }

    if (baseCurrency !== "XRP" && !baseIssuer) {
      return Response.json(
        { error: "base_issuer is required for non-XRP base currency" } satisfies ApiError,
        { status: 400 },
      );
    }

    if (quoteCurrency !== "XRP" && !quoteIssuer) {
      return Response.json(
        { error: "quote_issuer is required for non-XRP quote currency" } satisfies ApiError,
        { status: 400 },
      );
    }

    const client = await getClient(resolveNetwork(network));

    const currency1 = baseCurrency === "XRP"
      ? { currency: "XRP" }
      : { currency: encodeXrplCurrency(baseCurrency), issuer: baseIssuer! };

    const currency2 = quoteCurrency === "XRP"
      ? { currency: "XRP" }
      : { currency: encodeXrplCurrency(quoteCurrency), issuer: quoteIssuer! };

    const orderbook = await client.getOrderbook(currency1, currency2, { limit });

    const normalize = (offers: typeof orderbook.buy) =>
      offers.map((offer) => ({
        account: offer.Account,
        taker_gets: fromXrplAmount(offer.TakerGets),
        taker_pays: fromXrplAmount(offer.TakerPays),
        quality: offer.quality,
        owner_funds: offer.owner_funds,
        flags: offer.Flags,
        sequence: offer.Sequence,
      }));

    return Response.json({
      base: { currency: baseCurrency, issuer: baseIssuer },
      quote: { currency: quoteCurrency, issuer: quoteIssuer },
      buy: normalize(orderbook.buy),
      sell: normalize(orderbook.sell),
    });
  } catch (err) {
    return apiErrorResponse(err, "Failed to fetch order book");
  }
}
