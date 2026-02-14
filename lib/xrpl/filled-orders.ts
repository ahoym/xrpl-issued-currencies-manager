import { getBalanceChanges } from "xrpl";
import type { TransactionMetadata, Amount } from "xrpl";
import { decodeCurrency } from "@/lib/xrpl/currency";
import { matchesCurrency } from "@/lib/xrpl/match-currency";
import { Assets } from "@/lib/assets";
import type { FilledOrder } from "@/lib/types";

/** Convert an XRPL Amount to {currency, issuer} for comparison. */
function amountCurrency(amt: Amount): { currency: string; issuer?: string } {
  if (typeof amt === "string") return { currency: Assets.XRP };
  return { currency: decodeCurrency(amt.currency), issuer: amt.issuer };
}

/**
 * Parse filled orders from an XRPL `account_tx` response.
 * Only includes OfferCreate transactions submitted by `walletAddress`
 * that were (at least partially) filled for the given currency pair.
 */
export function parseFilledOrders(
  transactions: unknown[],
  walletAddress: string,
  baseCurrency: string,
  baseIssuer: string | undefined,
  quoteCurrency: string,
  quoteIssuer: string | undefined,
  limit: number,
): FilledOrder[] {
  const results: FilledOrder[] = [];

  for (const rawEntry of transactions) {
    if (results.length >= limit) break;

    const entry = rawEntry as Record<string, unknown>;
    const tx_json = entry.tx_json as Record<string, unknown> | undefined;
    const meta = entry.meta as TransactionMetadata | undefined;

    if (!tx_json || !meta) continue;
    if (tx_json.TransactionType !== "OfferCreate") continue;
    if (typeof meta === "string") continue;
    if (meta.TransactionResult !== "tesSUCCESS") continue;

    // Only include the wallet's own transactions
    if (tx_json.Account !== walletAddress) continue;

    // Use getBalanceChanges to find actually executed amounts
    const changes = getBalanceChanges(meta);

    // Sum positive balance changes for base and quote across non-issuer accounts
    let baseTotal = 0;
    let quoteTotal = 0;

    for (const acctChanges of changes) {
      // Skip issuer entries — trust line changes are mirror-images that would double-count
      if (acctChanges.account === baseIssuer) continue;
      if (acctChanges.account === quoteIssuer) continue;

      for (const bal of acctChanges.balances) {
        const val = parseFloat(bal.value);
        if (val <= 0) continue;

        if (matchesCurrency(bal, baseCurrency, baseIssuer)) {
          // Transaction fee is only paid in XRP by the submitting account — subtract it
          if (baseCurrency === Assets.XRP && acctChanges.account === tx_json.Account) {
            const fee = parseFloat(String(tx_json.Fee ?? "0")) / 1_000_000;
            baseTotal += val - fee;
          } else {
            baseTotal += val;
          }
        } else if (matchesCurrency(bal, quoteCurrency, quoteIssuer)) {
          if (quoteCurrency === Assets.XRP && acctChanges.account === tx_json.Account) {
            const fee = parseFloat(String(tx_json.Fee ?? "0")) / 1_000_000;
            quoteTotal += val - fee;
          } else {
            quoteTotal += val;
          }
        }
      }
    }

    // Both sides must have executed amounts (otherwise the offer just rested, wasn't filled)
    if (baseTotal <= 0 || quoteTotal <= 0) continue;

    // Determine side: if TakerPays matches base currency, it's a buy (taker is buying base)
    const takerPays = amountCurrency(tx_json.TakerPays as Amount);
    const isBuy =
      takerPays.currency === baseCurrency &&
      (baseCurrency === Assets.XRP || takerPays.issuer === baseIssuer);

    // Extract time and hash from entry fields
    const time = (entry.close_time_iso as string) ?? (entry.date as string) ?? "";
    const hash = (entry.hash as string) ?? (tx_json.hash as string | undefined) ?? "";

    const price = quoteTotal / baseTotal;

    results.push({
      side: isBuy ? "buy" : "sell",
      price: price.toPrecision(6),
      baseAmount: baseTotal.toPrecision(6),
      quoteAmount: quoteTotal.toPrecision(6),
      time,
      hash,
    });
  }

  return results;
}
