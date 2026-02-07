import { NextRequest } from "next/server";
import { Wallet } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import type { GenerateAccountResponse, ApiError } from "@/lib/xrpl/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const networkId = resolveNetwork(body.network);
    const client = await getClient(networkId);

    const wallet = Wallet.generate();
    const { balance } = await client.fundWallet(wallet);

    const response: GenerateAccountResponse = {
      address: wallet.address,
      seed: wallet.seed!,
      publicKey: wallet.publicKey,
      balance: String(balance),
    };

    return Response.json(response, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate account";
    return Response.json({ error: message } satisfies ApiError, { status: 500 });
  }
}
