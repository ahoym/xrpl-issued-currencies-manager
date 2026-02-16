# Deep Research: AMM Discovery Patterns

> How to discover AMM pools relevant to a user's currencies, enumerate LP positions, and integrate discovery into the existing trade UI.

## Problem Statement

The implementation plan assumes `amm_info` is queried on currency pair change to show pool info or a "Create Pool" CTA. But there are two broader discovery questions:

1. **User position discovery**: "Which AMM pools does this user have LP tokens in?"
2. **Pair-based discovery**: "Does an AMM pool exist for this currency pair?"

This research covers both, including the protocol mechanisms, codebase integration points, and recommended approach.

---

## Discovery Mechanisms

### 1. `amm_info` by Asset Pair (Primary — Already Planned)

Query a specific pair to check if an AMM exists:

```json
{
  "command": "amm_info",
  "asset": { "currency": "XRP" },
  "asset2": { "currency": "USD", "issuer": "rIssuerAddress..." }
}
```

- Returns full pool state if AMM exists
- Returns `actNotFound` error if no AMM — handle as `{ exists: false }`
- Lightweight, fast query
- Accepts optional `account` param to filter LP token info to a specific user's holdings

**This is the approach the implementation plan already assumes for Task 1.4 (`GET /api/amm/info`).**

### 2. `account_lines` LP Token Detection (User Position Discovery)

LP tokens appear as trust lines in `account_lines` with a 40-character hex currency code starting with `03`:

```json
{
  "command": "account_lines",
  "account": "rUserAddress...",
  "ledger_index": "validated"
}
```

**Response line for an LP token:**
```json
{
  "account": "rAMMPseudoAccount...",
  "balance": "87533.41976112682",
  "currency": "039C99CD9AB0B70B32ECDA51EAAE471625608EA2",
  "limit": "0",
  "limit_peer": "0",
  "no_ripple": false
}
```

**Key insight**: The `account` field (issuer) of an LP token trust line IS the AMM's pseudo-account address. You can pass it directly to `amm_info`:

```json
{
  "command": "amm_info",
  "amm_account": "rAMMPseudoAccount..."
}
```

This returns the pool's asset pair, reserves, fee, and (with `account` param) the user's specific LP holdings.

**Discovery algorithm:**
1. Call `account_lines` for the user
2. Filter lines where `currency.length === 40 && currency.startsWith("03")`
3. For each LP line, call `amm_info` with `amm_account` = `line.account`
4. Result: list of pools the user has positions in, with pair names and balances

### 3. Combinatorial `amm_info` for Known Currencies

Given a set of N currencies, query all N*(N-1)/2 pairs:

| Currencies | Pairs | `amm_info` Calls |
|-----------|-------|-----------------|
| 3 | 3 | 3 |
| 5 | 10 | 10 |
| 10 | 45 | 45 |

Each call is lightweight. For the typical user with 3–5 currencies, this is manageable and can be parallelized.

### 4. `ledger_data` with Type Filter (Enumerate ALL AMMs)

Since rippled 2.4.0, `ledger_data` supports filtering by `"AMM"` type:

```json
{
  "command": "ledger_data",
  "type": "AMM",
  "ledger_index": "validated",
  "limit": 256
}
```

Returns paginated AMM ledger entries. Each entry includes `Account`, `Asset`, `Asset2`, `LPTokenBalance`, `TradingFee`, `VoteSlots`, `AuctionSlot`.

**Not recommended for the app** — on mainnet there could be thousands of entries. Only useful for analytics dashboards or testnet debugging.

### 5. `ledger_entry` by AMM Asset Pair

The `ledger_entry` command can look up a specific AMM by asset pair:

```json
{
  "command": "ledger_entry",
  "amm": {
    "asset": { "currency": "XRP" },
    "asset2": { "currency": "USD", "issuer": "rIssuer..." }
  },
  "ledger_index": "validated"
}
```

Returns the raw AMM ledger entry. Lighter than `amm_info` (no auction slot computation), but less convenient — `amm_info` provides a richer, normalized response.

---

## Critical Finding: AMM Liquidity NOT in `book_offers`

**AMM synthetic offers are NOT returned by `book_offers` or `getOrderbook()`.** They are injected at the transaction execution layer (payment engine), not at the API query layer.

This means:
- The existing order book display does **not** reflect AMM pool depth
- Actual trades (`OfferCreate`) automatically route through AMMs when they offer better rates
- To show AMM liquidity in the UI, the app must separately query `amm_info` and compute the effective price from pool balances

**Impact**: The AMM Pool Panel (Task 3.2) is essential — without it, users have no visibility into AMM liquidity even though their trades benefit from it.

---

## LP Token Currency Code Structure

| Bytes | Content |
|-------|---------|
| Byte 0 | `0x03` — LP token type identifier |
| Bytes 1–19 | Truncated SHA-256 hash of canonical asset pair |

