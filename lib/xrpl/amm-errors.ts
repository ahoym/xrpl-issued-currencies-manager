/**
 * Centralized error message maps for AMM transactions.
 * These map XRPL transaction engine result codes to user-friendly messages.
 */

export const AMM_CREATE_ERRORS: Record<string, string> = {
  tecDUPLICATE: "An AMM pool already exists for this currency pair.",
  tecAMM_UNFUNDED: "Insufficient balance to fund the pool.",
  tecFROZEN: "Cannot create pool: one or both currencies are frozen.",
  tecNO_AUTH: "You are not authorized to hold one of the pool assets.",
  tecNO_LINE: "You need a trust line for both assets before creating a pool.",
  tecNO_PERMISSION:
    "One of the selected currencies cannot be used in an AMM pool.",
  tecAMM_INVALID_TOKENS:
    "Invalid asset selection. These currencies conflict with LP token encoding.",
  tecINSUF_RESERVE_LINE: "Not enough XRP reserve to hold LP tokens.",
  terNO_RIPPLE: "The token issuer must enable Default Ripple first.",
  temAMM_BAD_TOKENS:
    "Invalid asset pair. Both assets must be different currencies.",
  temBAD_FEE: "Trading fee must be between 0% and 1% (0-1000).",
};

export const AMM_DEPOSIT_ERRORS: Record<string, string> = {
  tecAMM_EMPTY: "This pool is empty. Use two-asset-if-empty mode to refund it.",
  tecAMM_NOT_EMPTY:
    "This pool already has assets. Use a standard deposit instead.",
  tecAMM_FAILED:
    "Deposit failed: the effective price exceeds your specified limit.",
  tecUNFUNDED_AMM: "Insufficient balance to make this deposit.",
  tecFROZEN: "Cannot deposit: this currency is frozen by its issuer.",
  tecINSUF_RESERVE_LINE: "Not enough XRP reserve to hold LP tokens.",
  temBAD_AMM_TOKENS: "Invalid LP token specification.",
  temBAD_AMOUNT: "Deposit amount must be positive.",
  terNO_AMM: "No AMM pool exists for this currency pair.",
};

export const AMM_WITHDRAW_ERRORS: Record<string, string> = {
  tecAMM_EMPTY: "This pool has no assets to withdraw.",
  tecAMM_BALANCE:
    "Cannot complete withdrawal: would drain one side of the pool entirely.",
  tecAMM_FAILED:
    "Withdrawal failed: the effective price is below your specified limit.",
  tecAMM_INVALID_TOKENS: "Withdrawal amount is too small to process.",
  tecFROZEN: "Cannot withdraw: this currency is frozen by its issuer.",
  tecINSUF_RESERVE_LINE: "Not enough XRP reserve for this withdrawal.",
  tecNO_AUTH: "You are not authorized to hold one of the withdrawn assets.",
  temBAD_AMM_TOKENS: "Invalid LP token specification.",
  terNO_AMM: "No AMM pool exists for this currency pair.",
};
