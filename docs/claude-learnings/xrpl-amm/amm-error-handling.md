# Deep Research: AMM Error Handling & Edge Cases

> Comprehensive reference for XRPL AMM transaction error codes, edge cases, and recommended UI/API error handling strategies.

## AMM-Specific tec Codes

These are transaction result codes specific to AMM operations. All `tec` codes mean the transaction was applied to the ledger (consuming the fee) but did **not** achieve its intended effect.

| Code | Value | Applies To | Description |
|------|-------|-----------|-------------|
| `tecAMM_UNFUNDED` | 162 | AMMCreate | The sender does not have enough of the specified assets to fund the pool. |
| `tecAMM_BALANCE` | 163 | AMMDeposit, AMMWithdraw | Either the AMM or the user does not hold enough of one of the specified assets. For withdrawals: would withdraw all of one asset, or rounding causes a non-zero remainder. |
| `tecAMM_FAILED` | 164 | AMMDeposit, AMMWithdraw | The conditions on the operation could not be satisfied (e.g., requested effective price in `EPrice` is too low, insufficient assets, or the deposit/withdraw calculation failed). |
| `tecAMM_INVALID_TOKENS` | 165 | AMMCreate, AMMWithdraw | LP token issues — either `Amount`/`Amount2` conflicts with the AMM's LP token currency code, or the withdrawal amount rounds to zero. |
| `tecAMM_EMPTY` | 166 | AMMDeposit, AMMWithdraw | The AMM has no assets in its pool. Cannot perform normal deposits or withdrawals — must use `tfTwoAssetIfEmpty` deposit or `AMMDelete`. |
| `tecAMM_NOT_EMPTY` | 167 | AMMDeposit | Transaction specified `tfTwoAssetIfEmpty` but the AMM is not empty. |
| `tecAMM_ACCOUNT` | 168 | General | The operation is not allowed on AMM accounts (e.g., trying to send a payment from an AMM account). |

## Error Codes by Transaction Type

### AMMCreate

| Code | Cause | User-Friendly Message |
|------|-------|----------------------|
| `tecDUPLICATE` | AMM already exists for this pair | "An AMM pool already exists for this currency pair." |
| `tecAMM_UNFUNDED` | Insufficient balance of one/both assets | "Insufficient balance. You need at least {amount} {currency} and {amount2} {currency2}." |
| `tecFROZEN` | One or both deposit assets are frozen | "Cannot create pool: one or both currencies are frozen by their issuer." |
| `tecNO_AUTH` | Sender not authorized to hold an asset (RequireAuth issuer) | "You are not authorized to hold one of the pool assets." |
| `tecNO_LINE` | Sender has no trust line for one of the assets | "You need a trust line for {currency} before creating this pool." |
| `tecNO_PERMISSION` | An asset cannot be used in an AMM | "One of the selected currencies cannot be used in an AMM pool." |
| `tecAMM_INVALID_TOKENS` | Amount/Amount2 currency code clashes with LP token | "Invalid asset selection. These currencies conflict with LP token encoding." |
| `tecINSUF_RESERVE_LINE` | Insufficient XRP for the LP token trust line | "Not enough XRP reserve to hold LP tokens. You need at least {reserve} XRP available." |
| `terNO_RIPPLE` | Issuer hasn't enabled DefaultRipple | "The token issuer must enable Default Ripple before an AMM can be created." |
| `temAMM_BAD_TOKENS` | Both assets are the same, or invalid spec | "Invalid asset pair. Both assets must be different currencies." |
| `temBAD_FEE` | TradingFee > 1000 or negative | "Trading fee must be between 0% and 1% (0–1000)." |
| `temDISABLED` | AMM feature not enabled on this network | "AMM is not available on this network." |

**Special cost note**: AMMCreate destroys at least the **incremental owner reserve** rather than the standard ~0.00001 XRP transaction cost. As of the 2024 reserve reduction, this is **0.2 XRP** on mainnet (previously 2 XRP). On testnet/devnet the value may differ — use the `fee` API method or xrpl.js autofill to get the current value dynamically.

