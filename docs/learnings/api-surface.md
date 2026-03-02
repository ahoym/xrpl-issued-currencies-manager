<!-- scan-metadata
agent: api-surface
commit: 14d3ca5
branch: claude/branch-off-web-session-ueID3
date: 2026-03-01
-->

# API Surface

## Endpoints Overview

The API exposes **27 route handler files** implementing **29 HTTP endpoints** (some files export multiple methods). All routes live under `app/api/` using the Next.js App Router convention. There is **no API versioning** -- all endpoints are served at `/api/` with no version prefix.

Endpoint groups:
- **Accounts** (8 endpoints) -- wallet generation, funding, info, balances, trust lines, transactions, offers, rippling
- **Currencies** (1 endpoint) -- issue currency from issuer to recipient
- **Transfers** (1 endpoint) -- transfer currency between wallets
- **DEX** (4 endpoints) -- place/cancel offers, view orderbook, view recent trades
- **Credentials** (4 endpoints) -- create/accept/delete credentials, list account credentials (XLS-70)
- **Domains** (3 endpoints) -- create/delete permissioned domains, list account domains (XLS-80)
- **AMM** (4 endpoints) -- pool info, create, deposit, withdraw
- **Filled Orders** (1 endpoint) -- parsed fill history for a currency pair
- **Health** (1 endpoint) -- simple ping

## Key Findings

1. **No authentication mechanism exists.** Wallet seeds are passed in POST request bodies for transaction signing. There are no API keys, JWTs, sessions, or OAuth flows. The only "auth" is possession of a valid XRPL wallet seed, which is validated server-side by deriving the wallet and checking it matches the expected address.

2. **The proxy (rate limiter) is the only middleware.** It runs on all `/api/*` routes via Next.js 16's `proxy.ts` (not `middleware.ts`). Three tiers exist: STRICT (5 req/min for account generation), MODERATE (15 req/min for all other POSTs), and RELAXED (60 req/min for GETs). Rate limit keys combine `IP:method:pathname`.

3. **Network selection is inconsistent across GET vs POST.** GET endpoints read `network` from the query string via `getNetworkParam()`. POST endpoints read `network` from the JSON request body. Both default to `"testnet"` via `resolveNetwork()`. Only two networks are supported: `testnet` and `devnet`.

4. **The orderbook endpoint has a special mainnet client.** `GET /api/dex/orderbook` creates a separate WebSocket connection to `wss://xrplcluster.com` for mainnet queries, bypassing the singleton `getClient()`. This is the only endpoint that supports mainnet.

5. **The `/api/dex/orderbook` endpoint returns enriched data** beyond raw XRPL responses: it computes order book levels (asks/bids), aggregated depth summary, and midprice metrics (mid, microPrice, weightedMid, spread, spreadBps). This is a significant server-side computation layer.

6. **Domain-scoped (permissioned DEX) support threads through multiple endpoints.** The `POST /api/dex/offers` accepts an optional `domainID` field. `GET /api/dex/orderbook` and `GET /api/dex/trades` accept a `domain` query param. The trades endpoint filters by domain: if a domain is specified, only matching trades are returned; otherwise, permissioned-domain trades are excluded from open DEX results.

7. **Transaction failure responses include friendly error messages.** The `/api/transfers` route maps 10+ XRPL `tec*` codes to human-readable messages. AMM endpoints have similar error maps. The generic `txFailureResponse()` helper returns status 422 with the XRPL engine result code, and optionally a friendly message from a provided error map.

## REST Endpoints

### Health

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/ping` | Returns `{ status: "ok" }` | None |

### Accounts

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/accounts/generate` | Generate wallet, fund via faucet, optionally enable DefaultRipple | None (body: `network?`, `isIssuer?`) |
| GET | `/api/accounts/{address}` | Raw `account_info` from ledger | None (query: `network?`) |
| GET | `/api/accounts/{address}/balances` | XRP balance + all issued currency balances | None (query: `network?`) |
| POST | `/api/accounts/{address}/fund` | Re-fund existing account via faucet | None (body: `network?`) |
| GET | `/api/accounts/{address}/trustlines` | List trust lines via `account_lines` | None (query: `network?`) |
| POST | `/api/accounts/{address}/trustlines` | Create trust line (TrustSet) | Seed in body, validated against URL address |
| GET | `/api/accounts/{address}/transactions` | Transaction history via `account_tx` | None (query: `network?`, `limit?`) |
| GET | `/api/accounts/{address}/offers` | Open DEX offers via `account_offers` | None (query: `network?`, `limit?`, `marker?`) |
| GET | `/api/accounts/{address}/filled-orders` | Parsed filled orders for a currency pair | None (query: `network?`, `limit?`, currency pair params) |
| GET | `/api/accounts/{address}/credentials` | List credentials (XLS-70) | None (query: `network?`, `role?`) |
| GET | `/api/accounts/{address}/domains` | List permissioned domains (XLS-80) | None (query: `network?`) |
| POST | `/api/accounts/{address}/rippling` | Enable DefaultRipple + clear NoRipple on existing trust lines | Seed in body, validated against URL address |

