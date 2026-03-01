<!-- scan-metadata
commit: c6edc8f
branch: claude/branch-off-web-session-ueID3
date: 2026-03-01
dimensions: structure, api-surface, data-model, integrations, processing-flows, config-ops, testing
-->

# System Overview — XRPL Issued Currencies Manager

## Project Summary

XRPL Issued Currencies Manager is a full-stack Next.js 16 application for managing the complete lifecycle of issued currencies on the XRP Ledger — from wallet creation and trust line setup through currency issuance, peer-to-peer transfers, DEX trading (CLOB and AMM), and compliance (XLS-70 credentials and XLS-80 permissioned domains). The application is deliberately zero-infrastructure: no database, no environment variables, no external services beyond the public XRPL testnet/devnet nodes. All persistent state lives on the XRP Ledger itself, while wallet credentials are stored client-side in browser localStorage.

The architecture follows a strict server-mediated pattern: the browser frontend only communicates with its own Next.js API routes, which in turn interact with XRPL nodes via a singleton WebSocket client. Wallet seeds transit through POST request bodies for transaction signing but never persist server-side. This design keeps the application stateless and deployable to Vercel with zero configuration, at the cost of no retry logic, no distributed rate limiting, and a single-connection bottleneck for concurrent XRPL requests.

The codebase is structured as a single-package monorepo (pnpm, Node 22) with four main areas: `app/` (4 frontend pages + 27 API route handlers), `lib/` (shared XRPL utilities, hooks, and types), `scripts/` (21 bash test/setup scripts), and `e2e/` (Playwright browser tests). Testing spans three tiers — Vitest unit tests for math functions, bash integration scripts for every API endpoint, and Playwright E2E tests for full UI flows — though notably, unit tests are not run in CI.

## Architecture Overview

The system follows a three-tier architecture with the browser as the state owner:

1. **Browser (State Owner)**: Stores wallet seeds, network selection, registered currencies, and recipients in localStorage (per-network keys). Drives all user interactions through 4 pages: `/setup`, `/transact`, `/trade`, `/compliance`.

2. **Next.js API Layer (Stateless Mediator)**: 29 HTTP endpoints validate inputs, construct XRPL transactions, and submit them via `submitAndWait()`. The sole middleware is `proxy.ts` (rate limiting + request logging). No sessions, no auth, no database connections.

3. **XRP Ledger (Authoritative State)**: All account balances, trust lines, offers, credentials, domains, and AMM pools live on-ledger. The application queries this state via WebSocket commands (`account_info`, `account_lines`, `account_tx`, `account_offers`, `account_objects`, `book_offers`, `amm_info`).

The API layer has two distinct patterns:
- **Read operations** (GET): Query XRPL state and return normalized data. Some add server-side computation (orderbook levels, midprice metrics, trade parsing).
- **Write operations** (POST): Accept a wallet seed in the body, derive the wallet, construct and sign a transaction, submit via `submitAndWait()`, and return the result. The 10+ `tec*` error codes are mapped to human-readable messages per endpoint.

## Module Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌──────────────┐    │
│  │  /setup   │ │/transact │ │ /trade  │ │ /compliance  │    │
│  └────┬─────┘ └────┬─────┘ └────┬────┘ └──────┬───────┘    │
│       │            │            │              │            │
│  ┌────┴────────────┴────────────┴──────────────┴────────┐   │
│  │              lib/hooks/ (17 hooks)                    │   │
│  │  useAppState, useApiFetch, useApiMutation,            │   │
│  │  useBalances, useTradingData, useAmmPool, ...         │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │ fetch("/api/...")                  │
└─────────────────────────┼───────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────┐
│                    proxy.ts (rate limiting)                  │
├─────────────────────────┼───────────────────────────────────┤
│                         ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            app/api/ (27 route handlers)               │   │
│  │  accounts, currencies, transfers, dex, amm,           │   │
│  │  credentials, domains, ping                           │   │
│  └─────────────┬────────────────────────────────────────┘   │
│                │                                            │
│  ┌─────────────┼─────────────────────────────────────────┐  │
│  │             ▼                                         │  │
│  │  ┌──────────────┐  ┌───────────────┐  ┌────────────┐ │  │
│  │  │ lib/api.ts   │  │lib/xrpl/      │  │lib/xrpl/   │ │  │
│  │  │ (validation) │  │currency.ts    │  │client.ts   │ │  │
│  │  │              │  │credentials.ts │  │(singleton) │ │  │
│  │  └──────────────┘  │offers.ts      │  └─────┬──────┘ │  │
│  │                    │amm-math.ts    │        │        │  │
│  │                    │filled-orders  │        │        │  │
│  │                    └───────────────┘        │        │  │
│  └─────────────────────────────────────────────┼────────┘  │
│                    Next.js Server              │            │
└────────────────────────────────────────────────┼────────────┘
                                                 │ WebSocket
                                                 ▼
                                    ┌─────────────────────┐
                                    │    XRP Ledger        │
                                    │  testnet / devnet    │
                                    │  (+ mainnet for      │
                                    │   orderbook only)    │
                                    └─────────────────────┘
