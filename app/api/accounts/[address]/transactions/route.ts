import { NextRequest } from "next/server";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import type { ApiError } from "@/lib/xrpl/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;
    const searchParams = request.nextUrl.searchParams;
    const network = searchParams.get("network") ?? undefined;
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const client = await getClient(resolveNetwork(network));

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
    const message = err instanceof Error ? err.message : "Failed to fetch transactions";
    const status = message.includes("actNotFound") ? 404 : 500;
    return Response.json({ error: message } satisfies ApiError, { status });
  }
}