### AMMDeposit

| Code | Cause | User-Friendly Message |
|------|-------|----------------------|
| `tecAMM_EMPTY` | Pool has no assets, normal deposit disallowed | "This pool is empty. Use 'Create Pool' to refund it with both assets." |
| `tecAMM_NOT_EMPTY` | Used `tfTwoAssetIfEmpty` on non-empty pool | "This pool already has assets. Use a standard deposit instead." |
| `tecAMM_FAILED` | Effective price constraint (`EPrice`) not met | "Deposit failed: the effective price exceeds your specified limit." |
| `tecUNFUNDED_AMM` | Insufficient balance for the deposit | "Insufficient balance to make this deposit." |
| `tecFROZEN` | Depositing a frozen token | "Cannot deposit: this currency is frozen by its issuer." |
| `tecINSUF_RESERVE_LINE` | Not enough XRP for LP token trust line | "Not enough XRP reserve to hold LP tokens." |
| `temBAD_AMM_TOKENS` | LP token spec is wrong (wrong issuer/currency) | "Invalid LP token specification." |
| `temBAD_AMOUNT` | Negative or invalid deposit amount | "Deposit amount must be positive." |
| `temMALFORMED` | Invalid flag/field combination | "Invalid deposit configuration." |
| `terNO_AMM` | AMM doesn't exist for this pair | "No AMM pool exists for this currency pair." |

### AMMWithdraw

| Code | Cause | User-Friendly Message |
|------|-------|----------------------|
| `tecAMM_EMPTY` | Pool already empty | "This pool has no assets to withdraw." |
| `tecAMM_BALANCE` | Would withdraw all of one asset, or rounding error | "Cannot complete withdrawal: would drain one side of the pool entirely." |
| `tecAMM_FAILED` | Effective price constraint not met | "Withdrawal failed: the effective price is below your specified limit." |
| `tecAMM_INVALID_TOKENS` | Withdrawal amount rounds to zero, or LP tokens invalid | "Withdrawal amount is too small to process." |
| `tecFROZEN` | Withdrawing a frozen token | "Cannot withdraw: this currency is frozen by its issuer." |
| `tecINSUF_RESERVE_LINE` | Not enough XRP for new trust line | "Not enough XRP reserve for this withdrawal." |
| `tecNO_AUTH` | Not authorized to hold one of the assets | "You are not authorized to hold one of the withdrawn assets." |
| `temBAD_AMM_TOKENS` | LP token spec is wrong | "Invalid LP token specification." |
| `temMALFORMED` | Invalid flag/field combination | "Invalid withdrawal configuration." |
| `terNO_AMM` | AMM doesn't exist | "No AMM pool exists for this currency pair." |

### amm_info (Query)

| Error Code | Cause | Handling |
|-----------|-------|----------|
| `actNotFound` | No AMM exists for this pair, or account not found | Return `{ exists: false }` — this is the expected "no pool" state, not an error |
| `invalidParams` | Missing/malformed params | Return 400 with validation error |

## Edge Cases

### 1. Frozen Assets

**Scenario**: An issuer freezes a token that's in an AMM pool.

**Effects**:
- LP tokens for that pool also become frozen
- Frozen LP token holders **cannot** send/sell/trade LP tokens
- Frozen LP token holders **can** still receive LP tokens
- `AMMDeposit` fails with `tecFROZEN` if depositing a frozen token
- `AMMWithdraw` fails with `tecFROZEN` if withdrawing a frozen token
- The `amm_info` response includes `asset_frozen` / `asset2_frozen` boolean fields

**UI implications**:
- Check `asset_frozen` / `asset2_frozen` in pool info response
- Show a warning banner: "One or more pool assets are frozen. Deposits and withdrawals may be restricted."
- Disable deposit/withdraw buttons when relevant assets are frozen
- Still show pool info (reserves, fee) for read-only viewing

### 2. Empty Pool State

**Scenario**: All LP tokens are redeemed, draining both assets to zero.

