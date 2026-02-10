import { NextRequest } from "next/server";
import { getBalanceChanges } from "xrpl";
import type { TransactionMetadata, Amount } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { decodeCurrency } from "@/lib/xrpl/currency";
import { matchesCurrency } from "@/lib/xrpl/match-currency";
import { getNetworkParam, validateCurrencyPair, apiErrorResponse } from "@/lib/api";
import { DEFAULT_ORDERBOOK_LIMIT, MAX_API_LIMIT, TRADES_FETCH_MULTIPLIER } from "@/lib/xrpl/constants";
import { Assets } from "@/lib/assets";

/** Convert an XRPL Amount to {currency, issuer} for comparison */
function amountCurrency(amt: Amount): { currency: string; issuer?: string } {
  if (typeof amt === "string") return { currency: Assets.XRP };
  return { currency: decodeCurrency(amt.currency), issuer: amt.issuer };
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const rawLimit = parseInt(sp.get("limit") ?? "", 10);
    const limit = Math.min(Number.isNaN(rawLimit) ? DEFAULT_ORDERBOOK_LIMIT : rawLimit, MAX_API_LIMIT);
    const network = getNetworkParam(request);
    const domain = sp.get("domain") ?? undefined;

    const pairOrError = validateCurrencyPair(request);
    if (pairOrError instanceof Response) return pairOrError;
    const { baseCurrency, baseIssuer, quoteCurrency, quoteIssuer } = pairOrError;

    // Determine the issuer account to query — since all issued currency movements
    // touch the issuer's RippleState entries, querying the issuer's account_tx
    // captures ALL trades for that currency regardless of who submitted them.
    const issuerAccount = baseCurrency !== Assets.XRP ? baseIssuer! : quoteIssuer!;

    const client = await getClient(resolveNetwork(network));

    // Fetch more txns than needed since many won't be matching trades
    const response = await client.request({
      command: "account_tx",
      account: issuerAccount,
      limit: limit * TRADES_FETCH_MULTIPLIER,
    });

    interface Trade {
      side: "buy" | "sell";
      price: string;
      baseAmount: string;
      quoteAmount: string;
      account: string;
      time: string;
      hash: string;
    }

    const trades: Trade[] = [];

    for (const entry of response.result.transactions) {
      if (trades.length >= limit) break;

      const tx = entry.tx_json;
      const meta = entry.meta as TransactionMetadata | undefined;
      if (!tx || !meta) continue;
      if (tx.TransactionType !== "OfferCreate") continue;
      if (typeof meta === "string") continue;
      if (meta.TransactionResult !== "tesSUCCESS") continue;

      // Filter by domain: if a domain is specified, only include matching trades; otherwise exclude permissioned-domain trades from the open DEX results
      const txDomainID = (tx as Record<string, unknown>).DomainID as string | undefined;
      if (domain) {
        if (txDomainID !== domain) continue;
      } else {
        if (txDomainID) continue;
      }

      // Use getBalanceChanges to find actually executed amounts
      const changes = getBalanceChanges(meta);

      // Sum positive balance changes for base and quote across non-issuer accounts
      let baseTotal = 0;
      let quoteTotal = 0;

      for (const acctChanges of changes) {
        // Skip issuer's entries — trust line changes are mirror-images that would double-count
        if (acctChanges.account === issuerAccount) continue;

        for (const bal of acctChanges.balances) {
          const val = parseFloat(bal.value);
          if (val <= 0) continue;

          if (matchesCurrency(bal, baseCurrency, baseIssuer)) {
            // Transaction fee is only paid in XRP by the submitting account — subtract it to get the net traded amount
            if (baseCurrency === Assets.XRP && acctChanges.account === tx.Account) {
              const fee = parseFloat(String(tx.Fee ?? "0")) / 1_000_000;
              baseTotal += val - fee;
            } else {
              baseTotal += val;
            }
          } else if (matchesCurrency(bal, quoteCurrency, quoteIssuer)) {
            if (quoteCurrency === Assets.XRP && acctChanges.account === tx.Account) {
              const fee = parseFloat(String(tx.Fee ?? "0")) / 1_000_000;
              quoteTotal += val - fee;
            } else {
              quoteTotal += val;
            }
          }
        }
      }

      // Both sides must have executed amounts (otherwise the offer just rested)
      if (baseTotal <= 0 || quoteTotal <= 0) continue;

      // Determine side: if TakerPays matches base currency, it's a buy (taker is buying base)
      const takerPays = amountCurrency(tx.TakerPays as Amount);
      const isBuy =
        takerPays.currency === baseCurrency &&
        (baseCurrency === Assets.XRP || takerPays.issuer === baseIssuer);

      // Extract time and hash from entry fields
      const entryAny = entry as unknown as Record<string, unknown>;
      const time = (entryAny.close_time_iso as string) ?? (entryAny.date as string) ?? "";
      const hash = (entryAny.hash as string) ?? (tx.hash as string | undefined) ?? "";

      const price = quoteTotal / baseTotal;

      trades.push({
        side: isBuy ? "buy" : "sell",
        price: price.toPrecision(6),
        baseAmount: baseTotal.toPrecision(6),
        quoteAmount: quoteTotal.toPrecision(6),
        account: tx.Account as string,
        time,
        hash,
      });
    }

    return Response.json({
      base: { currency: baseCurrency, issuer: baseIssuer },
      quote: { currency: quoteCurrency, issuer: quoteIssuer },
      domain,
      trades,
    });
  } catch (err) {
    return apiErrorResponse(err, "Failed to fetch recent trades");
  }
}
