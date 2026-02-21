# Implementation Plan — XRPL AMM Integration

> Phased plan for adding AMM (XLS-30) support. Each phase is self-contained and can be reviewed independently. Phases 1–3 are sequential (each builds on the prior); Phase 4 items are independent and can be parallelized.

## Assumptions for Planning

Confirmed by user on 2026-02-21.

| Decision | Confirmed Value | Reference |
|---|---|---|
| Supported operations | Create + Deposit + Withdraw + Pool Info (no Vote/Bid/Delete initially) | Q1 |
| UI location | Compact panel in TradeGrid left column (above RecentTrades); all forms as modals | Q2 |
| API route prefix | `/api/amm/*` (peer to `/api/dex/`) | Q3 |
| Deposit modes | Two-asset proportional (`tfTwoAsset`) + Single-asset (`tfSingleAsset`) + Two-asset-if-empty (`tfTwoAssetIfEmpty`) | Q4 |
| Withdraw modes | Withdraw all (`tfWithdrawAll`) + Two-asset (`tfTwoAsset`) + Single-asset (`tfSingleAsset`) | Q4 |
| AMM discovery | Auto-query `amm_info` on currency pair change; show pool info or "Create Pool" CTA | Q5 |
| LP token display | Hidden from main balances; dedicated section in AMM panel | Q6 |
| Test scripts | `test-amm.sh` covering full lifecycle | Q7 |
| spotPrice orientation | Server-side, normalized to user's base/quote (price of 1 base in quote terms) | — |
| AMMCreate cost display | Dynamic via `server_info` owner reserve lookup, not hardcoded | — |
| Error handling | Extend `txFailureResponse()` with optional `errorMap` param in `lib/api.ts` | — |

---

## Phase 1: Foundation (Types, Utilities, AMM Info API)

**Goal**: Establish the backend plumbing — types, constants, and the read-only `amm_info` query. No UI changes yet.

**Parallelization**: Tasks 1.1–1.3 are independent and can be done concurrently. Task 1.4 depends on 1.1+1.2.

### Task 1.1 — AMM Request/Response Types

**File**: `lib/xrpl/types.ts`

Add request interfaces for each AMM operation:

```typescript
// --- AMM Types ---

interface AmmInfoQuery {
  baseCurrency: string;
  baseIssuer?: string;
  quoteCurrency: string;
  quoteIssuer?: string;
  network?: string;
}

interface CreateAmmRequest {
  seed: string;
  amount: DexAmount;    // First asset
  amount2: DexAmount;   // Second asset
  tradingFee: number;   // 0–1000 (0%–1%)
  network?: string;
}

interface DepositAmmRequest {
  seed: string;
  asset: { currency: string; issuer?: string };
  asset2: { currency: string; issuer?: string };
  amount?: DexAmount;       // For single-asset or two-asset deposit
  amount2?: DexAmount;      // For two-asset deposit
  lpTokenOut?: DexAmount;   // Desired LP tokens (for tfLPToken mode)
  mode: "two-asset" | "single-asset" | "two-asset-if-empty";
  network?: string;
}

interface WithdrawAmmRequest {
  seed: string;
  asset: { currency: string; issuer?: string };
  asset2: { currency: string; issuer?: string };
  amount?: DexAmount;       // For single-asset or two-asset withdraw
  amount2?: DexAmount;      // For two-asset withdraw
  lpTokenIn?: DexAmount;    // LP tokens to redeem
  mode: "withdraw-all" | "two-asset" | "single-asset";
  network?: string;
}
```

**Why `mode` field**: Rather than exposing raw XRPL flags, the API accepts a human-readable mode string and maps it server-side to the correct `AMMDepositFlags`/`AMMWithdrawFlags`. This follows the existing pattern where `/api/dex/offers` accepts `flags: OfferFlag[]` strings and resolves them via `resolveOfferFlags()`.

### Task 1.2 — AMM Constants & LP Token Utility

**File**: `lib/xrpl/constants.ts` — add:

```typescript
export const AMM_MAX_TRADING_FEE = 1000; // 1% max
export const AMM_DEFAULT_TRADING_FEE = 300; // 0.3% — reasonable default for non-stable pairs
```

