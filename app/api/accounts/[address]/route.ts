import { NextRequest } from "next/server";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { getNetworkParam, validateAddress, apiErrorResponse } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;

    const badAddress = validateAddress(address, "XRPL address");
    if (badAddress) return badAddress;

    const client = await getClient(resolveNetwork(getNetworkParam(request)));

    const response = await client.request({
      command: "account_info",
      account: address,
      ledger_index: "validated",
    });

    return Response.json(response.result);
  } catch (err) {
    return apiErrorResponse(err, "Failed to fetch account info", { checkNotFound: true });
  }
}
