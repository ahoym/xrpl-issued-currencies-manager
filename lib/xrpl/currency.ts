import { xrpToDrops, dropsToXrp } from "xrpl";
import type { Amount } from "xrpl";
import type { DexAmount } from "./types";
import { decodeCurrency } from "./decode-currency-client";

export { decodeCurrency };

/**
 * Encode a currency code for XRPL transactions.
 *
 * Standard 3-character ASCII codes (e.g. "USD") are passed through as-is.
 * Non-standard codes (4–39 chars) are converted to a 40-character uppercase
 * hex string, right-padded with zeros, as required by the XRPL.
 */
export function encodeXrplCurrency(code: string): string {
  if (/^[A-Za-z0-9]{3}$/.test(code)) {
    return code;
  }

  const hex = Buffer.from(code, "ascii").toString("hex").toUpperCase();
  return hex.padEnd(40, "0");
}

/**
 * Convert an API DexAmount to the XRPL Amount format.
 * XRP values are converted to drops (string). Issued currencies use the object form.
 */
export function toXrplAmount(amount: DexAmount): Amount {
  if (amount.currency === "XRP") {
    return xrpToDrops(amount.value);
  }
  return {
    currency: encodeXrplCurrency(amount.currency),
    issuer: amount.issuer!,
    value: amount.value,
  };
}

/**
 * Convert an XRPL Amount to the API DexAmount format.
 * Drop strings are converted to human-readable XRP. Objects are decoded.
 */
export function fromXrplAmount(amount: Amount): DexAmount {
  if (typeof amount === "string") {
    return { currency: "XRP", value: String(dropsToXrp(amount)) };
  }
  return {
    currency: decodeCurrency(amount.currency),
    issuer: amount.issuer,
    value: amount.value,
  };
}
