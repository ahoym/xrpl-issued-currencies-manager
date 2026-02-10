# XRPL Transfer Patterns — Learnings

## Issuer Burn Mechanics: No Trust Line Required

On the XRPL, sending issued currency back to the issuer does **not** require a trust line on the issuer's side. The issuer implicitly accepts their own IOUs. This effectively "burns" or redeems the tokens, reducing the outstanding supply of that currency.

This is standard XRPL behavior — only non-issuer accounts need trust lines to hold an issued currency. The issuer is always the counterparty on trust lines created by other accounts, so there is no concept of the issuer having a trust line to themselves.

### Practical implications

- Any holder of an issued currency can send it back to the issuer at any time.
- The issuer's balance for their own currency is always negative (representing outstanding IOUs), and receiving tokens back reduces that negative balance.
- No `TrustSet` transaction is needed on the issuer's account before receiving their own tokens.

## Transfer UI: Skip Trust Line Validation for Burns

The Send Currency modal (`app/transact/components/transfer-modal.tsx`) validates that the recipient has a trust line before allowing a transfer of issued currency. However, this check **must be skipped** when the recipient is the issuer of that currency, because issuers do not have (or need) trust lines to themselves.

Without this skip, the UI incorrectly blocks users from burning currency by sending it back to the issuer.

### Fix pattern

In the trust line validation `useEffect`, check whether `destinationAddress === selectedBalance.issuer` and early-return with `setTrustLineOk(true)`. Additionally, display a burn warning so the user understands the tokens will be destroyed upon receipt by the issuer.

A derived `isBurn` flag drives both behaviors:

```typescript
const isBurn = destinationAddress === selectedBalance?.issuer;
```

- **Validation skip**: When `isBurn` is true, bypass the `account_lines` check and set `trustLineOk` to `true`.
- **UI warning**: When `isBurn` is true, render a warning message explaining that sending tokens to the issuer will burn/redeem them, reducing circulating supply.

### Why this matters

Without this pattern, the trust line check calls `account_lines` on the issuer for their own currency, finds no matching trust line (because issuers don't create trust lines to themselves), and erroneously marks the transfer as invalid. Users are left unable to redeem tokens through the standard transfer flow.
