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
    const network = request.nextUrl.searchParams.get("network") ?? undefined;
    const client = await getClient(resolveNetwork(network));

    const response = await client.request({
      command: "account_info",
      account: address,
      ledger_index: "validated",
    });

    return Response.json(response.result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch account info";
    const status = message.includes("actNotFound") ? 404 : 500;
    return Response.json({ error: message } satisfies ApiError, { status });
  }
}
