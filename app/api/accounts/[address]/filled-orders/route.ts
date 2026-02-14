import { NextRequest } from "next/server";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { DEFAULT_ORDERBOOK_LIMIT, MAX_API_LIMIT, TRADES_FETCH_MULTIPLIER } from "@/lib/xrpl/constants";
import { getNetworkParam, validateAddress, validateCurrencyPair, apiErrorResponse } from "@/lib/api";
import { parseFilledOrders } from "@/lib/xrpl/filled-orders";

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
    const limit = Math.min(Number.isNaN(rawLimit) ? DEFAULT_ORDERBOOK_LIMIT : rawLimit, MAX_API_LIMIT);

    // Validate currency pair from query params
    const pairOrError = validateCurrencyPair(request);
    if (pairOrError instanceof Response) return pairOrError;
    const { baseCurrency, baseIssuer, quoteCurrency, quoteIssuer } = pairOrError;

    const client = await getClient(resolveNetwork(getNetworkParam(request)));

    // Fetch user's own transactions, over-fetching since many won't be matching fills
    const response = await client.request({
      command: "account_tx",
      account: address,
      limit: limit * TRADES_FETCH_MULTIPLIER,
    });

    const filledOrders = parseFilledOrders(
      response.result.transactions,
      address,
      baseCurrency,
      baseIssuer,
      quoteCurrency,
      quoteIssuer,
      limit,
    );

    return Response.json({ address, filledOrders });
  } catch (err) {
    return apiErrorResponse(err, "Failed to fetch filled orders", { checkNotFound: true });
  }
}
