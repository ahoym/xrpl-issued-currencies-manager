# CLAUDE.md — XRPL Issued Currencies Manager

## Project Overview

Next.js 16 app for managing XRPL issued currencies. No database — all state comes from the XRP Ledger. Wallet secrets stay client-side and are only sent to API routes when signing is needed.

**Stack**: Next.js 16.1.6, React 19, TypeScript 5, Tailwind v4, pnpm, xrpl v4.5.0

## Commands

- `pnpm dev` — start dev server
- `pnpm build` — production build (use to verify compilation)
- `pnpm lint` — run ESLint
- `scripts/test-all.sh` — run all API test scripts against a running dev server
- Individual test scripts accept `BASE_URL` env var (defaults to `http://localhost:3000`)

## Architecture

- **API routes**: `app/api/` — Next.js App Router route handlers
- **Shared lib**: `lib/xrpl/` — client singleton (`client.ts`), network config (`networks.ts`), TypeScript types (`types.ts`)
- **Test scripts**: `scripts/` — bash scripts using curl + jq for each endpoint
- **OpenAPI spec**: `openapi.yaml` at project root

### API Routes

| Route | Methods | Purpose |
|---|---|---|
| `/api/accounts/generate` | POST | Generate & fund wallet via faucet |
| `/api/accounts/[address]` | GET | Account info from ledger |
| `/api/accounts/[address]/balances` | GET | XRP + issued currency balances |
| `/api/accounts/[address]/trustlines` | GET, POST | View/create trust lines |
| `/api/accounts/[address]/transactions` | GET | Transaction history |
| `/api/accounts/[address]/offers` | GET | List account's open DEX offers |
| `/api/currencies/issue` | POST | Issue currency (Payment from issuer) |
| `/api/transfers` | POST | Transfer issued currency |
| `/api/dex/offers` | POST | Place a DEX offer (OfferCreate) |
| `/api/dex/offers/cancel` | POST | Cancel a DEX offer (OfferCancel) |
| `/api/dex/orderbook` | GET | View order book for a currency pair |

## Conventions

### API Route Pattern

Every route handler follows this structure:

1. Parse request params/body
2. Call `getClient(resolveNetwork(network))` to get a connected XRPL client (reuses singleton)
3. Perform XRPL operation(s) inside `try/catch`
4. Return `Response.json(...)` with appropriate status codes (201 for creates, 200 for reads)
5. On error, return `{ error: message }` with status 400 (validation) or 500 (server)

### Test Script Pattern

Each test script in `scripts/`:
- Uses `curl -s -w "\n%{http_code}"` to capture both body and status code
- Parses with `jq`
- Prints clear PASS/FAIL output
- Exits non-zero on failure
- Accepts `BASE_URL` env var
- Scripts that need prior state read from `scripts/.test-account.json`

## Gotchas

- **`xrpl.dropsToXrp()` returns `number`**, not `string` — always wrap with `String()` when assigning to string-typed fields
- **Next.js 16 dynamic route params are `Promise<{...}>`** — must `await params` before accessing values
- **pnpm lockfile warning** about workspace root is cosmetic — parent directory has a `package-lock.json`; safe to ignore
- **XRPL client singleton** — don't disconnect after each request; the module-level client in `lib/xrpl/client.ts` persists across requests for reuse
- **Trust line prerequisite** — before issuing currency, the recipient must have a trust line to the issuer for that currency (validated server-side in `/api/currencies/issue`)
