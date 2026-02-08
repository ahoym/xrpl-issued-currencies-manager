/**
 * Encode a credential type string to uppercase hex.
 * Credential types use raw hex encoding (not the 40-char padded format used for currencies).
 */
export function encodeCredentialType(type: string): string {
  return Buffer.from(type, "utf-8").toString("hex").toUpperCase();
}

/**
 * Decode a hex-encoded credential type back to a UTF-8 string.
 * Falls back to the original hex string if decoding fails.
 */
export function decodeCredentialType(hex: string): string {
  try {
    return Buffer.from(hex, "hex").toString("utf-8");
  } catch {
    return hex;
  }
}
