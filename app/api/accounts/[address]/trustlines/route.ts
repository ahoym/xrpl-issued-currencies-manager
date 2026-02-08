import { NextRequest } from "next/server";
import { Wallet, TrustSet, isValidClassicAddress } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { encodeXrplCurrency } from "@/lib/xrpl/currency";
import { getNetworkParam, validateRequired, txFailureResponse, apiErrorResponse } from "@/lib/api";
import type { TrustLineRequest, ApiError } from "@/lib/xrpl/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;

    if (!isValidClassicAddress(address)) {
      return Response.json({ error: "Invalid XRPL address" }, { status: 400 });
    }

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

    if (!isValidClassicAddress(address)) {
      return Response.json({ error: "Invalid XRPL address" }, { status: 400 });
    }

    const body: TrustLineRequest = await request.json();

    const invalid = validateRequired(body as unknown as Record<string, unknown>, ["seed", "currency", "issuer", "limit"]);
    if (invalid) return invalid;

    const client = await getClient(resolveNetwork(body.network));

    let wallet: Wallet;
    try {
      wallet = Wallet.fromSeed(body.seed);
    } catch {
      return Response.json({ error: "Invalid seed" }, { status: 400 });
    }

    if (wallet.address !== address) {
      return Response.json(
        { error: "Seed does not match the account address in the URL" } satisfies ApiError,
        { status: 400 },
      );
    }

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
