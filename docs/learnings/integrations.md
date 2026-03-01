<!-- scan-metadata
agent: integrations
commit: 14d3ca5
branch: claude/branch-off-web-session-ueID3
date: 2026-03-01
-->

# Integrations

## Overview

This application has **2 external services** (XRP Ledger nodes and XRPL Faucet) plus **1 additional read-only mainnet endpoint** in the orderbook route. All external communication flows through the server-side API routes; the browser frontend only calls the application's own `/api/*` endpoints via `fetch()`. There is no database, no third-party auth provider, no analytics, and no external REST API beyond the XRPL ecosystem.

## Key Findings

1. **Dual WebSocket client pattern**: The primary XRPL client (`lib/xrpl/client.ts`) is a singleton that connects to testnet or devnet. A completely separate, independently managed mainnet client exists only in `app/api/dex/orderbook/route.ts` with a hardcoded URL (`wss://xrplcluster.com`). This second client is invisible to the rest of the codebase.

2. **Client singleton is network-switching, not multi-network**: `getClient()` tears down and replaces the connection when the network parameter changes. Only one XRPL WebSocket connection exists at a time (per client). Concurrent requests for different networks will cause connection thrashing.

3. **Faucet integration has two distinct code paths**: Wallet generation (`/api/accounts/generate`) uses the xrpl.js SDK's `client.fundWallet()` method. Account re-funding (`/api/accounts/[address]/fund`) makes a direct HTTP `fetch()` POST to the faucet REST API at `{network.faucet}/accounts`. These are entirely different mechanisms hitting the same faucet service.

4. **No retry logic anywhere**: Neither the XRPL WebSocket client nor the faucet HTTP calls implement retries, circuit breakers, or exponential backoff. A transient network failure results in an immediate error response.

5. **Wallet seeds transit through the server**: For every write operation, the frontend sends the wallet seed in the POST body to the API route, which derives the wallet and signs the transaction server-side. The seed never leaves `fetch()` to any external service -- it's only used in `Wallet.fromSeed()` and `client.submitAndWait()` within the API handler.

6. **CSP restricts connect-src to self**: `next.config.ts` sets `connect-src 'self'`, meaning the browser cannot make direct WebSocket or fetch connections to XRPL nodes. All external communication is server-mediated.

7. **`submitAndWait` is the universal transaction pattern**: Every write operation uses `client.submitAndWait(tx, { wallet })`, which blocks until the transaction is validated or times out. There is no fire-and-forget submission anywhere.

## External Services

### 1. XRP Ledger Nodes (Primary -- Testnet/Devnet)

- **Purpose**: All ledger queries and transaction submissions
- **Type**: WebSocket (persistent connection via xrpl.js `Client`)
- **Endpoints**:
  - Testnet: `wss://s.altnet.rippletest.net:51233`
  - Devnet: `wss://s.devnet.rippletest.net:51233`
- **Auth**: None (public nodes operated by Ripple)
- **Config**: `lib/xrpl/networks.ts` (hardcoded URLs, no env vars)
- **Client code**: `lib/xrpl/client.ts` (singleton `getClient(network)`)

**Key operations (XRPL WebSocket commands used)**:

| Command | Used in | Purpose |
|---|---|---|
| `account_info` | Account info, balances, rippling check | Read account data/flags |
| `account_lines` | Balances, trustlines, rippling, issue-currency | Trust line queries |
| `account_tx` | Transactions, filled-orders, trades | Transaction history |
| `account_offers` | Offers listing | Open DEX offers |
| `account_objects` | Credentials, domains | XLS-70 credentials, XLS-80 domains |
| `book_offers` | Orderbook (permissioned DEX path) | Raw order book data |
| `amm_info` | AMM info, withdraw verification | AMM pool status |

**Key operations (xrpl.js SDK methods)**:

