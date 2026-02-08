import { NextRequest } from "next/server";
import type { BookOffersRequest, BookOffer } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { encodeXrplCurrency, fromXrplAmount } from "@/lib/xrpl/currency";
import { getNetworkParam, apiErrorResponse } from "@/lib/api";
import { DEFAULT_ORDERBOOK_LIMIT } from "@/lib/xrpl/constants";
import type { ApiError } from "@/lib/xrpl/types";

function normalizeOffer(offer: BookOffer) {
  return {
    account: offer.Account,
    taker_gets: fromXrplAmount(offer.TakerGets),
    taker_pays: fromXrplAmount(offer.TakerPays),
    quality: offer.quality,
    owner_funds: offer.owner_funds,
    flags: offer.Flags,
    sequence: offer.Sequence,
  };
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const baseCurrency = sp.get("base_currency");
    const baseIssuer = sp.get("base_issuer") ?? undefined;
    const quoteCurrency = sp.get("quote_currency");
    const quoteIssuer = sp.get("quote_issuer") ?? undefined;
    const limit = Number(sp.get("limit") ?? String(DEFAULT_ORDERBOOK_LIMIT));
    const network = getNetworkParam(request);
    const domain = sp.get("domain") ?? undefined;

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

    // Permissioned DEX: use raw book_offers because client.getOrderbook doesn't support the domain parameter
    if (domain) {
      const askReq: BookOffersRequest = {
        command: "book_offers",
        taker_gets: currency1,
        taker_pays: currency2,
        limit,
        domain,
      };
      const bidReq: BookOffersRequest = {
        command: "book_offers",
        taker_gets: currency2,
        taker_pays: currency1,
        limit,
        domain,
      };

      const [askRes, bidRes] = await Promise.all([
        client.request(askReq),
        client.request(bidReq),
      ]);

      return Response.json({
        base: { currency: baseCurrency, issuer: baseIssuer },
        quote: { currency: quoteCurrency, issuer: quoteIssuer },
        domain,
        sell: askRes.result.offers.map(normalizeOffer),
        buy: bidRes.result.offers.map(normalizeOffer),
      });
    }

    // Open DEX: use existing getOrderbook sugar
    const orderbook = await client.getOrderbook(currency1, currency2, { limit });

    const normalizeMany = (offers: typeof orderbook.buy) =>
      offers.map(normalizeOffer);

    return Response.json({
      base: { currency: baseCurrency, issuer: baseIssuer },
      quote: { currency: quoteCurrency, issuer: quoteIssuer },
      buy: normalizeMany(orderbook.buy),
      sell: normalizeMany(orderbook.sell),
    });
  } catch (err) {
    return apiErrorResponse(err, "Failed to fetch order book");
  }
}