**New file**: `lib/xrpl/lp-token.ts`

```typescript
/**
 * Detect whether a currency code is an LP token (0x03 prefix).
 * LP tokens use 160-bit hex codes where the first 8 bits are 0x03.
 */
export function isLpTokenCurrency(currencyCode: string): boolean;

/**
 * Format LP token for display. Returns "LP Token" or "LP (BASE/QUOTE)"
 * if asset pair info is available.
 */
export function formatLpTokenLabel(currencyCode: string, assetPair?: { base: string; quote: string }): string;
```

**File**: `lib/xrpl/decode-currency-client.ts` — update `decodeCurrency()` to detect LP tokens and return a readable label instead of garbled text.

### Task 1.3 — AMM Fee Display Utility

**New file**: `lib/xrpl/amm-fee.ts`

```typescript
/**
 * Convert AMM trading fee (0–1000) to display percentage string.
 * Example: 300 → "0.30%", 1000 → "1.00%", 0 → "0.00%"
 */
export function formatAmmFee(fee: number): string;

/**
 * Convert percentage input (e.g., 0.3) to AMM fee units (e.g., 300).
 */
export function parseAmmFeeInput(percentString: string): number;
```

### Task 1.4 — AMM Info API Route

**New file**: `app/api/amm/info/route.ts`

```
GET /api/amm/info?baseCurrency=XRP&quoteCurrency=USD&quoteIssuer=rXXX&network=testnet
```

**Implementation**:
1. Parse query params with `validateCurrencyPair()` (reuse existing helper)
2. `getClient(resolveNetwork(network))`
3. `client.request({ command: "amm_info", asset, asset2 })`
4. Transform response: extract `account`, `amount`, `amount2`, `lp_token`, `trading_fee`, `auction_slot`, `vote_slots`, `asset_frozen`, `asset2_frozen`
5. Return structured JSON or `{ exists: false }` if `ammNotFound` error

**Response shape**:
```json
{
  "exists": true,
  "account": "rAMMAccount...",
  "asset1": { "currency": "XRP", "value": "1000" },
  "asset2": { "currency": "USD", "issuer": "rIssuer...", "value": "500" },
  "lpToken": { "currency": "03ABCDEF...", "issuer": "rAMMAccount...", "value": "707.106" },
  "tradingFee": 300,
  "tradingFeeDisplay": "0.30%",
  "spotPrice": "0.5",
  "auctionSlot": { ... } | null,
  "voteSlots": [ ... ]
}
```

**`spotPrice`**: Implied exchange rate normalized to the user's base/quote orientation — price of 1 unit of base in terms of quote. The `amm_info` response returns assets in creation order (which may not match the user's pair selection), so the route compares the query's `baseCurrency`/`baseIssuer` against the response's `amount`/`amount2` and inverts if needed. This allows the frontend to display the AMM price alongside the DEX orderbook spread for comparison without re-deriving it client-side. See assumptions A19, A21.

**Error handling**: The `amm_info` command returns an error if no AMM exists for the pair. Catch this specifically and return `{ exists: false }` instead of a 500 error.

### Task 1.5 — Frontend Types for AMM Data

**File**: `lib/types.ts`

Add types consumed by UI components:

```typescript
interface AmmPoolInfo {
  exists: boolean;
  account?: string;
  asset1?: { currency: string; issuer?: string; value: string };
  asset2?: { currency: string; issuer?: string; value: string };
  lpToken?: { currency: string; issuer: string; value: string };
  tradingFee?: number;
  tradingFeeDisplay?: string;
  spotPrice?: string;           // asset2/asset1 implied rate from pool balances
  auctionSlot?: AmmAuctionSlot | null;
  voteSlots?: AmmVoteSlot[];
}

interface AmmAuctionSlot {
  account: string;
  discountedFee: number;
  expiration: string;
  price: { currency: string; issuer: string; value: string };
  timeInterval: number;
}

interface AmmVoteSlot {
  account: string;
  tradingFee: number;
  voteWeight: number;
}
```

### Task 1.6 — Extend `txFailureResponse()` with Optional Error Map

