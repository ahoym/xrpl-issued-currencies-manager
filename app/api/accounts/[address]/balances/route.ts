import { NextRequest } from "next/server";
import { dropsToXrp } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { decodeXrplCurrency } from "@/lib/xrpl/currency";
import type { CurrencyBalance, ApiError } from "@/lib/xrpl/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;
    const network = request.nextUrl.searchParams.get("network") ?? undefined;
    const client = await getClient(resolveNetwork(network));

    const [accountInfo, accountLines] = await Promise.all([
      client.request({
        command: "account_info",
        account: address,
        ledger_index: "validated",
      }),
      client.request({
        command: "account_lines",
        account: address,
        ledger_index: "validated",
      }),
    ]);

    const xrpBalance: CurrencyBalance = {
      currency: "XRP",
      value: String(dropsToXrp(accountInfo.result.account_data.Balance)),
    };

    const issuedBalances: CurrencyBalance[] = accountLines.result.lines.map(
      (line) => ({
        currency: decodeXrplCurrency(line.currency),
        value: line.balance,
        issuer: line.account,
      }),
    );

    return Response.json({
      address,
      balances: [xrpBalance, ...issuedBalances],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch balances";
    const status = message.includes("actNotFound") ? 404 : 500;
    return Response.json({ error: message } satisfies ApiError, { status });
  }
}