**How it happens**:
- A `tfWithdrawAll` by the sole/last LP holder
- Successive withdrawals that collectively drain the pool

**Effects**:
- If ≤512 trust lines exist: AMM is auto-deleted (ledger entry removed)
- If >512 trust lines exist: AMM enters "empty" state — still exists but has zero reserves
- In empty state: normal deposits (`tfTwoAsset`, `tfSingleAsset`) fail with `tecAMM_EMPTY`
- Only `tfTwoAssetIfEmpty` deposit mode can refund an empty pool
- `AMMDelete` can remove an empty pool

**UI implications**:
- After a `tfWithdrawAll`, re-query `amm_info` to check if pool still exists
- If pool is empty (exists but zero reserves): show "Pool is empty" state with option to re-fund or delete
- The implementation plan's `tfTwoAssetIfEmpty` is intentionally excluded from the initial UI — this is a rare edge case that can be added later

### 3. Pool Deletion & Trust Line Cleanup

**Scenario**: Auto-deletion after last withdrawal may be incomplete.

**Details**:
- Auto-deletion removes up to **512** trust lines in a single transaction
- If an AMM has >512 LP token holders (trust lines), it can't be fully deleted in one step
- Requires repeated `AMMDelete` transactions (each removes up to 512 trust lines)
- After all trust lines removed, the final `AMMDelete` removes the AMM ledger entry

**UI implications**:
- The response from a withdraw-all should indicate whether the pool was fully deleted
- This is an extremely rare edge case — most pools won't have 512+ LP holders
- Not worth special UI treatment in initial implementation

### 4. Rounding & Minimum Amounts

**Scenario**: Very small deposits or withdrawals may round to zero.

**Details**:
- `tecAMM_INVALID_TOKENS` when withdrawal amount rounds to zero
- `tecAMM_BALANCE` when rounding causes a non-zero remainder in withdraw-all
- XRPL uses 15 significant digits of precision for token amounts

**UI implications**:
- Set minimum deposit/withdraw amounts in the UI (e.g., > 0.000001)
- Display a user-friendly error rather than the raw tec code

### 5. Single-Asset Deposit/Withdraw Fee Impact

**Scenario**: Single-asset operations change the pool ratio, incurring the trading fee.

**Details**:
- Two-asset proportional deposits: **no fee** — maintains pool ratio
- Single-asset deposits: **subject to trading fee** — effectively swapping half the deposit
- Single-asset withdrawals: **subject to trading fee** for the same reason
- Withdraw-all: **no fee** — redeems proportional share of both assets

**UI implications**:
- Prominently display: "Single-asset deposits/withdrawals incur the pool's trading fee ({fee}%)"
- Show estimated fee deduction in deposit/withdraw preview
- Recommend two-asset deposits for fee-free operation

### 6. Concurrent Operations / Race Conditions

**Scenario**: Pool state changes between info query and transaction submission.

**Details**:
- Pool reserves change with every trade and deposit/withdraw
- The amounts shown in the UI may be stale by the time the user submits
- `EPrice` field on deposit/withdraw provides slippage protection

**UI implications**:
- Show "rates are approximate" disclaimer
- Consider implementing `EPrice` as a slippage tolerance control (future enhancement, deferred to Phase 4+)
- Refresh pool info on focus/before submission

## Recommended Error Handling Pattern

Follow the existing project pattern from `app/api/transfers/route.ts`:

```typescript
// In each AMM API route, define friendly messages for known tec codes:
const AMM_CREATE_ERRORS: Record<string, string> = {
  tecDUPLICATE: "An AMM pool already exists for this currency pair.",
  tecAMM_UNFUNDED: "Insufficient balance to fund the pool.",
  tecFROZEN: "Cannot create pool: one or both currencies are frozen.",
  tecNO_AUTH: "You are not authorized to hold one of the pool assets.",
  tecNO_LINE: "You need a trust line for both assets before creating a pool.",
  tecNO_PERMISSION: "One of the selected currencies cannot be used in an AMM pool.",
  tecINSUF_RESERVE_LINE: "Not enough XRP reserve to hold LP tokens.",
  terNO_RIPPLE: "The token issuer must enable Default Ripple first.",
};

// After submitAndWait, check for known errors:
const txResult = getTransactionResult(result.result.meta);
if (txResult && txResult !== "tesSUCCESS") {
  const friendlyMessage = AMM_CREATE_ERRORS[txResult];
  return Response.json(
    {
      error: friendlyMessage || `Transaction failed: ${txResult}`,
      code: txResult,
      result: result.result,
    },
    { status: 422 },
  );
}
```