### Currencies & Transfers

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/currencies/issue` | Issue currency (Payment from issuer to recipient) | `issuerSeed` in body |
| POST | `/api/transfers` | Transfer currency between wallets (XRP or issued) | `senderSeed` in body |

### DEX

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/dex/offers` | Place DEX offer (OfferCreate), optional `domainID` | `seed` in body |
| POST | `/api/dex/offers/cancel` | Cancel DEX offer (OfferCancel) | `seed` in body |
| GET | `/api/dex/orderbook` | View order book with levels, depth, midprice metrics | None (query: currency pair, `network?`, `domain?`) |
| GET | `/api/dex/trades` | Recent trades for a currency pair | None (query: currency pair, `network?`, `limit?`, `domain?`) |

### Credentials (XLS-70)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/credentials/create` | Issue credential (CredentialCreate) | `seed` in body |
| POST | `/api/credentials/accept` | Accept credential (CredentialAccept) | `seed` in body |
| POST | `/api/credentials/delete` | Delete credential (CredentialDelete) | `seed` in body |

### Domains (XLS-80)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/domains/create` | Create/update permissioned domain (PermissionedDomainSet) | `seed` in body |
| POST | `/api/domains/delete` | Delete permissioned domain (PermissionedDomainDelete) | `seed` in body |

