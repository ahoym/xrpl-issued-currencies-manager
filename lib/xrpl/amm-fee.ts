/**
 * Utilities for formatting and parsing AMM trading fees.
 *
 * XRPL represents AMM trading fees as integers 0–1000,
 * where 1 unit = 0.001% (i.e., 300 units = 0.30%).
 */

/**
 * Convert AMM trading fee (0–1000) to display percentage string.
 * Example: 300 → "0.30%", 1000 → "1.00%", 0 → "0.00%"
 */
export function formatAmmFee(fee: number): string {
  return (fee / 1000).toFixed(2) + "%";
}

/**
 * Convert percentage input (e.g., "0.3") to AMM fee units (e.g., 300).
 * Clamps to 0–1000 range.
 */
export function parseAmmFeeInput(percentString: string): number {
  const percent = parseFloat(percentString);
  if (!Number.isFinite(percent)) return 0;
  return Math.round(Math.min(1000, Math.max(0, percent * 1000)));
}
