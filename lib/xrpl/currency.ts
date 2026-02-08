import { xrpToDrops, dropsToXrp } from "xrpl";
import type { Amount } from "xrpl";
import type { DexAmount } from "./types";
import { decodeCurrency } from "./decode-currency-client";
import { Assets } from "@/lib/assets";

export { decodeCurrency };

/** Minimum length for a non-standard currency code (characters). */
const MIN_CURRENCY_CODE_LENGTH = 1;
/** Maximum length for a non-standard currency code (characters). */
const MAX_CURRENCY_CODE_LENGTH = 20;

/**
 * Encode a currency code for XRPL transactions.
 *
 * Standard 3-character ASCII codes (e.g. "USD") are passed through as-is.
 * Non-standard codes (4–20 chars) are converted to a 40-character uppercase
 * hex string, right-padded with zeros, as required by the XRPL.
 *
 * Throws if the code is empty or longer than 20 characters (the maximum that
 * fits in a 40-hex-char / 20-byte XRPL currency field).
 */
export function encodeXrplCurrency(code: string): string {
  if (
    code.length < MIN_CURRENCY_CODE_LENGTH ||
    code.length > MAX_CURRENCY_CODE_LENGTH
  ) {
    throw new Error(
      `Currency code must be between ${MIN_CURRENCY_CODE_LENGTH} and ${MAX_CURRENCY_CODE_LENGTH} characters, got ${code.length}`,
    );
  }

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
  if (amount.currency === Assets.XRP) {
    return xrpToDrops(amount.value);
  }
  if (!amount.issuer) {
    throw new Error(`issuer is required for non-XRP currency "${amount.currency}"`);
  }
  return {
    currency: encodeXrplCurrency(amount.currency),
    issuer: amount.issuer,
    value: amount.value,
  };
}

/**
 * Convert an XRPL Amount to the API DexAmount format.
 * Drop strings are converted to human-readable XRP. Objects are decoded.
 */
export function fromXrplAmount(amount: Amount): DexAmount {
  if (typeof amount === "string") {
    return { currency: Assets.XRP, value: String(dropsToXrp(amount)) };
  }
  return {
    currency: decodeCurrency(amount.currency),
    issuer: amount.issuer,
    value: amount.value,
  };
}