**Differences from the existing `txFailureResponse()` helper**:
- The existing helper returns a generic "Transaction failed: {code}" message
- AMM routes should use error-specific friendly messages (same pattern as `transfers/route.ts`)
- Include the raw `code` field so the frontend can optionally display technical details
- Still include the full `result` for debugging

### Implementation Recommendation (confirmed 2026-02-21)

Extend `txFailureResponse()` in `lib/api.ts` with an optional `errorMap?: Record<string, string>` parameter. This keeps the pattern centralized without breaking existing callers:

```typescript
// lib/api.ts — extended signature
export function txFailureResponse(
  result: TxResponse,
  errorMap?: Record<string, string>,
): Response | null {
  const txResult = getTransactionResult(result.result.meta);
  if (txResult && txResult !== "tesSUCCESS") {
    const friendlyMessage = errorMap?.[txResult];
    return Response.json(
      {
        error: friendlyMessage || `Transaction failed: ${txResult}`,
        ...(friendlyMessage ? { code: txResult } : {}),
        result: result.result,
      },
      { status: 422 },
    );
  }
  return null;
}
```

Each AMM route defines its own error map constant and passes it:
```typescript
const failure = txFailureResponse(result, AMM_CREATE_ERRORS);
if (failure) return failure;
```

Existing callers pass no second argument and continue to work unchanged.

## Impact on Implementation Plan

1. **Task 2.1 (AMMCreate route)**: Add `AMM_CREATE_ERRORS` map with 11 known error codes. Add pre-check via `amm_info` to catch `tecDUPLICATE` with a better error message before submission.

2. **Task 2.2 (AMMDeposit route)**: Add `AMM_DEPOSIT_ERRORS` map with 9 known error codes. Check for `tecAMM_EMPTY` specifically and suggest using the create/refund flow.

3. **Task 2.3 (AMMWithdraw route)**: Add `AMM_WITHDRAW_ERRORS` map with 9 known error codes. After successful `tfWithdrawAll`, re-query `amm_info` to report whether pool was deleted.

4. **Task 1.4 (AMM Info route)**: Handle `actNotFound` as `{ exists: false }` not an error. Check for `asset_frozen` / `asset2_frozen` and include in response.

5. **Task 3.2 (Pool Panel)**: Show frozen asset warnings. Show empty pool state.

6. **Task 3.4 (Deposit/Withdraw modals)**: Show fee warnings for single-asset operations. Disable when assets are frozen.

7. **AMMCreate cost correction**: The implementation plan currently says "~2 XRP". This should be updated to **0.2 XRP** (current mainnet owner reserve after the 2024 reduction). Use dynamic lookup via xrpl.js autofill rather than hardcoding.

## Sources

- [tec Codes Reference](https://xrpl.org/docs/references/protocol/transactions/transaction-results/tec-codes)
- [AMMCreate Transaction](https://xrpl.org/docs/references/protocol/transactions/types/ammcreate)
- [AMMDeposit Transaction](https://xrpl.org/docs/references/protocol/transactions/types/ammdeposit)
- [AMMWithdraw Transaction](https://xrpl.org/docs/references/protocol/transactions/types/ammwithdraw)
- [AMM Concepts — Frozen Assets & LP Tokens](https://xrpl.org/docs/concepts/tokens/decentralized-exchange/automated-market-makers)
- [XRPL Reserves](https://xrpl.org/docs/concepts/accounts/reserves)
- [Lower Reserves Blog Post (2024)](https://xrpl.org/blog/2024/lower-reserves-are-in-effect)