### AMM

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/amm/info` | Pool info with spot/marginal prices, fee, frozen status | None (query: currency pair, `network?`) |
| POST | `/api/amm/create` | Create AMM pool (AMMCreate) | `seed` in body |
| POST | `/api/amm/deposit` | Deposit to AMM pool (modes: two-asset, single-asset, two-asset-if-empty) | `seed` in body |
| POST | `/api/amm/withdraw` | Withdraw from AMM pool (modes: withdraw-all, two-asset, single-asset) | `seed` in body |

## Request/Response Models

### Core Request Types (from `lib/xrpl/types.ts`)

**`IssueCurrencyRequest`** -- used by `POST /api/currencies/issue`
- `issuerSeed: string` -- wallet seed of the issuing account
- `recipientAddress: string` -- XRPL address receiving the currency
- `currencyCode: string` -- 3-40 char currency code
- `amount: string` -- positive decimal amount
- `network?: string`

**`TransferRequest`** -- used by `POST /api/transfers`
- `senderSeed: string` -- wallet seed of the sender
- `recipientAddress: string`
- `issuerAddress?: string` -- required for non-XRP transfers
- `currencyCode: string` -- "XRP" for native, otherwise issued currency code
- `amount: string`
- `network?: string`

**`TrustLineRequest`** -- used by `POST /api/accounts/{address}/trustlines`
- `seed: string` -- must derive to the address in the URL path
- `currency: string`
- `issuer: string`
- `limit: string` -- trust line limit value
- `network?: string`

**`CreateOfferRequest`** -- used by `POST /api/dex/offers`
- `seed: string`
- `takerGets: DexAmount` -- what the offer provides
- `takerPays: DexAmount` -- what the offer wants in return
- `flags?: OfferFlag[]` -- `"passive"`, `"immediateOrCancel"`, `"fillOrKill"`, `"sell"`, `"hybrid"`
- `expiration?: number` -- Ripple epoch timestamp
- `offerSequence?: number` -- replace existing offer
- `domainID?: string` -- 64-char hex for permissioned DEX
- `network?: string`

**`CancelOfferRequest`** -- used by `POST /api/dex/offers/cancel`
- `seed: string`
- `offerSequence: number`
- `network?: string`

**`CreateCredentialRequest`** -- used by `POST /api/credentials/create`
- `seed: string` -- issuer's wallet seed
- `subject: string` -- XRPL address of the credential subject
- `credentialType: string` -- max 128 chars
- `expiration?: number` -- Ripple epoch timestamp
- `uri?: string` -- max 256 bytes (UTF-8)
- `network?: string`

**`AcceptCredentialRequest`** -- used by `POST /api/credentials/accept`
- `seed: string` -- subject's wallet seed
- `issuer: string` -- XRPL address of credential issuer
- `credentialType: string`
- `network?: string`

**`DeleteCredentialRequest`** -- used by `POST /api/credentials/delete`
- `seed: string`
- `subject?: string` -- at least one of subject/issuer required
- `issuer?: string`
- `credentialType: string`
- `network?: string`

**`CreateDomainRequest`** -- used by `POST /api/domains/create`
- `seed: string`
- `domainID?: string` -- if provided, updates existing domain
- `acceptedCredentials: { issuer: string; credentialType: string }[]` -- 1 to 10 entries
- `network?: string`

**`DeleteDomainRequest`** -- used by `POST /api/domains/delete`
- `seed: string`
- `domainID: string` -- 64-char hex string
- `network?: string`

**`CreateAmmRequest`** -- used by `POST /api/amm/create`
- `seed: string`
- `amount: DexAmount` -- first asset deposit
- `amount2: DexAmount` -- second asset deposit
- `tradingFee: number` -- integer 0-1000 (0%-1%)
- `network?: string`

**`DepositAmmRequest`** -- used by `POST /api/amm/deposit`
- `seed: string`
- `asset: { currency: string; issuer?: string }` -- pool identifier asset 1
- `asset2: { currency: string; issuer?: string }` -- pool identifier asset 2
- `amount?: DexAmount` -- deposit amount for asset 1
- `amount2?: DexAmount` -- deposit amount for asset 2
- `lpTokenOut?: DexAmount` -- (present in type, not validated in handler)
- `mode: "two-asset" | "single-asset" | "two-asset-if-empty"`
- `network?: string`

**`WithdrawAmmRequest`** -- used by `POST /api/amm/withdraw`
- `seed: string`
- `asset: { currency: string; issuer?: string }`
- `asset2: { currency: string; issuer?: string }`
- `amount?: DexAmount`
- `amount2?: DexAmount`
- `lpTokenIn?: DexAmount` -- (present in type, not validated in handler)
- `mode: "withdraw-all" | "two-asset" | "single-asset"`
- `network?: string`

### Shared Amount Type

**`DexAmount`** -- used across DEX and AMM endpoints
- `currency: string`
- `issuer?: string` -- required for non-XRP currencies
- `value: string` -- decimal amount as string

### Core Response Types

**`GenerateAccountResponse`** -- from `POST /api/accounts/generate`
- `address: string`
- `seed: string` -- wallet secret (returned to caller to store client-side)
- `publicKey: string`
- `balance: string`

**`ApiError`** -- universal error shape
- `error: string` -- human-readable error message

**`CurrencyBalance`** -- used in balance responses
- `currency: string`
- `value: string`
- `issuer?: string`

### Response Types (from `lib/types.ts`)

**`CredentialInfo`** -- returned by `GET /api/accounts/{address}/credentials`
- `issuer: string`, `subject: string`, `credentialType: string`, `accepted: boolean`, `expiration?: number`, `uri?: string`

**`DomainInfo`** -- returned by `GET /api/accounts/{address}/domains`
- `domainID: string`, `owner: string`, `acceptedCredentials: { issuer: string; credentialType: string }[]`, `sequence: number`

**`MidpriceMetrics`** -- embedded in orderbook response
- `mid: string | null`, `microPrice: string | null`, `weightedMid: string | null`, `spread: string | null`, `spreadBps: string | null`

**`AmmPoolInfo`** -- returned by `GET /api/amm/info`
- `exists: boolean` -- if false, no AMM pool exists for the pair (remaining fields absent)
- `account?: string`, `asset1?`, `asset2?`, `lpToken?`, `tradingFee?: number`, `tradingFeeDisplay?: string`
- `spotPrice?: string`, `invertedSpotPrice?: string`, `effectivePrice?: string`
- `marginalBuyPrice?: string`, `marginalSellPrice?: string`
- `assetFrozen?: boolean`, `asset2Frozen?: boolean`
- `auctionSlot?: AmmAuctionSlot | null`, `voteSlots?: AmmVoteSlot[]`

## API Conventions

### Network Selection
- **GET endpoints**: `?network=testnet` or `?network=devnet` query parameter
- **POST endpoints**: `"network": "testnet"` in request body JSON
- Default: `"testnet"` (via `resolveNetwork()` in `lib/xrpl/networks.ts`)
- Only `testnet` and `devnet` are supported (unknown values silently fall back to testnet with a console warning)
- Exception: `GET /api/dex/orderbook` also supports `?network=mainnet` via a hardcoded `wss://xrplcluster.com` connection

