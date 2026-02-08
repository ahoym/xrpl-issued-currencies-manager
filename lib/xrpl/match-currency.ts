import { decodeCurrency } from "./decode-currency-client";
import type { OrderBookAmount } from "../types";
import { Assets } from "@/lib/assets";

/** Check whether an order-book amount matches a given currency + optional issuer. */
export function matchesCurrency(
  amt: OrderBookAmount,
  currency: string,
  issuer: string | undefined,
): boolean {
  const amtCurrency = decodeCurrency(amt.currency);
  if (amtCurrency !== currency && amt.currency !== currency) return false;
  if (currency === Assets.XRP) return true;
  return amt.issuer === issuer;
}
