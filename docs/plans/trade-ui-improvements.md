# Plan: Port 6 Features from xrpl-dex-portal to Trade Page

## Context

The `xrpl-dex-portal` project has a more polished trade UI with features like auto-polling, depth controls, balance validation, skeleton loading, explorer links, and smart pair defaults. We're porting these 6 features to improve the trade page in this project, while preserving existing permissioned DEX, MakeMarket, and multi-wallet support. The Orders Sheet (open + filled tabs, bottom sheet) is scoped out to a separate follow-up plan (`docs/plans/orders-sheet.md`).

## Design Decisions

- **Keep separate API endpoints** (orderbook/trades/offers) rather than a combined market-data endpoint — less disruption, already tested
- **Fetch orderbook with limit=200**, slice client-side by depth — depth summary needs full book, API already supports `limit` param

## Parallel Execution Strategy

Work is split into 3 phases with a dependency graph that maximizes parallelism:

```
Phase 1 (4 agents in parallel — no file conflicts):
  Agent A: recent-trades.tsx          (explorer links)
  Agent B: balances-panel.tsx         (skeleton loading + refresh)
  Agent C: trade-form.tsx             (balance validation)
  Agent D: 3 new hooks + order-book.tsx + lib/types.ts  (depth controls + polling hooks)

Phase 2 (1 agent — depends on Agent D only):
  Agent E: use-trading-data.ts        (silent fetch, polling, higher limit, fill detection)

Phase 3 (1 agent — depends on all above):
  Agent F: trade-grid.tsx + page.tsx  (wire new props, smart defaults, depth state)
```

Agents A, B, C can run concurrently with E (no shared files). E starts as soon as D finishes.

---

## Phase 1 — Component-level Work (parallel, no file conflicts)

### Agent A: Explorer links on recent trades
**File**: `app/trade/components/recent-trades.tsx`
- Add `network` prop to `RecentTradesProps`
- Import `EXPLORER_URLS` from `lib/xrpl/networks`
- Build explorer base URL: `EXPLORER_URLS[network as NetworkId]`
- Add `onClick` handler to each trade `<tr>`: `window.open(\`${explorerBase}/transactions/${trade.hash}\`, "_blank", "noopener,noreferrer")`
- Add `cursor-pointer` class to trade rows
- DO NOT modify `trade-grid.tsx` — that's handled in Phase 3

### Agent B: Skeleton loading on balances panel
**File**: `app/trade/components/balances-panel.tsx`
- Add `onRefresh?: () => void` prop
- Add refresh button in header next to "Balances" title (disabled while loading)
- Replace loading text with 3 animated skeleton rows using `animate-pulse` divs
- DO NOT modify `trade-grid.tsx` — that's handled in Phase 3

### Agent C: Balance validation in trade form
**File**: `app/trade/components/trade-form.tsx`
- Add `balances?: BalanceEntry[]` prop
- Import `matchesCurrency` from `lib/xrpl/match-currency` and `BalanceEntry` from `lib/types`
- Compute `insufficientBalance` with `useMemo`:
  - Buy tab: `spendCurrency = buyingCurrency`, `spendAmount = amount * price` (total)
  - Sell tab: `spendCurrency = sellingCurrency`, `spendAmount = amount`
  - Find balance via `matchesCurrency()`, compare against spend amount
- Show amber warning text below total: "Insufficient balance"
- Add `insufficientBalance` to `canSubmit` guard (disable submit)
- DO NOT modify `trade-grid.tsx` — that's handled in Phase 3

### Agent D: Depth controls + new polling hooks
**Files to create**:
- `lib/hooks/use-page-visible.ts` — `usePageVisible()`: tracks `document.visibilityState`, returns boolean
- `lib/hooks/use-poll-interval.ts` — `usePollInterval(callback, intervalMs, enabled)`: fires callback on interval, uses `usePageVisible()` to pause when tab hidden, guards overlap with `inFlightRef`, uses `callbackRef` to avoid stale closures, never fires initial call
- `lib/hooks/use-offer-expiration-timers.ts` — `useOfferExpirationTimers(offers, onExpired)`: single `setTimeout` for nearest-expiring offer within 5 minutes, +1s buffer after expiry, re-runs when offers change

