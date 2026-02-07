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
 * Decode an XRPL currency code for display.
 *
 * Standard 3-character codes are returned as-is.
 * 40-character hex strings are decoded back to ASCII (trailing zero-padding stripped).
 */
export function decodeXrplCurrency(code: string): string {
  if (code.length !== 40) {
    return code;
  }

  // Strip trailing zero-padding and decode hex to ASCII
  const stripped = code.replace(/0+$/, "");
  if (stripped.length === 0 || stripped.length % 2 !== 0) {
    return code;
  }

  try {
    const decoded = Buffer.from(stripped, "hex").toString("ascii");
    // Verify all decoded chars are printable ASCII
    if (/^[\x20-\x7E]+$/.test(decoded)) {
      return decoded;
    }
  } catch {
    // fall through
  }

  return code;
}