**File**: `lib/api.ts` (modify)

Add an optional `errorMap?: Record<string, string>` parameter to `txFailureResponse()`. When provided, the function looks up the transaction result code in the map and uses the friendly message instead of the generic "Transaction failed: {code}" message. This centralizes the pattern rather than requiring per-route helper functions.

```typescript
// Before:
export function txFailureResponse(result: TxResponse): Response | null;

// After:
export function txFailureResponse(result: TxResponse, errorMap?: Record<string, string>): Response | null;
```

When `errorMap` is provided and the result code is found, include both the friendly message and the raw code:
```json
{ "error": "Friendly message from map", "code": "tecAMM_UNFUNDED", "result": { ... } }
```

Existing callers pass no `errorMap` and continue to work unchanged.

**Estimated files changed**: 4 modified + 2 new = 6 files (Phase 1 total)
**Risk**: Low — no UI changes, no behavioral changes to existing features

---

## Phase 2: Transaction API Routes

**Goal**: Add API routes for AMMCreate, AMMDeposit, and AMMWithdraw. These follow the exact same pattern as the existing `/api/dex/offers` POST route.

**Parallelization**: All three routes (2.1, 2.2, 2.3) are independent and can be implemented concurrently.

### Task 2.1 — AMMCreate Route

**New file**: `app/api/amm/create/route.ts`

```
POST /api/amm/create
Body: CreateAmmRequest
```

**Implementation**:
1. `validateRequired(body, ["seed", "amount", "amount2", "tradingFee"])`
2. `walletFromSeed(body.seed)` → wallet
3. Validate `tradingFee` is 0–1000
4. Validate both amounts are positive
5. Check if AMM already exists (optional — the ledger will reject it, but a pre-check gives a better error message)
6. Build transaction:
   ```typescript
   const tx: AMMCreate = {
     TransactionType: "AMMCreate",
     Account: wallet.address,
     Amount: toXrplAmount(body.amount),
     Amount2: toXrplAmount(body.amount2),
     TradingFee: body.tradingFee,
   };
   ```
7. `client.submitAndWait(tx, { wallet })` — xrpl.js autofill handles the special fee dynamically
8. Check result with `txFailureResponse(result, AMM_CREATE_ERRORS)` (extended with optional errorMap)
9. Return 201 with AMM account address and LP tokens received

**Error handling**: Define `AMM_CREATE_ERRORS` map with 11 known tec/ter/tem codes. Pass as the `errorMap` param to the extended `txFailureResponse()` in `lib/api.ts`. See [amm-error-handling.md](./amm-error-handling.md) for the complete map and user-friendly messages.

**Key edge cases**:
- DefaultRipple not enabled on issuer → `terNO_RIPPLE` (provide helpful error message)
- Insufficient balance → `tecAMM_UNFUNDED`
- AMM already exists → `tecDUPLICATE` (pre-check via `amm_info` for better UX)
- Frozen assets → `tecFROZEN`
- At most one asset can be XRP → validate client-side

### Task 2.2 — AMMDeposit Route

**New file**: `app/api/amm/deposit/route.ts`

```
POST /api/amm/deposit
Body: DepositAmmRequest
```

**Implementation**:
1. `validateRequired(body, ["seed", "asset", "asset2", "mode"])`
2. Mode-specific validation:
   - `"two-asset"` → require `amount` and `amount2`, flag `tfTwoAsset`
   - `"single-asset"` → require `amount` (only one asset), flag `tfSingleAsset`
   - `"two-asset-if-empty"` → require `amount` and `amount2`, flag `tfTwoAssetIfEmpty` (for refunding empty pools)
3. Build transaction with appropriate flags:
   ```typescript
   const flagMap = {
     "two-asset": AMMDepositFlags.tfTwoAsset,
     "single-asset": AMMDepositFlags.tfSingleAsset,
     "two-asset-if-empty": AMMDepositFlags.tfTwoAssetIfEmpty,
   };
   const tx: AMMDeposit = {
     TransactionType: "AMMDeposit",
     Account: wallet.address,
     Asset: buildCurrencySpec(body.asset),
     Asset2: buildCurrencySpec(body.asset2),
     Flags: flagMap[body.mode],
   };
   if (body.amount) tx.Amount = toXrplAmount(body.amount);
   if (body.amount2) tx.Amount2 = toXrplAmount(body.amount2);
   ```
