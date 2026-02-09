import { xrpToDrops, dropsToXrp } from "xrpl";
import type { Amount } from "xrpl";
import type { DexAmount } from "./types";
import { decodeCurrency } from "./decode-currency-client";
import { Assets } from "@/lib/assets";
import {
  MIN_CURRENCY_CODE_LENGTH,
  MAX_CURRENCY_CODE_LENGTH,
  HEX_CURRENCY_CODE_LENGTH,
} from "./constants";

export { decodeCurrency };

/**
 * Encode a currency code for XRPL transactions.
 *
 * - 3-char alphanumeric → pass through (standard code)
 * - Exactly 40 hex chars → pass through (already encoded)
 * - 4–20 chars → hex-encode + right-pad to 40 hex chars
 * - < 3 or 21–39 or > 40 → reject (can't fit in 20-byte field)
 */
export function encodeXrplCurrency(code: string): string {
  if (code.length < MIN_CURRENCY_CODE_LENGTH) {
    throw new Error(
      `Currency code must be at least ${MIN_CURRENCY_CODE_LENGTH} characters, got ${code.length}`,
    );
  }

  // Standard 3-character ASCII code
  if (/^[A-Za-z0-9]{3}$/.test(code)) {
    return code;
  }

  // Already hex-encoded (40 hex chars = 20 bytes)
  if (code.length === HEX_CURRENCY_CODE_LENGTH && /^[0-9A-Fa-f]+$/.test(code)) {
    return code.toUpperCase();
  }

  // Non-standard ASCII codes that fit in 20 bytes (4–20 chars)
  if (code.length > MIN_CURRENCY_CODE_LENGTH && code.length <= MAX_CURRENCY_CODE_LENGTH / 2) {
    const hex = Buffer.from(code, "ascii").toString("hex").toUpperCase();
    return hex.padEnd(HEX_CURRENCY_CODE_LENGTH, "0");
  }

  throw new Error(
    `Currency code must be 3 chars (standard), 4–20 chars (non-standard), or 40 hex chars (pre-encoded), got ${code.length} characters`,
  );
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