**Files to modify**:
- `lib/types.ts` — add `DepthSummary` interface: `{ bidVolume: number, bidLevels: number, askVolume: number, askLevels: number }`
- `app/trade/components/order-book.tsx`:
  - Export `DEPTH_OPTIONS = [10, 25, 50, 100] as const` and `type DepthLevel`
  - Add `depth: DepthLevel` + `onDepthChange: (d: DepthLevel) => void` props
  - Slice displayed asks/bids by depth (asks: `slice(-depth)`, bids: `slice(0, depth)`)
  - Compute depth summary from full unsliced arrays (sum amounts/totals across all bids/asks)
  - Add `formatCompact()` helper (B/M/K suffixes)
  - Add depth selector `<select>` in header bar
  - Add summary line below the book: "N bids · XK depth | N asks · XK depth"

---

## Phase 2 — Data Layer (depends on Agent D only)

### Agent E: Silent fetch + polling integration
**File**: `lib/hooks/use-trading-data.ts`
- Add `silent` param to `fetchOrderBook`, `fetchAccountOffers`, `fetchRecentTrades` — when `true`, skip `setLoading*` calls
- Change orderbook fetch to use `limit=200` (was `DEFAULT_ORDERBOOK_LIMIT`)
- Add `silentRefresh` callback: fires all 3 fetches in parallel with `silent=true`
- Import and wire `usePollInterval(silentRefresh, 3000, pairSelected)`
- Import and wire `useOfferExpirationTimers(accountOffers, silentRefresh)`
- Add reactive fill detection: track `recentTrades` hashes in a `useRef<Set>`, when new trades from user's address appear, silently refresh offers

---

## Phase 3 — Integration (depends on all above)

### Agent F: Wire everything in trade-grid + page
**File**: `app/trade/components/trade-grid.tsx`
- Pass `network` to `<RecentTrades>` (Agent A's new prop)
- Pass `onRefresh` to `<BalancesPanel>` (Agent B's new prop)
- Pass `balances` to `<TradeForm>` (Agent C's new prop)
- Pass `depth` + `onDepthChange` to `<OrderBook>` (Agent D's new props)

**File**: `app/trade/page.tsx`
- Replace hardcoded `useState` initializers for selling/buying with empty strings
- Add `useEffect` for smart defaults: check `WELL_KNOWN_CURRENCIES[state.network]?.RLUSD`, default to RLUSD/XRP if present, XRP/"" if not
- Add `depth` state: `useState<DepthLevel>(DEPTH_OPTIONS[1])` (default 25)
- Import `DEPTH_OPTIONS` and `DepthLevel` from order-book
- Pass `depth` + `setDepth` through to TradeGrid

---

## File Summary

| Action | File | Phase | Agent |
|--------|------|-------|-------|
| Modify | `app/trade/components/recent-trades.tsx` | 1 | A |
| Modify | `app/trade/components/balances-panel.tsx` | 1 | B |
| Modify | `app/trade/components/trade-form.tsx` | 1 | C |
| Create | `lib/hooks/use-page-visible.ts` | 1 | D |
| Create | `lib/hooks/use-poll-interval.ts` | 1 | D |
| Create | `lib/hooks/use-offer-expiration-timers.ts` | 1 | D |
| Modify | `lib/types.ts` | 1 | D |
| Modify | `app/trade/components/order-book.tsx` | 1 | D |
| Modify | `lib/hooks/use-trading-data.ts` | 2 | E |
| Modify | `app/trade/components/trade-grid.tsx` | 3 | F |
| Modify | `app/trade/page.tsx` | 3 | F |

## Verification

1. `pnpm build` — must compile cleanly
2. `pnpm dev` — trade page loads, pair defaults correctly per network
3. Select a currency pair → orderbook shows with depth selector, depth summary line visible
4. Click a recent trade row → opens explorer in new tab
5. Balances panel shows skeleton while loading, refresh button works
6. Place an order exceeding balance → "Insufficient balance" warning, submit disabled
7. Wait 3+ seconds → data refreshes silently (no loading spinners)
8. Switch to another tab, wait, switch back → polling resumes