4. Submit, check result using `txFailureResponse(result, AMM_DEPOSIT_ERRORS)`, return LP tokens received

**Helper needed**: `buildCurrencySpec({ currency, issuer? })` → XRPL `Currency` object. This is the `Asset`/`Asset2` field format (just currency identifier, no amount). Different from `toXrplAmount` which includes a value.

**New file**: `lib/xrpl/amm-helpers.ts`

```typescript
/**
 * Build XRPL Currency spec (no amount) for AMM Asset/Asset2 fields.
 * XRP: { currency: "XRP" }
 * Issued: { currency: "USD", issuer: "rXXX" }
 */
export function buildCurrencySpec(asset: { currency: string; issuer?: string }): Currency;
```

### Task 2.3 — AMMWithdraw Route

**New file**: `app/api/amm/withdraw/route.ts`

```
POST /api/amm/withdraw
Body: WithdrawAmmRequest
```

**Implementation**:
1. `validateRequired(body, ["seed", "asset", "asset2", "mode"])`
2. Mode-specific validation and flag mapping:
   - `"withdraw-all"` → `AMMWithdrawFlags.tfWithdrawAll` (no amounts needed)
   - `"two-asset"` → `AMMWithdrawFlags.tfTwoAsset` + require `amount` and `amount2`
   - `"single-asset"` → `AMMWithdrawFlags.tfSingleAsset` + require `amount`
3. Build and submit transaction
4. Check result using `txFailureResponse(result, AMM_WITHDRAW_ERRORS)`, return redeemed asset amounts

**Error handling**: Define `AMM_WITHDRAW_ERRORS` map with 9 known codes. Key: `tecAMM_BALANCE` means the withdrawal would drain one side entirely.

**Edge case**: If withdrawing all LP tokens and the pool has ≤512 trust lines, the AMM auto-deletes. After successful `tfWithdrawAll`, re-query `amm_info` to report whether the pool was deleted.

**Estimated files changed**: 3 new route files + 1 new helper = 4 files
**Risk**: Low — follows established patterns exactly

---

## Phase 3: Frontend UI

**Goal**: Add AMM pool info display and deposit/withdraw modals to the `/trade` page.

**Parallelization**: Tasks 3.1 (hook) must come first. Then 3.2, 3.3, 3.4 can be parallelized. Task 3.5 (page integration) depends on all of them.

### Task 3.1 — AMM Data Hook

**New file**: `lib/hooks/use-amm-pool.ts`

```typescript
/**
 * Fetches AMM pool info for the selected currency pair.
 * Returns pool state, loading indicator, and refresh function.
 * Auto-fetches when base/quote change. Polls alongside existing trading data.
 */
export function useAmmPool(params: {
  baseCurrency: string;
  baseIssuer?: string;
  quoteCurrency: string;
  quoteIssuer?: string;
  network: string;
  refreshKey: number;
}): {
  pool: AmmPoolInfo | null;
  loading: boolean;
  error: string | null;
};
```

Built on `useApiFetch` — same pattern as `useTradingData` sub-fetches.

### Task 3.2 — AMM Pool Info Panel

**New file**: `app/trade/components/amm-pool-panel.tsx`

Compact card displaying AMM pool state for the selected pair. Positioned in the **left column of `TradeGrid`** above `RecentTrades`.

**Placement**: `trade-grid.tsx` left column (`lg:col-span-2`): `AmmPoolPanel` → `RecentTrades`. The panel is a small card — all forms (create, deposit, withdraw) open as modals.

```
Left (2 cols)           Center (3 cols)     Right (2 cols)
┌──────────────┐       ┌──────────────┐    ┌──────────────┐
│ AMM Pool     │       │              │    │ Balances     │
│ Panel        │       │  OrderBook   │    │              │
├──────────────┤       │              │    ├──────────────┤
│              │       │              │    │              │
│ RecentTrades │       │              │    │  TradeForm   │
│              │       └──────────────┘    │              │
└──────────────┘                           └──────────────┘
```

