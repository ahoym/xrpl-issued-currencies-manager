/**
 * Decode a 40-char hex XRPL currency code to ASCII. Short codes pass through.
 *
 * XRPL represents non-standard currency codes (4–39 chars) as 40-char hex
 * strings, right-padded with zeros. This function reverses that encoding.
 */
export function decodeCurrency(code: string): string {
  if (code.length !== 40) return code;
  // Strip trailing zero-padding from the hex representation
  const stripped = code.replace(/0+$/, "");
  // Must have at least one byte and be even-length (each byte = 2 hex chars)
  if (stripped.length === 0 || stripped.length % 2 !== 0) return code;
  try {
    const hexPairs = stripped.match(/.{2}/g)!;
    const bytes = hexPairs.map((h) => parseInt(h, 16));
    const decoded = String.fromCharCode(...bytes);
    // Only return decoded text if all characters are printable ASCII (0x20–0x7E)
    if (/^[\x20-\x7E]+$/.test(decoded)) return decoded;
  } catch {
    // Decoding failed — return original hex code
  }
  return code;
}
