import { NextRequest } from "next/server";
import { Client } from "xrpl";
import type { BookOffersRequest, BookOffer } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { encodeXrplCurrency, fromXrplAmount } from "@/lib/xrpl/currency";
import {
  getNetworkParam,
  validateCurrencyPair,
  apiErrorResponse,
} from "@/lib/api";
import { MAX_API_LIMIT, DOMAIN_ID_REGEX } from "@/lib/xrpl/constants";
import { Assets } from "@/lib/assets";
import { buildAsks, buildBids } from "@/lib/xrpl/order-book-levels";
import { computeMidpriceMetrics } from "@/lib/xrpl/midprice";
import { aggregateDepth } from "@/lib/xrpl/aggregate-depth";

const MAINNET_URL = "wss://xrplcluster.com";

let mainnetClient: Client | null = null;

async function getMainnetClient(): Promise<Client> {
  if (mainnetClient?.isConnected()) {
    return mainnetClient;
  }
  if (mainnetClient) {
    try {
      await mainnetClient.connect();
      return mainnetClient;
    } catch {
      mainnetClient = null;
    }
  }
  mainnetClient = new Client(MAINNET_URL);
  await mainnetClient.connect();
  return mainnetClient;
}

function normalizeOffer(offer: BookOffer) {
  return {
    account: offer.Account,
    taker_gets: fromXrplAmount(offer.TakerGets),
    taker_pays: fromXrplAmount(offer.TakerPays),
    ...(offer.taker_gets_funded
      ? { taker_gets_funded: fromXrplAmount(offer.taker_gets_funded) }
      : {}),
    ...(offer.taker_pays_funded
      ? { taker_pays_funded: fromXrplAmount(offer.taker_pays_funded) }
      : {}),
    quality: offer.quality,
    owner_funds: offer.owner_funds,
    flags: offer.Flags,
    sequence: offer.Sequence,
  };
}

const CACHE_HEADERS = {
  "Cache-Control": "s-maxage=3, stale-while-revalidate=6",
};

export async function GET(request: NextRequest) {
  try {
    const network = getNetworkParam(request);
    const domain =
      request.nextUrl.searchParams.get("domain") ?? undefined;

    if (domain && !DOMAIN_ID_REGEX.test(domain)) {
      return Response.json(
        { error: "Invalid domain ID format" },
        { status: 400 },
      );
    }

    const pairOrError = validateCurrencyPair(request);
    if (pairOrError instanceof Response) return pairOrError;
    const { baseCurrency, baseIssuer, quoteCurrency, quoteIssuer } =
      pairOrError;

    const isMainnet = network === "mainnet";
    const client = isMainnet
      ? await getMainnetClient()
      : await getClient(resolveNetwork(network));

    const currency1 =
      baseCurrency === Assets.XRP
        ? { currency: Assets.XRP }
        : { currency: encodeXrplCurrency(baseCurrency), issuer: baseIssuer! };

    const currency2 =
      quoteCurrency === Assets.XRP
        ? { currency: Assets.XRP }
        : { currency: encodeXrplCurrency(quoteCurrency), issuer: quoteIssuer! };

    // Permissioned DEX: use raw book_offers because client.getOrderbook doesn't support the domain parameter
    if (domain) {
      const [askRes, bidRes] = await Promise.all([
        client.request({
          command: "book_offers",
          taker_gets: currency1,
          taker_pays: currency2,
          limit: MAX_API_LIMIT,
          domain,
        } satisfies BookOffersRequest),
        client.request({
          command: "book_offers",
          taker_gets: currency2,
          taker_pays: currency1,
          limit: MAX_API_LIMIT,
          domain,
        } satisfies BookOffersRequest),
      ]);

      const sell = (askRes.result.offers as BookOffer[]).map(normalizeOffer);
      const buy = (bidRes.result.offers as BookOffer[]).map(normalizeOffer);
      const allOffers = [...buy, ...sell];
      const asks = buildAsks(allOffers, baseCurrency, baseIssuer);
      const bids = buildBids(allOffers, baseCurrency, baseIssuer);
      const { depth } = aggregateDepth(buy, sell);

      return Response.json(
        {
          base: { currency: baseCurrency, issuer: baseIssuer },
          quote: { currency: quoteCurrency, issuer: quoteIssuer },
          domain,
          buy,
          sell,
          depth,
          midprice: computeMidpriceMetrics(asks, bids),
        },
        { headers: CACHE_HEADERS },
      );
    }

    // Open DEX: use getOrderbook for pagination + quality sorting
    const orderbook = await client.getOrderbook(currency1, currency2, {
      limit: MAX_API_LIMIT,
    });

    const buy = orderbook.buy.map(normalizeOffer);
    const sell = orderbook.sell.map(normalizeOffer);
    const allOffers = [...buy, ...sell];
    const asks = buildAsks(allOffers, baseCurrency, baseIssuer);
    const bids = buildBids(allOffers, baseCurrency, baseIssuer);
    const { depth } = aggregateDepth(buy, sell);

    return Response.json(
      {
        base: { currency: baseCurrency, issuer: baseIssuer },
        quote: { currency: quoteCurrency, issuer: quoteIssuer },
        buy,
        sell,
        depth,
        midprice: computeMidpriceMetrics(asks, bids),
      },
      { headers: CACHE_HEADERS },
    );
  } catch (err) {
    return apiErrorResponse(err, "Failed to fetch order book");
  }
}