```

## Cross-Cutting Patterns

### 1. Transaction Submission Pattern
Every write operation follows: validate → derive wallet from seed → construct transaction → `submitAndWait()` → check `TransactionResult` → return success or `txFailureResponse()` with optional domain-specific error map.

### 2. Network Selection
GET endpoints read `?network=` from query string; POST endpoints read `"network"` from request body JSON. Both default to `"testnet"` via `resolveNetwork()`. Only `testnet` and `devnet` are supported (mainnet only for orderbook reads).

### 3. Currency Encoding Split
Encoding (`encodeXrplCurrency`, `encodeCredentialType`) is Node-only (uses `Buffer`). Decoding (`decodeCurrency`) has a browser-safe version in `decode-currency-client.ts`. Currency codes pad to 40 hex chars; credential types use variable-length hex.

### 4. Amount Type Proliferation
Four structurally identical `{currency, value, issuer?}` types exist: `DexAmount` (API), `OrderBookAmount` (display), `CurrencyBalance` (API response), `BalanceEntry` (frontend). They are structurally compatible but defined independently.

### 5. Error Handling
All errors use `{ error: string }` shape. Transaction failures use status 422 with optional `code` and `result` fields. Each mutation endpoint has its own `tecMessages` error map. The catch-all `apiErrorResponse()` returns 500 (or 404 for `actNotFound`).

### 6. Rate Limiting
Three tiers via token-bucket in `proxy.ts`: STRICT (5/min for wallet generation), MODERATE (15/min for POSTs), RELAXED (60/min for GETs). In-memory only (not distributed). Bucket key: `{IP}:{method}:{pathname}`.

### 7. Data Fetching (Frontend)
Two generic hooks: `useApiFetch<T>` (GET with auto-refresh via `refreshKey`) and `useApiMutation<T>` (POST with loading/error state). The mutation-refresh cycle: after a successful POST, increment `refreshKey` to trigger GET re-fetch.

### 8. Polling
`usePollInterval` fires every 3 seconds on the trade page, gated on page visibility (Page Visibility API). `useOfferExpirationTimers` schedules targeted refreshes for offers expiring within 5 minutes.

## Key Workflows End-to-End

### Currency Issuance (Setup → Transact)
```
[/setup UI] → POST /api/accounts/generate (fund issuer via faucet, set DefaultRipple)
           → POST /api/accounts/generate (fund recipient)
           → POST /api/accounts/{addr}/trustlines (recipient trusts issuer for currency)
           → POST /api/currencies/issue (issuer sends Payment to recipient)
           → GET /api/accounts/{addr}/balances (verify recipient holds tokens)
