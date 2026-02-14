import type { NextRequest } from "next/server";
import { NETWORKS, resolveNetwork } from "@/lib/xrpl/networks";
import { validateAddress, apiErrorResponse } from "@/lib/api";
import type { ApiError } from "@/lib/xrpl/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;
    const body = await request.json().catch(() => ({}));
    const networkId = resolveNetwork(body.network);

    const badAddress = validateAddress(address, "address");
    if (badAddress) return badAddress;

    const faucet = NETWORKS[networkId].faucet;
    if (!faucet) {
      return Response.json(
        { error: "Faucet is only available on testnet and devnet" } satisfies ApiError,
        { status: 400 },
      );
    }

    const res = await fetch(`${faucet}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destination: address }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return Response.json(
        { error: `Faucet request failed: ${text || res.statusText}` } satisfies ApiError,
        { status: 502 },
      );
    }

    const data = await res.json();
    return Response.json({
      address: data.account?.address ?? address,
      amount: data.amount ?? 0,
    });
  } catch (err) {
    return apiErrorResponse(err, "Failed to fund account from faucet");
  }
}
