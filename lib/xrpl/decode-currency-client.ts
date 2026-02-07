/** Decode a 40-char hex XRPL currency code to ASCII. Short codes pass through. */
export function decodeCurrency(code: string): string {
  if (code.length !== 40) return code;
  const stripped = code.replace(/0+$/, "");
  if (stripped.length === 0 || stripped.length % 2 !== 0) return code;
  try {
    const bytes = stripped.match(/.{2}/g)!.map((h) => parseInt(h, 16));
    const decoded = String.fromCharCode(...bytes);
    if (/^[\x20-\x7E]+$/.test(decoded)) return decoded;
  } catch {
    // fall through
  }
  return code;
}
