import { getBalanceChanges } from "xrpl";
import type { TransactionMetadata, Amount } from "xrpl";
import { decodeCurrency } from "@/lib/xrpl/currency";
import { matchesCurrency } from "@/lib/xrpl/match-currency";
import { Assets } from "@/lib/assets";
import type { FilledOrder } from "@/lib/types";

/** Shape of a single entry in the XRPL `account_tx` response. */
interface AccountTxEntry {
  tx_json?: {
    TransactionType: string;
    Account: string;
    Fee?: string;
    TakerPays?: Amount;
    TakerGets?: Amount;
    hash?: string;
  };
  meta?: TransactionMetadata | string;
  close_time_iso?: string;
  date?: string;
  hash?: string;
}

/** Convert an XRPL Amount to {currency, issuer} for comparison. */
function amountCurrency(amt: Amount): { currency: string; issuer?: string } {
  if (typeof amt === "string") return { currency: Assets.XRP };
  return { currency: decodeCurrency(amt.currency), issuer: amt.issuer };
}

/**
 * If the balance change is XRP on the submitting account, subtract the
 * transaction fee (which inflates the apparent balance change).
 */
function adjustForFee(
  value: number,
  currency: string,
  account: string,
  submitter: string,
  feeDrops: string,
): number {
  if (currency === Assets.XRP && account === submitter) {
    return value - parseFloat(feeDrops) / 1_000_000;
  }
  return value;
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

    const entry = rawEntry as AccountTxEntry;
    const { tx_json, meta } = entry;

    if (!tx_json || !meta) continue;
    if (tx_json.TransactionType !== "OfferCreate") continue;
    if (typeof meta === "string") continue;
    if (meta.TransactionResult !== "tesSUCCESS") continue;

    // Only include the wallet's own transactions
    if (tx_json.Account !== walletAddress) continue;

    // Use getBalanceChanges to find actually executed amounts
    const changes = getBalanceChanges(meta);
    const feeDrops = tx_json.Fee ?? "0";

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
          baseTotal += adjustForFee(val, baseCurrency, acctChanges.account, tx_json.Account, feeDrops);
        } else if (matchesCurrency(bal, quoteCurrency, quoteIssuer)) {
          quoteTotal += adjustForFee(val, quoteCurrency, acctChanges.account, tx_json.Account, feeDrops);
        }
      }
    }

    // Both sides must have executed amounts (otherwise the offer just rested, wasn't filled)
    if (baseTotal <= 0 || quoteTotal <= 0) continue;

    // Determine side: if TakerPays matches base currency, it's a buy (taker is buying base)
    const takerPays = tx_json.TakerPays ? amountCurrency(tx_json.TakerPays) : undefined;
    const isBuy =
      takerPays !== undefined &&
      takerPays.currency === baseCurrency &&
      (baseCurrency === Assets.XRP || takerPays.issuer === baseIssuer);

    const time = entry.close_time_iso ?? entry.date ?? "";
    const hash = entry.hash ?? tx_json.hash ?? "";
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
