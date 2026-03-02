# XRPL Patterns

## Currency Code Encoding

XRPL currency codes follow two encoding rules:
- **Standard (3-char):** Passed through as-is — `"USD"` stays `"USD"`
- **Non-standard (>3 chars):** Hex-encoded and zero-padded to 40 chars — `"RLUSD"` becomes `"524C555344000000..."`

When writing tests that mock XRPL responses containing currency codes, use the **encoded** form that matches what the code under test produces. A trust line mock with hex `"0000...5553440000..."` won't match a comparison against `encodeXrplCurrency("USD")` which returns `"USD"`.

## Define Typed Interfaces for XRPL Response Shapes

XRPL `account_tx` entries and similar responses arrive as loosely-typed objects. Rather than casting through `as Record<string, unknown>` at every access, define a local interface once and cast at the entry point:

```ts
interface AccountTxEntry {
  tx_json?: {
    TransactionType: string;
    Account: string;
    Fee?: string;
    TakerPays?: Amount;
    hash?: string;
  };
  meta?: TransactionMetadata | string;
  close_time_iso?: string;
  hash?: string;
}

// One cast at the boundary
const entry = rawEntry as AccountTxEntry;
// Then typed access throughout — no more inline casts
const { tx_json, meta } = entry;
```

This eliminates scattered `as Record<string, unknown>` casts and gives IDE autocomplete for the fields you actually use.

## Extract Fee Adjustment as a Pure Helper

XRPL balance changes include the transaction fee for the submitting account's XRP balance. When computing fill amounts, the fee must be subtracted — but only for XRP on the submitter's account. This logic is easy to duplicate (once for base, once for quote). Extract it as a pure function:

```ts
function adjustForFee(value: number, currency: string, account: string, submitter: string, feeDrops: string): number {
  if (currency === "XRP" && account === submitter) {
    return value - parseFloat(feeDrops) / 1_000_000;
  }
  return value;
}
```