**Not reversible**: SHA-256 is one-way. Cannot determine the asset pair from the currency code alone. Must look up the AMM pseudo-account (the LP token's issuer) via `amm_info` to identify the pair.

**Forward computation** (checking if a known pair matches an LP token code) is theoretically possible by reimplementing the hash, but impractical — just use `amm_info`.

---

## Codebase Integration Analysis

### Current State: No LP Token Awareness

| Component | Current Behavior | LP Token Impact |
|-----------|-----------------|----------------|
| `account_lines` API route | Returns all lines unfiltered | LP tokens included but indistinguishable |
| Balances API route | Maps all lines to `CurrencyBalance` via `decodeCurrency` | LP tokens appear with raw hex currency code |
| `decodeCurrency()` | Attempts ASCII decode; returns raw hex for non-printable bytes | LP tokens show as 40-char hex garbage |
| `useTradingData()` currency options | Built from well-known + balances + custom | LP tokens included but unreadable |
| `CurrencyPairSelector` | Shows all currency options | LP tokens pollute the selector |
| `BalancesPanel` | Displays all balances | LP tokens shown with hex label |

### What Needs to Change (Already in Implementation Plan)

| Component | Change | Phase/Task |
|-----------|--------|-----------|
| `decodeCurrency()` or new `isLpTokenCurrency()` | Detect `0x03` prefix, return "LP Token" label | Phase 1, Task 1.2 |
| `BalancesPanel` | Filter out LP token balances from main display | Phase 4, Task 4.1 |
| Currency options | Exclude LP token currencies from pair selector | Phase 4, Task 4.1 (extends to selector) |
| AMM Pool Panel | Show LP token balances in dedicated section | Phase 3, Task 3.2 |

---

## Recommended Discovery Strategy

### For the Trade Page (Pair-Based Discovery)

**Already planned in Task 1.4**: Query `amm_info` on pair change.

```
User selects pair → useTradingData fetches orderbook
                  → useAmmPool fetches amm_info for same pair
                  → AmmPoolPanel shows pool info OR "Create Pool" CTA
```

No changes needed to the plan.

### For User LP Position Discovery (New Consideration)

**Recommended**: Add an LP positions section to the AMM Pool Panel that shows ALL of the user's AMM positions, not just the one for the currently selected pair.

**Implementation approach** (can be a future enhancement or folded into Phase 3):

1. Create `useAmmPositions(address, network)` hook
2. Fetch `account_lines` → filter for `0x03` prefix currencies
3. For each LP token line, call `amm_info` with `amm_account` = line issuer
4. Return array of `{ pair: [asset1, asset2], lpBalance, poolShare, totalLpSupply, reserves }`
5. Display in a collapsible "Your LP Positions" section

**Practical constraints:**
- Requires N+1 API calls (1 `account_lines` + N `amm_info` per LP position)
- On testnet, users rarely have >2-3 LP positions
- Can batch `amm_info` calls with `Promise.all`

### Whether to Add an API Route for LP Position Discovery

**Option A: Client-side only** — The `useAmmPositions` hook makes all calls from the browser via existing API routes (balances already include trust lines; add `amm_info` calls directly).

**Option B: Server-side aggregation** — Add `GET /api/accounts/[address]/amm-positions` that does the `account_lines` → filter → `amm_info` fan-out server-side and returns a pre-aggregated response.

**Recommendation: Option B** — Keeps the multi-call logic server-side (consistent with how the app handles other aggregated queries), reduces client-side complexity, and enables better error handling. However, this is a **future enhancement** — the implementation plan already covers the minimum viable case (pair-based discovery via `amm_info`).

---

## Impact on Implementation Plan

### No Changes Needed to Existing Tasks

The pair-based discovery approach (Task 1.4: `GET /api/amm/info`) is sufficient for the initial implementation. The AMM Pool Panel (Task 3.2) correctly shows pool info for the selected pair.

### Optional Future Enhancement

Add a "Your LP Positions" feature after the initial AMM integration:

**New Task (Future)**: `GET /api/accounts/[address]/amm-positions`
- Server-side fan-out: `account_lines` → filter 0x03-prefix → batch `amm_info`
- Response: array of pool summaries with user's LP balance and pool share
- Frontend: collapsible section in AMM panel or dedicated section on the trade page

This is explicitly deferred — it's useful but not blocking for the core AMM create/deposit/withdraw workflow.

### LP Token Filtering Validation

The implementation plan's Task 4.1 (LP Token Balance Filtering) correctly handles the display side. The detection logic (`isLpTokenCurrency`) from Task 1.2 is the only prerequisite.

---

## Sources

- [amm_info API Reference](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/path-and-order-book-methods/amm_info)
- [AMM Ledger Entry Type](https://xrpl.org/docs/references/protocol/ledger-data/ledger-entry-types/amm)
- [Currency Formats — LP Token Codes](https://xrpl.org/docs/references/protocol/data-types/currency-formats)
- [Automated Market Makers Concepts](https://xrpl.org/docs/concepts/tokens/decentralized-exchange/automated-market-makers)
- [ledger_data API Reference](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/ledger-methods/ledger_data)
- [ledger_entry API Reference](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/ledger-methods/ledger_entry)
- [book_offers API Reference](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/path-and-order-book-methods/book_offers)
- [XLS-30 AMM Specification](https://github.com/XRPLF/XRPL-Standards/blob/master/XLS-0030-automated-market-maker/README.md)
- [Deep Dive into AMM Integration Blog](https://xrpl.org/blog/2024/deep-dive-into-amm-integration)
- [rippled AMM PR #4294 (BookStep integration)](https://github.com/XRPLF/rippled/pull/4294)