| Method | Used in | Purpose |
|---|---|---|
| `client.submitAndWait()` | All write routes (17 usages) | Sign + submit + wait for validation |
| `client.fundWallet()` | `/api/accounts/generate` | Generate funded wallet via faucet |
| `client.getOrderbook()` | `/api/dex/orderbook` (open DEX path) | Sorted, paginated order book |
| `Wallet.generate()` | `/api/accounts/generate` | Keypair generation |
| `Wallet.fromSeed()` | `lib/api.ts` `walletFromSeed()` | Derive wallet from secret |
| `getBalanceChanges()` | `/api/dex/trades`, `lib/xrpl/filled-orders.ts` | Parse trade execution amounts |

**Error handling**: `try/catch` with `apiErrorResponse()` returning 500 (or 404 for `actNotFound`). No retries. Transaction failures use `txFailureResponse()` with optional human-readable error maps (e.g., `tecPATH_DRY` mapped to "No payment path found...").

### 2. XRP Ledger Mainnet Node

- **Purpose**: Read-only orderbook data for mainnet currency pairs
- **Type**: WebSocket (persistent connection via separate xrpl.js `Client`)
- **Endpoint**: `wss://xrplcluster.com` (hardcoded in `app/api/dex/orderbook/route.ts`)
- **Auth**: None (public community node)
- **Client code**: Local `getMainnetClient()` function in `app/api/dex/orderbook/route.ts` (lines 22-37), module-level singleton separate from the primary client
- **Operations**: `client.getOrderbook()` and `client.request({ command: "book_offers" })`
- **Error handling**: Same `apiErrorResponse()` pattern; reconnect on stale connection

### 3. XRPL Faucet (Testnet/Devnet)

- **Purpose**: Fund test accounts with XRP
- **Type**: REST (HTTPS POST) and SDK method
- **Endpoints**:
  - Testnet: `https://faucet.altnet.rippletest.net`
  - Devnet: `https://faucet.devnet.rippletest.net`
- **Auth**: None (open test faucet)
- **Config**: `lib/xrpl/networks.ts` (`faucet` field per network)

**Two distinct code paths**:

1. **SDK path** (`app/api/accounts/generate/route.ts`): `client.fundWallet(wallet, { amount: "1000" })` -- the xrpl.js SDK internally calls the faucet REST API. Used only during initial wallet generation.

2. **Direct fetch path** (`app/api/accounts/[address]/fund/route.ts`): `fetch(\`${faucet}/accounts\`, { method: "POST", body: { destination: address } })` -- raw HTTP POST for re-funding existing accounts. Returns 502 on faucet failure.

**Error handling**: SDK path relies on xrpl.js error propagation. Direct fetch path checks `res.ok` and returns 502 with the faucet's error text.

### 4. XRPL Block Explorers (Client-Side Links Only)

- **Purpose**: Outbound links for users to view accounts on explorer
- **Type**: Hyperlinks only (no API calls)
- **Endpoints**:
  - Testnet: `https://testnet.xrpl.org`
  - Devnet: `https://devnet.xrpl.org`
- **Config**: `lib/xrpl/networks.ts` (`EXPLORER_URLS`)
- **Code**: `app/components/explorer-link.tsx` renders `<a>` tags

## Integration Patterns

### Client Library

The xrpl.js SDK v4.6.0 (`xrpl` npm package) is the sole external SDK. It provides:
- `Client` class for WebSocket connections
- Transaction type constructors (`Payment`, `TrustSet`, `OfferCreate`, etc.)
- Utility functions (`xrpToDrops`, `dropsToXrp`, `isValidClassicAddress`, `getBalanceChanges`)
- `Wallet` class for key management

### Connection Management

**Primary client** (`lib/xrpl/client.ts`):
- Module-level singleton (`currentClient`, `currentNetwork`)
- On request: if same network and connected, reuse; if disconnected, reconnect; if different network, disconnect old + create new
- No connection pooling; single WebSocket connection shared across all concurrent requests
- No idle timeout or proactive keepalive

**Mainnet client** (`app/api/dex/orderbook/route.ts`):
- Separate module-level singleton (`mainnetClient`)
- Same reconnect-on-stale pattern
- Only activated when `network=mainnet` query param is passed to orderbook endpoint

### Retry Strategy

**None.** No retries exist at any level:
- No retry on WebSocket disconnection during a request
- No retry on faucet HTTP failure
- No retry on `submitAndWait` timeout
- No circuit breaker pattern

