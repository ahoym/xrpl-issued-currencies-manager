# XRPL Project Patterns

Key patterns and gotchas discovered during the codebase deep-scan.

## Documentation Maintenance

When modifying this project, keep these in sync:
1. **CLAUDE.md** — Module map, commands, hooks table, API routes table
2. **README.md** — API routes table (simplified view), stack version
3. **openapi.yaml** — Must match actual API route handlers
4. **`lib/xrpl/CLAUDE.md`** — If adding/removing modules in `lib/xrpl/`
5. **`docs/learnings/`** — Re-run `/explore-repo` to refresh stale scan files

## Amount Type Proliferation

Four structurally identical `{currency, value, issuer?}` types exist:
- `DexAmount` — API request/response for DEX operations
- `OrderBookAmount` — order book display
- `CurrencyBalance` — API balance query results
- `BalanceEntry` — frontend balance display

They are structurally compatible but defined independently. Be aware which one a function expects.

## Encoding Asymmetry

**Currency codes** (`encodeXrplCurrency`): ASCII → hex, padded to 40 chars
**Credential types** (`encodeCredentialType`): UTF-8 → hex, variable length, NO padding

Using the wrong encoder produces invalid ledger objects. These are handled by completely separate functions in separate files.

## Node-only vs Browser-safe

Never import `lib/xrpl/currency.ts` or `lib/xrpl/credentials.ts` in client components — they use Node `Buffer`. For browser-side currency decoding, use `lib/xrpl/decode-currency-client.ts`.

## Transaction Submission Pattern

Every write API route follows: validate → `walletFromSeed()` → construct tx → `submitAndWait()` → `getTransactionResult()` → return success or `txFailureResponse(result, errorMap)`.

Error maps are per-endpoint (transfers has 11 tec codes, AMM create has 11, etc.). They are not shared.

## Testing Tiers

1. **Unit tests** (`pnpm test`): Only for `lib/xrpl/` math functions. NOT in CI.
2. **Bash scripts** (`scripts/test-all.sh`): Cover all API routes. Run manually.
3. **Playwright E2E** (`pnpm e2e`): Full browser flows. In CI on every push.

When adding a new API route, add a corresponding test script in `scripts/`.