### Error Format
All errors follow `{ error: string }` shape (`ApiError` interface). HTTP status codes used:
- **400** -- validation failures (missing fields, invalid addresses, invalid seeds, bad amounts)
- **404** -- account not found on ledger (`actNotFound` from XRPL)
- **422** -- transaction submitted but failed on-ledger (includes XRPL engine result code); body may include `{ error, code?, result? }`
- **429** -- rate limit exceeded (includes `Retry-After` header)
- **500** -- unexpected server errors
- **502** -- faucet request failure (only `/api/accounts/{address}/fund`)

### Pagination
- **`limit` query param**: Supported on transactions (default 20), offers (default 200), filled-orders (default 20), trades (default 20). All capped at `MAX_API_LIMIT = 400`.
- **`marker` query param**: Only supported on `GET /api/accounts/{address}/offers`. Validated to be 1-256 chars. Returned in response as `marker` field when more pages exist.
- No cursor-based pagination on other endpoints. Trades and filled-orders use a fetch multiplier (5x) to over-fetch from XRPL and then filter/truncate.

### Authentication / Seed Handling
- No API keys, tokens, or sessions
- Write operations require a wallet `seed` in the POST body
- For address-scoped routes (`/api/accounts/{address}/trustlines`, `/api/accounts/{address}/rippling`), the seed is validated to derive to the same address via `validateSeedMatchesAddress()`
- Seeds are never stored server-side; the XRPL client singleton persists WebSocket connections but not secrets

### Validation Approach
Validation is performed inline at the top of each route handler using helpers from `lib/api.ts`:
- `validateRequired()` -- checks for truthy values on listed fields; returns 400 with missing field names
- `validateAddress()` -- uses `isValidClassicAddress()` from xrpl.js
- `validateSeedMatchesAddress()` -- derives wallet from seed and compares addresses
- `validatePositiveAmount()` -- checks `Number.isFinite()` and `> 0`
- `validateCredentialType()` -- checks string length against MAX_CREDENTIAL_TYPE_LENGTH (128)
- `validateCurrencyPair()` -- extracts and validates `base_currency`, `base_issuer`, `quote_currency`, `quote_issuer` query params
- `walletFromSeed()` -- wraps `Wallet.fromSeed()` with error handling

### CORS
No explicit CORS configuration exists. The app relies on Next.js defaults (same-origin for browser clients). Since this is a full-stack app where the frontend calls its own API routes, cross-origin access is not a primary concern.

### Caching
- `POST /api/accounts/generate`: `Cache-Control: no-store`
- `GET /api/dex/orderbook`: `Cache-Control: s-maxage=3, stale-while-revalidate=6`
- All other endpoints: no explicit cache headers

### OpenAPI Spec
An `openapi.yaml` file at the repo root (OpenAPI 3.0.3) documents all endpoints with request/response schemas. It is described as "programmatically consumed" and must be kept in sync with route handler changes. It includes reusable schemas under `components/schemas/` for all request/response types.

## Middleware & Filters

### Proxy (`proxy.ts`)
The sole middleware layer. Executes on every request matching `/api/:path*`.

**Execution flow:**
1. Extract client IP from `x-forwarded-for` or `x-real-ip` headers (falls back to `"unknown"`)
2. Classify route into rate limit tier based on pathname and HTTP method
3. Check token bucket rate limiter keyed by `${ip}:${method}:${pathname}`
4. If rate limit exceeded: return 429 with `Retry-After` header, log rejection
5. If allowed: log request, pass through with `NextResponse.next()`

**Rate limit tiers:**
| Tier | Limit | Window | Applies To |
|------|-------|--------|------------|
| STRICT | 5 req | 60s | `POST /api/accounts/generate` only |
| MODERATE | 15 req | 60s | All other POST routes |
| RELAXED | 60 req | 60s | All GET routes |

**Rate limiter implementation** (`lib/rate-limit.ts`):
- Token-bucket algorithm with continuous refill
- In-memory `Map<string, TokenBucket>` -- not distributed across instances
- Auto-cleanup every 5 minutes removes buckets untouched for 10+ minutes
- Bucket key is per IP + method + pathname, so GET and POST limits are independent, and different paths have independent buckets

