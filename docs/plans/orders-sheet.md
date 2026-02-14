# Plan: Orders Sheet (Replace MyOpenOrders)

## Context

Follow-up to the trade UI improvements plan. Replaces the basic `MyOpenOrders` component with a full `OrdersSheet` that adds filled order history, a desktop bottom sheet layout, color-coded orders, expiration display, and explorer links. Depends on auto-polling (from the trade UI improvements plan) for silent refresh of filled orders.

## Design Decisions

- **New API endpoint** `/api/accounts/[address]/filled-orders` — `getBalanceChanges` from xrpl.js is server-only, so parsing must happen on the server
- **Shared parsing utility** `lib/xrpl/filled-orders.ts` — extract trade-from-tx parsing logic used by both `/api/dex/trades` and the new filled-orders endpoint
- **Desktop fixed bottom sheet + mobile in-flow section** — two exported components from the same file

---

## Execution Strategy

### Dependency Graph

```
Phase 1 (inline) ─── Step 1: FilledOrder type
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
Phase 2   Subagent A    Subagent B    Subagent C
(parallel) Steps 2+3    Step 4        Step 5
           backend      hook          component
          └─────────────┼─────────────┘
                        ▼
Phase 3 (inline) ─── Step 6: wire up page + grid
                        │
                        ▼
Phase 4 (inline) ─── Step 7: cleanup + openapi
```

### Shared Contract (provided to all Phase 2 subagents)

Each Phase 2 subagent operates on independent files but must agree on:
- **Type**: `FilledOrder` from `lib/types.ts` (written in Phase 1)
- **API contract**: `GET /api/accounts/[address]/filled-orders?network=&base_currency=&base_issuer=&quote_currency=&quote_issuer=&limit=` → `{ address, filledOrders: FilledOrder[] }`
- **Component props**: `OrdersSheet` / `OrdersSection` receive `filledOrders`, `loadingFilled`, open orders, cancel handler, pair info, network

### Parallelization Notes

- **Phase 1** is tiny (one interface addition) — do inline before launching subagents
- **Phase 2** is the bulk of new code (~3 new files) — 3 subagents run concurrently:
  - **A** (backend): Steps 2+3 are sequential (route imports util) but assigned to one subagent
  - **B** (hook): Step 4 — doesn't import the parsing util or route, just calls fetch
  - **C** (component): Step 5 — receives data as props, no direct dependency on A or B
- **Phase 3** integrates the outputs — must wait for all Phase 2 subagents
- **Phase 4** is cleanup — delete old file, update openapi

### Measurement

Track these to evaluate parallelization effectiveness:

| Metric | Value |
|--------|-------|
| Sequential steps (original) | 7 |
| Phases (parallelized) | 4 |
| Max concurrent subagents | 3 (Phase 2) |
| Phase 2 wall-clock time | _fill after execution_ |
| Phase 2 sum-of-parts time | _fill after execution_ |
| Parallelization speedup | _fill: sum-of-parts / wall-clock_ |
| Integration rework (Phase 3) | _fill: any fixups needed after merging parallel outputs_ |
| Total execution time | _fill after execution_ |
| Build pass on first try? | _fill: yes/no + errors_ |

**What to look for**:
- Speedup > 2× from Phase 2 parallelization validates the strategy
- Integration rework near zero means the shared contract was sufficient
- Build failures indicate contract mismatches between subagents — document what went wrong

---

## Step-by-step Changes

### Phase 1 (inline)

#### Step 1: Add FilledOrder type
**File**: `lib/types.ts`
- Add `FilledOrder` interface: `{ side: "buy" | "sell", price: string, baseAmount: string, quoteAmount: string, time: string, hash: string }`

### Phase 2 (3 parallel subagents)

#### Subagent A: Steps 2+3 — Backend parsing + API route

##### Step 2: Create shared parsing utility
**New file**: `lib/xrpl/filled-orders.ts`
- `parseFilledOrders(transactions, walletAddress, baseCurrency, baseIssuer, quoteCurrency, quoteIssuer)` → `FilledOrder[]`
- Uses `getBalanceChanges(meta)` from xrpl.js to extract balance deltas
- Filters to OfferCreate + tesSUCCESS + user's own txs
- Requires both sides > 0.001 change (filters fee-only XRP)
- Side detection: `baseDelta > 0` means buy
- Price = quoteAmount / baseAmount

##### Step 3: Create filled-orders API endpoint
**New file**: `app/api/accounts/[address]/filled-orders/route.ts`
- GET handler: queries `account_tx` for the address, calls `parseFilledOrders()`
- Query params: `network`, `base_currency`, `base_issuer`, `quote_currency`, `quote_issuer`, `limit` (default 20, max 400)
- Response: `{ address, filledOrders: FilledOrder[] }`

#### Subagent B: Step 4 — Hook changes

##### Step 4: Add filled orders fetching to use-trading-data
**File**: `lib/hooks/use-trading-data.ts`
- Add `filledOrders` + `loadingFilled` state
- Add `fetchFilledOrders()` with silent mode support
- Fetch on pair/address change + include in `silentRefresh`
- Return `filledOrders` and `loadingFilled`

#### Subagent C: Step 5 — UI component

##### Step 5: Create OrdersSheet component
**New file**: `app/trade/components/orders-sheet.tsx`
- Replaces `my-open-orders.tsx`
- Two exports: `OrdersSheet` (desktop fixed bottom sheet) and `OrdersSection` (mobile in-flow)
- Tabbed UI: "Open (N)" and "Filled (N)"
- `computeOfferFields()` helper: determines buy/sell via `matchesCurrency(offer.taker_pays, baseCurrency, baseIssuer)`
- **Open tab**: color-coded rows (green buy, red sell), price/amount/total, expiration with tooltip via `fromRippleEpoch()`, cancel button
- **Filled tab**: clickable rows → explorer, color-coded side labels
- Desktop: `fixed inset-x-0 bottom-0 z-40`, collapsible with `transition-[max-height]`
- Mobile: regular bordered section

### Phase 3 (inline — after all Phase 2 subagents complete)

#### Step 6: Wire up in page + grid
**Files**: `app/trade/page.tsx`, `app/trade/components/trade-grid.tsx`
- Page: filter `pairOffers` from `accountOffers` using `matchesCurrency`, handle cancel at page level, render desktop `OrdersSheet` + mobile `OrdersSection`, add bottom padding `lg:pb-[calc(33vh+1.5rem)]`
- TradeGrid: remove MyOpenOrders import/rendering, simplify middle column

### Phase 4 (inline)

#### Step 7: Clean up
- Delete `app/trade/components/my-open-orders.tsx`
- Update `openapi.yaml` with filled-orders endpoint

---

## File Summary

| Action | File |
|--------|------|
| Create | `lib/xrpl/filled-orders.ts` |
| Create | `app/api/accounts/[address]/filled-orders/route.ts` |
| Create | `app/trade/components/orders-sheet.tsx` |
| Delete | `app/trade/components/my-open-orders.tsx` |
| Modify | `lib/types.ts` |
| Modify | `lib/hooks/use-trading-data.ts` |
| Modify | `app/trade/page.tsx` |
| Modify | `app/trade/components/trade-grid.tsx` |
| Modify | `openapi.yaml` |

## Verification

1. `pnpm build` — must compile cleanly
2. Desktop: fixed bottom sheet visible with Open/Filled tabs, collapsible
3. Mobile: in-flow orders section below trade grid
4. Open orders tab shows color-coded buy/sell with cancel buttons
5. Filled orders tab shows historical fills with explorer links
6. Cancel an open order → order disappears, data refreshes
7. Tab counts update when orders change