**Content when pool exists (all users)**:
- Implied spot price: e.g., "1 XRP = 0.50 USD" — normalized to user's base/quote orientation. Displayed prominently for comparison against the orderbook spread visible in the center column
- Pool reserves: "1,000 XRP + 500 USD" — communicates available depth
- Trading fee: "0.30%"

**Content when pool exists (LP holders only)** — additionally show:
- User's LP token balance and pool share percentage
- "Deposit" and "Withdraw" buttons (open modals)

**Content when pool exists (non-LP users)** — de-emphasize LP-specific fields; focus on pool composition, implied price, and fee. Show "Deposit" button to encourage participation.

**Content when pool is empty** (exists but zero reserves):
- "Pool is empty" indicator
- "Re-fund Pool" button (opens deposit modal in two-asset-if-empty mode)

**Content when no pool exists**:
- "No AMM pool" + "Create Pool" button (opens create modal)

**Frozen asset state**: If `asset_frozen` or `asset2_frozen`, show warning banner and disable action buttons.

**UX rationale**: The panel serves all traders, not just LPs. The orderbook may look thin while the AMM pool is well-funded with continuous liquidity along its bonding curve. Without this panel, users would incorrectly conclude there's no liquidity. The implied spot price alongside the orderbook spread gives transparency into where liquidity comes from. See assumptions A15, A19, A20, A21 in [assumptions-and-questions.md](./assumptions-and-questions.md).

**Design**: Compact card following existing Tailwind dark mode patterns (`dark:bg-zinc-*`). If the panel becomes too tall, iterate by collapsing detail rows behind a disclosure toggle — show just spot price + one action button by default.

### Task 3.3 — AMM Create Modal

**New file**: `app/trade/components/amm-create-modal.tsx`

Two-step modal (form → preview) following `MakeMarketModal` pattern.

**Form step**:
- Asset amounts: Two inputs showing base and quote with current balance hints
- Trading fee: Slider or input, 0%–1%, default 0.30%. Show fee presets (0.10% stable, 0.30% normal, 1.00% volatile)
- Warning: "Creating an AMM pool costs {ownerReserve} XRP (owner reserve)" — prominent, non-dismissible. **Cost is fetched dynamically** via `server_info` to get the current owner reserve, not hardcoded.

**Preview step**:
- Summary: "Create XRP/USD pool with 1,000 XRP + 500 USD at 0.30% fee"
- Estimated LP tokens to receive (√(amount1 × amount2))
- "Confirm & Create" button

**Post-submit**: Success message with LP tokens received, then refresh pool data.

### Task 3.4 — AMM Deposit/Withdraw Modals

**New file**: `app/trade/components/amm-deposit-modal.tsx`

**Mode selector**: Radio/tab — "Both Assets" | "Single Asset"

**Both Assets mode**:
- Two amount inputs (base + quote)
- Shows current pool ratio for reference
- Note: "Proportional deposits incur no trading fee"

**Single Asset mode**:
- One amount input + asset selector dropdown
- Warning: "Single-asset deposits incur the pool's trading fee (0.30%)"

**Empty Pool state** (triggered when pool exists but reserves are zero):
- Modal auto-switches to two-asset-if-empty mode
- Shows "This pool is empty — provide both assets to re-fund it"
- Two amount inputs (no ratio reference since pool is empty)
- Submits with `mode: "two-asset-if-empty"`

**New file**: `app/trade/components/amm-withdraw-modal.tsx`

**Mode selector**: Radio/tab — "Withdraw All" | "Both Assets" | "Single Asset"

**Withdraw All mode**:
- Shows current LP balance and estimated redemption amounts
- One-click "Withdraw All" button

**Both Assets / Single Asset**:
- Amount inputs similar to deposit
- Shows LP tokens that will be burned

### Task 3.5 — TradeGrid & Trade Page Integration

**Files**: `app/trade/components/trade-grid.tsx` (modify), `app/trade/page.tsx` (modify)

