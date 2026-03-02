# API Design Patterns

## Validator Return Types: T | Response over Discriminated Unions

For functions that either succeed with a value or fail with an HTTP Response, return `T | Response` directly instead of wrapping in a discriminated union like `{ value: T } | { error: Response }`.

**Before (3 lines per call site):**
```ts
function walletFromSeed(seed: string): { wallet: Wallet } | { error: Response } { ... }

const result = walletFromSeed(body.seed);
if ("error" in result) return result.error;
const wallet = result.wallet;
```

**After (2 lines per call site):**
```ts
function walletFromSeed(seed: string): Wallet | Response { ... }

const wallet = walletFromSeed(body.seed);
if (wallet instanceof Response) return wallet;
```

`instanceof Response` is reliable in server-side code. The pattern saves one line per call site and eliminates the wrapping/unwrapping ceremony. Works well when the success type is a class instance (Wallet, Date, etc.) that is clearly distinguishable from Response.

## Extract Validators Before Extracting Logic

When refactoring route handlers, extract **validation helpers** first (e.g., `parseLimit`, `validateDexAmount`, `validateAmmModeAmounts`). Validation is the most duplicated code across routes, has clear input/output contracts, and is trivially unit-testable. Logic helpers (transaction building, response shaping) vary more per-route and benefit less from extraction.

Priority order for route handler refactoring:
1. Shared validators (highest duplication, easiest to test)
2. Response/metadata helpers (e.g., `extractCreatedLedgerIndex`, `txFailureResponse`)
3. Transaction-building helpers (most route-specific, extract only when truly duplicated)

## Signature Widening for Validator Inputs

When a validator only reads properties from its input (doesn't need full type safety), accept `unknown` instead of a specific type. This eliminates cast noise at every call site.

```ts
// Before: every caller must cast
validateRequired(body as unknown as Record<string, unknown>, ["seed", "amount"]);

// After: validator handles the cast internally once
export function validateRequired(data: unknown, fields: readonly string[]): Response | null {
  const record = data as Record<string, unknown>;
  // ...
}
```

Only do this for functions that immediately cast internally — don't widen signatures on functions that use the type for logic.

## Centralize Error Maps Near Their Domain

When multiple routes share the same error code → message mapping (e.g., AMM transaction error codes), extract them into a domain-specific module rather than inlining in each route or dumping into a generic utils file.

```
lib/xrpl/amm-errors.ts   → AMM_CREATE_ERRORS, AMM_DEPOSIT_ERRORS, AMM_WITHDRAW_ERRORS
```

This keeps error messages consistent across routes and makes them easy to update when new error codes are added to the ledger.
