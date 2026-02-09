import { NextRequest } from "next/server";
import { TrustSet } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { encodeXrplCurrency } from "@/lib/xrpl/currency";
import { getNetworkParam, validateRequired, walletFromSeed, validateAddress, validateSeedMatchesAddress, txFailureResponse, apiErrorResponse } from "@/lib/api";
import type { TrustLineRequest } from "@/lib/xrpl/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;

    const badAddress = validateAddress(address, "XRPL address");
    if (badAddress) return badAddress;

    const network = getNetworkParam(request);
    const client = await getClient(resolveNetwork(network));

    const response = await client.request({
      command: "account_lines",
      account: address,
      ledger_index: "validated",
    });

    return Response.json({
      address,
      trustLines: response.result.lines,
    });
  } catch (err) {
    return apiErrorResponse(err, "Failed to fetch trust lines", { checkNotFound: true });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;

    const badAddress = validateAddress(address, "XRPL address");
    if (badAddress) return badAddress;

    const body: TrustLineRequest = await request.json();

    const invalid = validateRequired(body as unknown as Record<string, unknown>, ["seed", "currency", "issuer", "limit"]);
    if (invalid) return invalid;

    const client = await getClient(resolveNetwork(body.network));

    const seedResult = walletFromSeed(body.seed);
    if ("error" in seedResult) return seedResult.error;
    const wallet = seedResult.wallet;

    const mismatch = validateSeedMatchesAddress(wallet, address);
    if (mismatch) return mismatch;

    const trustSet: TrustSet = {
      TransactionType: "TrustSet",
      Account: wallet.address,
      LimitAmount: {
        currency: encodeXrplCurrency(body.currency),
        issuer: body.issuer,
        value: body.limit,
      },
    };

    const result = await client.submitAndWait(trustSet, { wallet });

    const failure = txFailureResponse(result);
    if (failure) return failure;

    return Response.json({
      result: result.result,
    }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err, "Failed to set trust line");
  }
}