**`trade-grid.tsx` changes**:
1. Accept `ammPool`, `ammLoading` props (from `useAmmPool` hook called in page.tsx)
2. Accept `focusedWalletAddress` prop (to check LP token holdings)
3. Add `AmmPoolPanel` to the left column `div`, above `RecentTrades`
4. Add modal state management (`showCreateAmm`, `showDepositAmm`, `showWithdrawAmm`)
5. Render modal components conditionally
6. Pass `onSuccess` callbacks that trigger data refresh via `onRefresh`

**`page.tsx` changes**:
1. Add `useAmmPool()` hook call alongside existing `useTradingData()`, passing `sellingCurrency`/`buyingCurrency` as base/quote
2. Pass AMM data down to `TradeGrid` as props

**Layout**: No grid structure changes needed. The left column's `space-y-6` stack naturally accommodates the new panel above RecentTrades. On mobile, it collapses into the vertical flow naturally.

**Estimated files changed**: 2 modified (trade-grid.tsx, page.tsx) + 4 new components + 1 new hook = 7 files
**Risk**: Low-Medium — no grid restructuring needed; left column just gets a new child

---

## Phase 4: Polish & Testing (Independent Tasks)

These tasks are independent of each other and can be done in any order/concurrently.

### Task 4.1 — LP Token Balance Filtering

**File**: `app/trade/components/balances-panel.tsx` (modify)

Filter out LP token currencies (0x03 prefix) from the main balances display to avoid clutter. LP token balances are shown in the AMM Pool Panel instead.

### Task 4.2 — OpenAPI Spec Update

**File**: `openapi.yaml` (modify)

Add entries for:
- `GET /api/amm/info` — query AMM pool state
- `POST /api/amm/create` — create AMM
- `POST /api/amm/deposit` — deposit liquidity
- `POST /api/amm/withdraw` — withdraw liquidity

Add schema definitions for `CreateAmmRequest`, `DepositAmmRequest`, `WithdrawAmmRequest`, `AmmInfoResponse`.

### Task 4.3 — Test Script

**New file**: `scripts/test-amm.sh`

Full lifecycle test:
1. Generate two wallets (or reuse from `examples/`)
2. Create trust line from wallet B to wallet A's issued currency
3. Issue currency from wallet A to wallet B
4. Create AMM pool (wallet B provides XRP + issued currency)
5. Query pool info — verify reserves and fee
6. Deposit more liquidity (two-asset)
7. Deposit single-asset
8. Query pool info — verify updated reserves
9. Withdraw (partial, single-asset)
10. Withdraw all — verify pool deletion
11. Report pass/fail

Follow `test-permissioned-dex.sh` pattern — uses `lib.sh` helpers, reads/writes from `examples/`.

### Task 4.4 — CLAUDE.md Update

**File**: `CLAUDE.md` (modify)

Add to the API Routes table:
- `/api/amm/info` — GET — AMM pool info — `test-amm.sh`
- `/api/amm/create` — POST — Create AMM pool — `test-amm.sh`
- `/api/amm/deposit` — POST — Deposit to AMM — `test-amm.sh`
- `/api/amm/withdraw` — POST — Withdraw from AMM — `test-amm.sh`

Add to the `lib/` Module Map:
- `lp-token.ts` — `isLpTokenCurrency()`, `formatLpTokenLabel()`
- `amm-fee.ts` — `formatAmmFee()`, `parseAmmFeeInput()`
- `amm-helpers.ts` — `buildCurrencySpec()`

Add to Hooks table:
- `use-amm-pool.ts` — `useAmmPool()`

---

## Dependency Graph