### Important: No `middleware.ts`
Next.js 16 uses `proxy.ts` instead. Having both files causes a build error.

## Gotchas

1. **Seed-address mismatch validation is inconsistent.** Routes under `/api/accounts/{address}/*` that accept a seed (`trustlines POST`, `rippling POST`) validate that the seed matches the URL address. But action routes like `/api/currencies/issue`, `/api/transfers`, `/api/dex/offers`, `/api/credentials/*`, `/api/domains/*` do not perform this check -- they derive the wallet from the seed and use whatever address results.

2. **The `generate` endpoint may set AccountSet flags.** When `body.isIssuer` is truthy, `POST /api/accounts/generate` submits a second transaction (AccountSet with `asfDefaultRipple`) before returning. This means the endpoint may return a 422 if the AccountSet fails even though the wallet was successfully funded.

3. **Mainnet support is orderbook-only.** The `getMainnetClient()` function in `app/api/dex/orderbook/route.ts` is a module-level singleton separate from `lib/xrpl/client.ts`. No other endpoint supports mainnet. Passing `network=mainnet` to other endpoints will silently fall back to testnet.

4. **Rate limit bucket keys include the full pathname.** This means `/api/accounts/ABC123/trustlines` and `/api/accounts/DEF456/trustlines` have independent rate limit buckets. A client could potentially multiply their effective rate limit by rotating through different addresses.

5. **Transaction responses wrap the full XRPL result.** Successful POST endpoints typically return `{ result: <full xrpl TxResponse.result> }`. Failed transactions return `{ error: string, code?: string, result?: <full xrpl result> }`. The `result` field in error responses is only present when `txFailureResponse()` is used with an error map.

6. **`lpTokenOut` and `lpTokenIn` fields exist in AMM request types but are never used.** The `DepositAmmRequest.lpTokenOut` and `WithdrawAmmRequest.lpTokenIn` fields are defined in `lib/xrpl/types.ts` but the corresponding route handlers never read or validate them. They are dead fields.

7. **The orderbook endpoint uses two different XRPL client strategies.** For permissioned DEX queries (when `domain` param is present), it uses raw `book_offers` commands. For open DEX queries, it uses the higher-level `client.getOrderbook()` method. This is because the xrpl.js `getOrderbook()` method does not support the `domain` parameter.

8. **Transfer endpoint has extensive tec-code-to-message mapping.** The `/api/transfers` route has its own `tecMessages` map (10 entries) that is not shared with other endpoints. AMM create/deposit/withdraw routes have their own similar maps. The generic `txFailureResponse()` accepts an optional error map parameter.

9. **Currency pair query params use underscores.** Parameters are `base_currency`, `base_issuer`, `quote_currency`, `quote_issuer` (snake_case), while JSON body fields use camelCase. This is a deliberate convention: query params use snake_case, body fields use camelCase.

10. **The `POST /api/accounts/{address}/rippling` endpoint performs multiple sequential transactions.** It first submits an AccountSet, then iterates over all trust lines with `no_ripple === true` and submits a TrustSet for each one. If any intermediate TrustSet fails, the endpoint returns immediately with that error, leaving partially-updated state.

## Cross-references

- Request/response type definitions: `docs/learnings/data-model.md` (full field listings, entity relationships)
- End-to-end workflow traces: `docs/learnings/processing-flows.md` (how API calls chain together)
- XRPL client and external service details: `docs/learnings/integrations.md` (WebSocket singleton, faucet paths)
- Rate limiting and configuration: `docs/learnings/config-ops.md` (proxy tiers, constants)

## Scan Limitations

1. **OpenAPI spec was not diffed against route handlers.** The `openapi.yaml` file is large (56KB) and was only sampled at the beginning. Discrepancies between the spec and actual handler behavior may exist.
2. **XRPL client singleton behavior** (`lib/xrpl/client.ts`) was not deeply examined. The scan notes it is referenced by all endpoints but does not detail its connection management or reconnection logic.
3. **Frontend API call patterns** (hooks in `lib/hooks/`) were not examined. The scan focused only on server-side API route handlers.
4. **Test scripts** (`scripts/`) were not read. They could reveal undocumented endpoint behaviors or parameters.
5. **The `lib/xrpl/order-book-levels.ts`, `lib/xrpl/midprice.ts`, and `lib/xrpl/aggregate-depth.ts` modules** that enrich the orderbook response were not read in detail. Their exact computation logic was not verified.
