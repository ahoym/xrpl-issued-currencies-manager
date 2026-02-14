import { NextRequest } from "next/server";
import type { BookOffersRequest, BookOffer } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { encodeXrplCurrency, fromXrplAmount } from "@/lib/xrpl/currency";
import { getNetworkParam, validateCurrencyPair, apiErrorResponse } from "@/lib/api";
import { DEFAULT_ORDERBOOK_LIMIT, MAX_API_LIMIT } from "@/lib/xrpl/constants";
import { Assets } from "@/lib/assets";

function normalizeOffer(offer: BookOffer) {
  return {
    account: offer.Account,
    taker_gets: fromXrplAmount(offer.taker_gets_funded),
    taker_pays: fromXrplAmount(offer.taker_pays_funded),
    quality: offer.quality,
    owner_funds: offer.owner_funds,
    flags: offer.Flags,
    sequence: offer.Sequence,
  };
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const rawLimit = parseInt(sp.get("limit") ?? "", 10);
    const limit = Math.min(Number.isNaN(rawLimit) ? DEFAULT_ORDERBOOK_LIMIT : rawLimit, MAX_API_LIMIT);
    const network = getNetworkParam(request);
    const domain = sp.get("domain") ?? undefined;

    const pairOrError = validateCurrencyPair(request);
    if (pairOrError instanceof Response) return pairOrError;
    const { baseCurrency, baseIssuer, quoteCurrency, quoteIssuer } = pairOrError;

    const client = await getClient(resolveNetwork(network));

    const currency1 = baseCurrency === Assets.XRP
      ? { currency: Assets.XRP }
      : { currency: encodeXrplCurrency(baseCurrency), issuer: baseIssuer! };

    const currency2 = quoteCurrency === Assets.XRP
      ? { currency: Assets.XRP }
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
