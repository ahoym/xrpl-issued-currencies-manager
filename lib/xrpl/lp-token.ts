/**
 * Utilities for detecting and formatting AMM LP token currencies.
 *
 * LP token currency codes are 40-char hex strings where the first byte is 0x03,
 * encoding the 160-bit hash of the AMM's asset pair.
 */

/**
 * Detect whether a currency code is an AMM LP token.
 * LP tokens use 160-bit hex codes where the first byte is 0x03.
 */
export function isLpTokenCurrency(currencyCode: string): boolean {
  return currencyCode.length === 40 && currencyCode.startsWith("03");
}

/**
 * Format LP token for display.
 * Returns "LP (BASE/QUOTE)" if asset pair info is available, otherwise "LP Token".
 */
export function formatLpTokenLabel(
  currencyCode: string,
  assetPair?: { base: string; quote: string },
): string {
  if (!isLpTokenCurrency(currencyCode)) return currencyCode;
  if (assetPair) return `LP (${assetPair.base}/${assetPair.quote})`;
  return "LP Token";
}
