import { NextRequest } from "next/server";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { DEFAULT_TRANSACTION_LIMIT } from "@/lib/xrpl/constants";
import { getNetworkParam, validateAddress, apiErrorResponse, parseLimit } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;

    const badAddress = validateAddress(address, "XRPL address");
    if (badAddress) return badAddress;

    const sp = request.nextUrl.searchParams;
    const limit = parseLimit(sp, DEFAULT_TRANSACTION_LIMIT);
    const client = await getClient(resolveNetwork(getNetworkParam(request)));

    const response = await client.request({
      command: "account_tx",
      account: address,
      limit,
    });

    return Response.json({
      address,
      transactions: response.result.transactions,
    });
  } catch (err) {
    return apiErrorResponse(err, "Failed to fetch transactions", {
      checkNotFound: true,
    });
  }
}
