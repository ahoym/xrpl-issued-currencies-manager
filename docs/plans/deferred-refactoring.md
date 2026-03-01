# Plan: Deferred Refactoring Opportunities

Identified during the frontend refactoring session (March 2026). Each item was intentionally deferred due to diminishing returns or risk/complexity ratio.

## 1. Split `useTradingData` Hook

**File**: `lib/hooks/use-trading-data.ts` (~404 LOC, 6+ concerns)

**Problem**: Single hook aggregates balances, orderbook, offers, trades, currency options, and refresh logic. Hard to reason about and test in isolation.

**Proposed approach**:
- Extract into focused hooks: `useOrderbook`, `useOpenOffers`, `useRecentTrades`, `useCurrencyOptions`
- `useTradingData` becomes a thin orchestrator that composes them
- Each sub-hook gets its own test file

**Why deferred**: Single consumer (`/trade` page). Splitting requires careful dependency threading — the sub-hooks share `network`, `focusedWallet`, and the selected currency pair, and several depend on each other's refresh cycles. Net benefit is testability, not fewer LOC.

**Preconditions**: Understand the refresh dependency graph before splitting. `orderbook` and `trades` auto-poll, `offers` refreshes after mutations, `balances` refreshes after trade completion. A shared `refreshKey` coordinates some of these today.

## 2. Split Trade Page Components

**Files**: `app/trade/components/trade-form.tsx`, `app/trade/components/order-book.tsx`

**Problem**: Both are large (~350 and ~300 LOC respectively), but internally cohesive.

**Proposed approach**:
- `trade-form.tsx`: extract advanced options (execution type, sell mode, hybrid, expiration) into a collapsible `<AdvancedOrderOptions>` sub-component
- `order-book.tsx`: extract the bid/ask table rendering into a `<OrderBookSide>` component

**Why deferred**: Splitting would increase prop drilling without reducing complexity. These components don't have reuse potential — they're page-specific. Only worth doing if the components grow further.

## 3. AbortController in Fetch Hooks

**File**: `lib/hooks/use-api-fetch.ts`

**Problem**: `useApiFetch` doesn't cancel in-flight requests when the component re-renders with new parameters or unmounts. Stale responses can arrive after the component has moved on.

**Proposed approach**:
```tsx
// Inside useApiFetch's fetchData function:
const controller = new AbortController();
const res = await fetch(url, { signal: controller.signal });

// In the useEffect cleanup:
return () => controller.abort();
```

**Why deferred**: XRPL API calls are fast (typically <500ms on testnet), so stale responses rarely cause visible issues. The risk is low, but correctness improves — particularly for slow networks or rapid parameter changes (e.g., switching wallets quickly on the trade page).

**Preconditions**: Verify that `fetch` abort errors are caught and silenced (not surfaced as user-facing errors). The `AbortError` should be filtered in the catch block.