```
The trust line prerequisite is validated server-side — issuance fails without it. DefaultRipple must be enabled on the issuer for peer-to-peer transfers to work.

### DEX Trading (Trade Page)
```
[/trade UI] → GET /api/dex/orderbook (enriched: levels, depth, midprice)
            → GET /api/dex/trades (parsed from issuer's account_tx)
            → GET /api/accounts/{addr}/offers (user's open orders)
            → POST /api/dex/offers (place OfferCreate with flags, expiration, domainID)
            → POST /api/dex/offers/cancel (remove open offer)
```
Orderbook responses include computed midprice metrics (mid, microPrice, weightedMid, spread, spreadBps) and aggregated depth. The trade form uses `estimateFillCombined()` to show expected execution quality across both CLOB and AMM sources.

### Permissioned DEX (Compliance → Trade)
```
[/compliance] → POST /api/credentials/create (issuer attests KYC for trader)
              → POST /api/credentials/accept (trader accepts credential)
              → POST /api/domains/create (create domain requiring KYC credential)
[/trade]      → POST /api/dex/offers (include domainID → permissioned order)
              → GET /api/dex/orderbook?domain=... (filtered book)
```
Requires devnet (PermissionedDEX amendment not enabled on testnet).

### AMM Lifecycle (Trade Page)
```
[/trade UI] → POST /api/amm/create (deposit both assets + set trading fee)
            → GET /api/amm/info (pool state, spot/marginal prices, frozen status)
            → POST /api/amm/deposit (three modes: two-asset, single-asset, two-asset-if-empty)
            → POST /api/amm/withdraw (three modes: withdraw-all, two-asset, single-asset)
```
AMM fill estimation interleaves CLOB order book levels with the constant-product curve, always consuming from whichever source offers the better price.

## Critical Path to Productivity

1. **CLAUDE.md** — Project overview, all commands, API route table, lib module map, and critical gotchas. Start here.
2. **`lib/xrpl/types.ts`** — All request/response interfaces. Defines the contract between frontend and API routes.
3. **`lib/xrpl/client.ts`** — Singleton WebSocket client. Understanding its network-switching behavior prevents debugging headaches.
4. **`lib/api.ts`** — Shared validation helpers used by every API route. Shows the common validation pattern.
5. **`proxy.ts`** — The only middleware. Rate limiting tiers and request logging.
6. **`lib/hooks/use-app-state.tsx`** — Global state context. How localStorage persistence, network switching, and state migration work.
7. **`docs/learnings/processing-flows.md`** — All 16 core workflows traced end-to-end with code references.
8. **`docs/learnings/data-model.md`** — Entity relationships, state machines (credential/offer/domain lifecycles), and encoding gotchas.

## Resilience Assessment

| Integration | Retry Logic | Timeouts | Circuit Breaker | Idempotency Keys |
|---|---|---|---|---|
| XRPL Testnet/Devnet (WebSocket) | Absent | Unconfigured (SDK defaults) | Absent | Not used |
| XRPL Mainnet (WebSocket, orderbook only) | Absent | Unconfigured (SDK defaults) | Absent | Not used |
| XRPL Faucet (HTTP + SDK) | Absent | Unconfigured (no AbortController) | Absent | Not used |

**Overall posture: 0/3 integrations have retry logic, 0/3 have configured timeouts, 0/3 have circuit breakers, 0/3 use idempotency keys.**

This is consistent with a testnet/devnet-focused tool where transient failures are acceptable. However, the XRPL client singleton introduces a specific risk: concurrent requests targeting different networks cause connection thrashing that can fail both requests. The single WebSocket connection is also a bottleneck under concurrent `submitAndWait()` calls (each blocks for 3-5 seconds).

The only resilience mechanism is the XRPL client's reconnect-on-stale-connection logic in `getClient()`, which creates a new client if the existing one is disconnected.

## Test Coverage Gaps

### Source modules without unit tests

**High risk (core business logic):**
| Module | Purpose | Risk |
|---|---|---|
| `lib/xrpl/currency.ts` | Currency encoding/decoding, amount conversion | High — encoding bugs produce invalid ledger objects |
| `lib/xrpl/credentials.ts` | Credential type hex encoding | High — distinct from currency encoding, easy to confuse |
| `lib/xrpl/filled-orders.ts` | Trade history parsing from account_tx | High — complex filtering and fee subtraction logic |
| `lib/xrpl/order-book-levels.ts` | Order book level construction | High — determines displayed prices and depths |
| `lib/api.ts` | Shared validation helpers (11 functions) | Medium — used by every API route |

**Medium risk (infrastructure):**
| Module | Purpose | Risk |
|---|---|---|
| `lib/xrpl/client.ts` | WebSocket client singleton + network switching | Medium — hard to unit test (WebSocket), but connection bugs affect all routes |
| `lib/rate-limit.ts` | Token-bucket rate limiter | Medium — in-memory state management, cleanup timing |
| `lib/xrpl/offers.ts` | Offer flag resolution | Low — simple mapping |
| `lib/xrpl/match-currency.ts` | Currency comparison | Low — used in trade filtering |

**Low risk (simple utilities):**
| Module | Purpose | Risk |
|---|---|---|
| `lib/xrpl/build-dex-amount.ts` | DexAmount construction | Low — thin wrapper |
| `lib/xrpl/lp-token.ts` | LP token detection | Low — prefix check |
| `lib/xrpl/amm-fee.ts` | Fee formatting | Low — display only |
| `lib/xrpl/amm-helpers.ts` | Currency spec builder | Low — thin wrapper |
| `lib/xrpl/decode-currency-client.ts` | Browser-safe hex decoder | Low — simple string ops |
| `lib/xrpl/constants.ts` | Constants and epoch helpers | Low — pure values |
| `lib/xrpl/networks.ts` | Network definitions | Low — configuration |

**Structural gap:** All 27 API route handlers and all 17 React hooks have no unit tests. API routes are covered by bash integration scripts (17 scripts) and Playwright E2E tests (5 spec files, ~50 tests). Hooks have no dedicated tests.

**CI gap:** Vitest unit tests (`pnpm test`) are not run in the CI pipeline. Only lint, typecheck, format:check, build, and E2E tests run in CI.

## Documentation Gaps

### Critical — Blocks productivity

1. **No `pnpm test` in CLAUDE.md Commands section.** A developer discovering the 4 unit test files has no command reference. **Fix:** Add `pnpm test` to the Commands section.

2. **Missing API routes in README.md.** The README's API table omits 9 endpoints: `/api/ping`, `/api/accounts/[address]/fund`, `/api/accounts/[address]/filled-orders`, `/api/accounts/[address]/rippling`, `/api/dex/trades`, `/api/amm/info`, `/api/amm/create`, `/api/amm/deposit`, `/api/amm/withdraw`. **Fix:** Add missing routes.

3. **Incorrect xrpl version in CLAUDE.md and README.md.** Both say `v4.5.0` but `package.json` specifies `^4.6.0`. **Fix:** Update to `v4.6.0`.

### Medium — Missing but inferable from code

4. **No documentation of the `proxy.ts` rate limiting tiers.** CLAUDE.md mentions `proxy.ts` exists but doesn't describe the three tiers (STRICT/MODERATE/RELAXED) or bucket keying strategy. Developers may not realize rate limits exist until they hit 429 errors. **Fix:** Add rate limiting details to CLAUDE.md.

5. **Missing `pnpm typecheck` and `pnpm format:check` from Commands.** These are used in CI but not listed in CLAUDE.md. **Fix:** Add to Commands section.

6. **No CLAUDE.md for `lib/xrpl/`.** This directory has the most gotchas (encoding asymmetry, client singleton, Node-only vs browser-safe split) and would benefit from a focused guide. **Fix:** Create `lib/xrpl/CLAUDE.md`.

7. **Missing lib/xrpl modules from CLAUDE.md module map.** The module map omits: `order-book-levels.ts`, `midprice.ts`, `aggregate-depth.ts`, `amm-math.ts`, `estimate-fill.ts`, `estimate-fill-combined.ts`. **Fix:** Add to module map.

### Low — Nice-to-have improvements

8. **Missing hooks from CLAUDE.md hooks table.** Three hooks are not listed: `use-offer-expiration-timers.ts`, `use-page-visible.ts`, `use-poll-interval.ts`. **Fix:** Add to hooks table.

9. **README.md state file path is wrong.** Says `scripts/setup-state-<network>-<date>.json` but files are actually written to `examples/setup-state-<network>-<date>.json`. **Fix:** Correct the path.

10. **No mention of E2E tests in CLAUDE.md Commands.** `pnpm e2e` is available but not listed. **Fix:** Add to Commands section.
