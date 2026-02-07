import { NextRequest } from "next/server";
import { Wallet, AccountSet, AccountSetAsfFlags } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import type { ApiError } from "@/lib/xrpl/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;
    const body = await request.json();

    if (!body.seed) {
      return Response.json(
        { error: "Missing required field: seed" } satisfies ApiError,
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

    const accountSet: AccountSet = {
      TransactionType: "AccountSet",
      Account: wallet.address,
      SetFlag: AccountSetAsfFlags.asfDefaultRipple,
    };

    const result = await client.submitAndWait(accountSet, { wallet });

    return Response.json({ result: result.result }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to enable rippling";
    return Response.json({ error: message } satisfies ApiError, { status: 500 });
  }
}