### Timeout Defaults

- xrpl.js `submitAndWait` uses the SDK's default timeout (not configured)
- xrpl.js `Client` connection uses SDK defaults (not configured)
- HTTP `fetch()` to faucet uses Node's default timeout (no `AbortController`)

### Frontend-to-Backend Communication

All frontend components use `fetch()` to call the app's own API routes (`/api/*`). Two generic hooks abstract the pattern:

- `useApiFetch<T>()` (`lib/hooks/use-api-fetch.ts`): GET requests with auto-refresh on key change
- `useApiMutation<T>()` (`lib/hooks/use-api-mutation.ts`): POST requests with loading/error state

Trading data polling: `useTradingData()` uses `usePollInterval()` to silently refresh orderbook, trades, offers, and filled orders every 3 seconds when a currency pair is selected.

### Rate Limiting

`proxy.ts` implements a token-bucket rate limiter (`lib/rate-limit.ts`) on all `/api/*` routes:

| Tier | Routes | Limit |
|---|---|---|
| Strict | `POST /api/accounts/generate` | 5 req/min |
| Moderate | All other POST routes | 15 req/min |
| Relaxed | All GET routes | 60 req/min |

Keyed by `{IP}:{method}:{pathname}`. In-memory only (not distributed).

## Authentication Summary

- **XRPL nodes**: No authentication. Public WebSocket endpoints.
- **XRPL faucet**: No authentication. Open test infrastructure.
- **User wallets**: Seeds are stored client-side in `localStorage` (via `useLocalStorage` hook in `lib/hooks/use-local-storage.ts`). Seeds are sent to API routes in POST request bodies when signing is needed. They never persist server-side and are never forwarded to external services directly -- they're used only in `Wallet.fromSeed()` within the API handler to sign transactions locally before submission.
- **No user accounts, sessions, or tokens**: The application has no concept of user authentication. Anyone with access to the UI can generate wallets and transact.

## Gotchas

1. **Network switching destroys the active connection**: Calling `getClient("devnet")` after `getClient("testnet")` disconnects from testnet. If concurrent API requests target different networks, they will fight over the singleton and cause errors.

2. **Mainnet client is hidden and independently managed**: The `wss://xrplcluster.com` connection in `app/api/dex/orderbook/route.ts` is not visible to `getClient()` and won't be cleaned up if the main client pattern changes. It's also the only place mainnet is referenced.

3. **`fundWallet` vs direct faucet fetch**: Two different faucet integrations exist with different error handling. `fundWallet` throws on failure; direct fetch returns HTTP error details. A developer might expect consistency.

4. **`submitAndWait` blocks the request**: Every write operation holds the HTTP request open until the XRPL transaction is validated (typically 3-5 seconds, up to the SDK timeout). Under load, this means many long-lived requests competing for a single WebSocket connection.

5. **No graceful shutdown**: There is no cleanup logic to disconnect the XRPL WebSocket client(s) when the server shuts down. Module-level singletons rely on process termination for cleanup.

6. **CSP `connect-src 'self'`**: The Content Security Policy in `next.config.ts` blocks the browser from making any external network requests. If a future feature needs client-side WebSocket to XRPL, the CSP must be updated.

7. **Trust comment in `networks.ts`**: The file explicitly notes that these URLs are security-critical -- changing them could enable transaction interception. The URLs are hardcoded with no env-var override, making them tamper-resistant but also inflexible.

## Scan Limitations

- **Test scripts** (`scripts/*.sh`): These use `curl` against the API and were not deeply analyzed for integration patterns, as they are test-time tooling rather than production code.
- **E2E tests** (`e2e/*.spec.ts`): Playwright tests that exercise the frontend were noted but not exhaustively read for integration details.
- **xrpl.js internal behavior**: The SDK's internal retry/reconnect logic, timeout defaults, and faucet HTTP details were not traced into `node_modules`. Behavior described is based on observed usage patterns.
- **`openapi.yaml`**: Not read, as it describes the app's own API surface rather than external integrations.
