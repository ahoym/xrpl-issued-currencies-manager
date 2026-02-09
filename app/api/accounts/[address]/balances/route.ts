import { NextRequest } from "next/server";
import { dropsToXrp } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { decodeCurrency } from "@/lib/xrpl/currency";
import { getNetworkParam, validateAddress, apiErrorResponse } from "@/lib/api";
import type { CurrencyBalance } from "@/lib/xrpl/types";
import { Assets } from "@/lib/assets";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;

    const badAddress = validateAddress(address, "XRPL address");
    if (badAddress) return badAddress;

    const client = await getClient(resolveNetwork(getNetworkParam(request)));

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
      currency: Assets.XRP,
      value: String(dropsToXrp(accountInfo.result.account_data.Balance)),
    };

    const issuedBalances: CurrencyBalance[] = accountLines.result.lines.map(
      (line) => ({
        currency: decodeCurrency(line.currency),
        value: line.balance,
        issuer: line.account,
      }),
    );

    return Response.json({
      address,
      balances: [xrpBalance, ...issuedBalances],
    });
  } catch (err) {
    return apiErrorResponse(err, "Failed to fetch balances", { checkNotFound: true });
  }
}
