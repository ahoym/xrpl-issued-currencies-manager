/** Seconds between Unix epoch (1970-01-01) and Ripple epoch (2000-01-01). */
export const RIPPLE_EPOCH_OFFSET = 946684800;

/** Ledger flag: DefaultRipple is enabled on the account (lsfDefaultRipple). */
export const LSF_DEFAULT_RIPPLE = 0x00800000;

/** Ledger flag: Credential has been accepted (lsfAccepted). */
export const LSF_ACCEPTED = 0x00010000;

/** Transaction flag: clear NoRipple on a trust line (tfClearNoRipple). */
export const TF_CLEAR_NO_RIPPLE = 0x00040000;

/** Default trust line limit used when setting up recipient trust lines. */
export const DEFAULT_TRUST_LINE_LIMIT = "1000000";

// ---------------------------------------------------------------------------
// API default limits
// ---------------------------------------------------------------------------

/** Default number of offers returned by /accounts/:address/offers. */
export const DEFAULT_ACCOUNT_OFFERS_LIMIT = 200;

/** Default number of items returned by orderbook and trades endpoints. */
export const DEFAULT_ORDERBOOK_LIMIT = 20;

/** Maximum value allowed for user-supplied `limit` query params. */
export const MAX_API_LIMIT = 400;

/**
 * Multiplier applied when fetching transactions to find trades.
 * Many transactions won't match the requested currency pair, so we
 * over-fetch to increase the chance of filling the requested limit.
 */
export const TRADES_FETCH_MULTIPLIER = 5;

/** Default number of transactions returned by /accounts/:address/transactions. */
export const DEFAULT_TRANSACTION_LIMIT = 20;

// ---------------------------------------------------------------------------
// Validation bounds
// ---------------------------------------------------------------------------

/** Minimum number of accepted credentials in a permissioned domain. */
export const MIN_DOMAIN_CREDENTIALS = 1;

/** Maximum number of accepted credentials in a permissioned domain. */
export const MAX_DOMAIN_CREDENTIALS = 10;

/** Maximum length of a credential type string. */
export const MAX_CREDENTIAL_TYPE_LENGTH = 128;

/** XRPL currency code minimum length (standard 3-char codes). */
export const MIN_CURRENCY_CODE_LENGTH = 3;

/** XRPL currency code maximum length (non-standard codes that fit in 20-byte field). */
export const MAX_CURRENCY_CODE_LENGTH = 40;

/** Length of a hex-encoded XRPL currency code. */
export const HEX_CURRENCY_CODE_LENGTH = 40;

// ---------------------------------------------------------------------------
// Epoch conversion helpers
// ---------------------------------------------------------------------------

/** Convert a JS Date (or epoch-ms number) to a Ripple epoch timestamp (seconds since 2000-01-01). */
export function toRippleEpoch(date: Date | number): number {
  const ms = typeof date === "number" ? date : date.getTime();
  return Math.floor(ms / 1000) - RIPPLE_EPOCH_OFFSET;
}

/** Convert a Ripple epoch timestamp to a JS Date. */
export function fromRippleEpoch(rippleSeconds: number): Date {
  return new Date((rippleSeconds + RIPPLE_EPOCH_OFFSET) * 1000);
}