```
Phase 1 (Foundation)
├── 1.1 Types           ─┐
├── 1.2 Constants/LP     │── all independent
├── 1.3 Fee utilities    │
├── 1.5 Frontend types   │
└── 1.6 txFailureResponse ext ─┘
├── 1.4 AMM Info route   ←── depends on 1.1, 1.2

Phase 2 (Transaction Routes)    ←── depends on Phase 1 (1.1, 1.6, amm-helpers.ts)
├── 2.1 AMMCreate route  ─┐
├── 2.2 AMMDeposit route  │── all independent, share amm-helpers.ts
└── 2.3 AMMWithdraw route ─┘

Phase 3 (Frontend UI)           ←── depends on Phase 1 + 2
├── 3.1 useAmmPool hook  ←── depends on 1.4, 1.5
├── 3.2 Pool Panel       ←── depends on 3.1
├── 3.3 Create Modal     ─┐── depends on 3.1
├── 3.4 Deposit/Withdraw ─┘── depends on 3.1
└── 3.5 TradeGrid+Page   ←── depends on 3.2, 3.3, 3.4

Phase 4 (Polish & Testing)      ←── independent of each other
├── 4.1 LP token filtering
├── 4.2 OpenAPI update
├── 4.3 Test script
└── 4.4 CLAUDE.md update
```

## Maximum Parallelism Schedule

For fastest execution with multiple agents:

| Step | Agent A | Agent B | Agent C |
|---|---|---|---|
| 1 | Task 1.1 (types) | Task 1.2 (constants) | Task 1.3 (fee utils) |
| 1 | Task 1.5 (frontend types) | Task 1.6 (txFailureResponse) | — |
| 2 | Task 1.4 (info route) | — | — |
| 3 | Task 2.1 (create route) | Task 2.2 (deposit route) | Task 2.3 (withdraw route) |
| 4 | Task 3.1 (hook) | — | — |
| 5 | Task 3.2 (pool panel) | Task 3.3 (create modal) | Task 3.4 (deposit/withdraw) |
| 6 | Task 3.5 (TradeGrid+page) | — | — |
| 7 | Task 4.1 (LP filter) | Task 4.2 (OpenAPI) | Task 4.3 (test script) |
| 8 | Task 4.4 (CLAUDE.md) | — | — |

**Critical path**: 1.1 → 1.4 → 2.x → 3.1 → 3.2/3.3/3.4 → 3.5 (6 sequential steps)

---

## File Change Summary

| Action | Count | Files |
|---|---|---|
| **New files** | 13 | 3 API routes, 4 components, 1 hook, 3 lib utilities, 1 test script, 1 helper |
| **Modified files** | 7 | `lib/xrpl/types.ts`, `lib/xrpl/constants.ts`, `lib/xrpl/decode-currency-client.ts`, `lib/types.ts`, `lib/api.ts`, `app/trade/components/trade-grid.tsx`, `app/trade/page.tsx`, `openapi.yaml`, `CLAUDE.md` |
| **Total** | ~20 | |

## Estimated Scope per Phase

| Phase | New Files | Modified Files | Complexity |
|---|---|---|---|
| Phase 1 | 3 | 4 | Low — types + one GET route + txFailureResponse extension |
| Phase 2 | 4 | 0 | Low — follows established POST pattern |
| Phase 3 | 5 | 2 | Low-Medium — compact panel + modals; no grid restructuring |
| Phase 4 | 1 | 3 | Low — documentation + test script |

---

## Future Enhancements (Out of Scope)

These are explicitly deferred and should not be implemented in the initial AMM integration:

1. **AMMVote** — Fee governance UI. Add when users request it.
2. **AMMBid** — Auction slot bidding. Advanced feature for power users.
3. **AMMDelete** — Only needed for edge case cleanup when auto-delete fails (>512 trust lines).
4. **AMMClawback (XLS-73)** — Devnet-only draft amendment. Not relevant until mainnet.
5. **Permissioned AMM pools** — No `domainID` support in AMM transactions currently.
6. **AMM analytics** — Historical fee income, impermanent loss tracking, LP token value charts.
7. **Multi-pool LP positions** — Aggregated view of all AMM positions across pairs. Discovery approach: `account_lines` → filter `0x03`-prefix currencies → `amm_info` fan-out by LP issuer. Could be a `GET /api/accounts/[address]/amm-positions` route. See [amm-discovery.md](./amm-discovery.md).
8. **EPrice support** — `EPrice` field for max/min effective price controls on deposit/withdraw. Can be added as an "Advanced" toggle later.
9. **AMM depth in order book** — `book_offers` does NOT include AMM synthetic offers (injected only at tx execution layer). Could compute AMM effective price from pool balances and overlay it on the order book display. See [amm-discovery.md](./amm-discovery.md).
