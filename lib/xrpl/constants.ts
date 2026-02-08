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
