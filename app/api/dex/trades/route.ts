import { NextRequest } from "next/server";
import { getBalanceChanges } from "xrpl";
import type { TransactionMetadata, Amount } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { encodeXrplCurrency, decodeCurrency, fromXrplAmount } from "@/lib/xrpl/currency";
import { apiErrorResponse } from "@/lib/api";
import type { ApiError } from "@/lib/xrpl/types";

/** Check if a balance change matches a given currency + optional issuer */
function matchesBalance(
  bal: { currency: string; issuer?: string; value: string },
  currency: string,
  issuer: string | undefined,
): boolean {
  const decoded = decodeCurrency(bal.currency);
  if (decoded !== currency && bal.currency !== currency) return false;
  if (currency === "XRP") return true;
  return bal.issuer === issuer;
}

/** Convert an XRPL Amount to {currency, issuer} for comparison */
function amountCurrency(amt: Amount): { currency: string; issuer?: string } {
  if (typeof amt === "string") return { currency: "XRP" };
  return { currency: decodeCurrency(amt.currency), issuer: amt.issuer };
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const baseCurrency = sp.get("base_currency");
    const baseIssuer = sp.get("base_issuer") ?? undefined;
    const quoteCurrency = sp.get("quote_currency");
    const quoteIssuer = sp.get("quote_issuer") ?? undefined;
    const limit = Number(sp.get("limit") ?? "20");
    const network = sp.get("network") ?? undefined;
    const domain = sp.get("domain") ?? undefined;

    if (!baseCurrency || !quoteCurrency) {
      return Response.json(
        { error: "Missing required query params: base_currency, quote_currency" } satisfies ApiError,
        { status: 400 },
      );
    }

    if (baseCurrency !== "XRP" && !baseIssuer) {
      return Response.json(
        { error: "base_issuer is required for non-XRP base currency" } satisfies ApiError,
        { status: 400 },
      );
    }

    if (quoteCurrency !== "XRP" && !quoteIssuer) {
      return Response.json(
        { error: "quote_issuer is required for non-XRP quote currency" } satisfies ApiError,
        { status: 400 },
      );
    }

    // Determine the issuer account to query — since all issued currency movements
    // touch the issuer's RippleState entries, querying the issuer's account_tx
    // captures ALL trades for that currency regardless of who submitted them.
    const issuerAccount = baseCurrency !== "XRP" ? baseIssuer! : quoteIssuer!;

    const client = await getClient(resolveNetwork(network));

    // Fetch more txns than needed since many won't be matching trades
    const response = await client.request({
      command: "account_tx",
      account: issuerAccount,
      limit: limit * 5,
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

      // Domain filtering
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
        // Skip the issuer's own entries — they see mirror-image trust line changes
        if (acctChanges.account === issuerAccount) continue;

        for (const bal of acctChanges.balances) {
          const val = parseFloat(bal.value);
          if (val <= 0) continue;

          if (matchesBalance(bal, baseCurrency, baseIssuer)) {
            // For XRP, subtract fee if this is the submitting account
            if (baseCurrency === "XRP" && acctChanges.account === tx.Account) {
              const fee = parseFloat(String(tx.Fee ?? "0")) / 1_000_000;
              baseTotal += val - fee;
            } else {
              baseTotal += val;
            }
          } else if (matchesBalance(bal, quoteCurrency, quoteIssuer)) {
            if (quoteCurrency === "XRP" && acctChanges.account === tx.Account) {
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
        (baseCurrency === "XRP" || takerPays.issuer === baseIssuer);

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
