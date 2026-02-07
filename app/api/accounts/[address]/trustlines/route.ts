import { NextRequest } from "next/server";
import { Wallet, TrustSet } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { encodeXrplCurrency } from "@/lib/xrpl/currency";
import type { TrustLineRequest, ApiError } from "@/lib/xrpl/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;
    const network = request.nextUrl.searchParams.get("network") ?? undefined;
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
    const message = err instanceof Error ? err.message : "Failed to fetch trust lines";
    const status = message.includes("actNotFound") ? 404 : 500;
    return Response.json({ error: message } satisfies ApiError, { status });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;
    const body: TrustLineRequest = await request.json();

    if (!body.seed || !body.currency || !body.issuer || !body.limit) {
      return Response.json(
        { error: "Missing required fields: seed, currency, issuer, limit" } satisfies ApiError,
        { status: 400 },
      );
    }

    const client = await getClient(resolveNetwork(body.network));
    const wallet = Wallet.fromSeed(body.seed);

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

    return Response.json({
      result: result.result,
    }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to set trust line";
    return Response.json({ error: message } satisfies ApiError, { status: 500 });
  }
}
