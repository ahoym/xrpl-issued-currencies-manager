<!-- scan-metadata
agent: config-ops
commit: 14d3ca5
branch: claude/branch-off-web-session-ueID3
date: 2026-03-01
-->

# Configuration & Operations

## Overview

This is a zero-environment-variable, zero-database Next.js 16 application. All runtime state comes from the XRP Ledger itself, and there are no `.env` files, no secrets in config, and no server-side environment variables consumed by application code. The only `process.env` usage is `CI` in the Playwright config. Configuration is entirely code-based: network URLs are hardcoded constants, rate limits are literal values in `proxy.ts`, and API defaults live in `lib/xrpl/constants.ts`. Deployment is on Vercel with no `vercel.json` — it relies entirely on Next.js framework detection.

## Key Findings

1. **No environment variables at all** -- The application has zero `.env` files, no `.env.example`, and `process.env` is only referenced in `playwright.config.ts` for `CI`. All configuration that would typically be env-driven (network URLs, faucet endpoints, rate limits) is hardcoded in source files.

2. **Wallet seeds transit the network on every mutation** -- The architecture sends wallet seeds from the browser to API routes for transaction signing. This is by design (documented in CLAUDE.md), but means the `proxy.ts` rate limiter and CSP headers are the primary protection against abuse.

3. **Rate limiter is in-memory and per-instance** -- `lib/rate-limit.ts` uses a `Map` for token-bucket state. On Vercel's Edge Runtime, this persists within a single regional isolate but is not distributed. A determined attacker could bypass rate limits by hitting different regions.

4. **The XRPL client singleton can silently switch networks mid-request** -- `lib/xrpl/client.ts` maintains one global WebSocket client. If two concurrent requests target different networks (testnet vs devnet), the second will disconnect the first's client and reconnect to the other network, potentially causing the first request to fail.

5. **`proxy.ts` replaces `middleware.ts`** -- Next.js 16 uses a `proxy()` export instead of the traditional `middleware()` export. Having both files causes a build error. All request-level logic (rate limiting, logging) goes through `proxy.ts`.

6. **No production network support** -- `lib/xrpl/networks.ts` only defines `testnet` and `devnet`. There is no mainnet configuration, making this intentionally a testnet/devnet-only tool.

7. **Dependabot groups minor+patch updates** -- `.github/dependabot.yml` groups all minor and patch npm updates into a single PR per week, reducing PR noise while maintaining weekly currency on both npm packages and GitHub Actions.

## Configuration Hierarchy

Configuration is flat and code-only. There is no layered config system or environment-based overrides:

1. **Hardcoded constants** (`lib/xrpl/constants.ts`) -- API limits, validation bounds, ledger flags, epoch offsets
2. **Hardcoded network config** (`lib/xrpl/networks.ts`) -- WebSocket URLs, faucet URLs, default network
3. **Hardcoded rate limits** (`proxy.ts`) -- Three tiers: STRICT (5/min), MODERATE (15/min), RELAXED (60/min)
4. **Hardcoded well-known currencies** (`lib/assets.ts`) -- RLUSD issuer address on testnet
5. **Framework config files** -- `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, etc.

The `network` query parameter is the only runtime "config switch" -- every API request can specify `?network=testnet` or `?network=devnet`, defaulting to `testnet`.

## Environment Profiles

| Profile | Purpose | Key Differences |
|---------|---------|-----------------|
| testnet | Default network; primary development target | Has RLUSD issuer (`rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV`), supports all standard features |
| devnet | Experimental features testing | No RLUSD issuer, PermissionedDEX amendment enabled (not on testnet), E2E tests run against devnet |

Network selection is per-request via `?network=` query param, not per-deployment.

## Key Configuration Properties

### Security Headers (`next.config.ts`)

Applied to all routes (`/:path*`):
- `X-Frame-Options: DENY` -- prevents clickjacking
- `X-Content-Type-Options: nosniff` -- prevents MIME sniffing
- `Content-Security-Policy` -- restricts script/style/connect sources to `'self'` (with `'unsafe-inline'` for scripts and styles), `frame-ancestors 'none'`

### Rate Limiting (`proxy.ts`)

| Tier | Routes | Limit |
|------|--------|-------|
| STRICT | `POST /api/accounts/generate` | 5 req/min |
| MODERATE | All other POST routes | 15 req/min |
| RELAXED | All GET routes | 60 req/min |

Bucket key format: `{IP}:{method}:{pathname}` -- GET and POST limits are independent per path. IP extraction checks `x-forwarded-for` then `x-real-ip`, falling back to `"unknown"`.

### API Defaults (`lib/xrpl/constants.ts`)

| Constant | Value | Used By |
|----------|-------|---------|
| `DEFAULT_TRUST_LINE_LIMIT` | `"1000000"` | Trust line creation |
| `DEFAULT_ORDERBOOK_LIMIT` | `20` | Orderbook/trades endpoints |
| `DEFAULT_ACCOUNT_OFFERS_LIMIT` | `200` | Account offers endpoint |
| `DEFAULT_TRANSACTION_LIMIT` | `20` | Transaction history |
| `MAX_API_LIMIT` | `400` | Upper bound on user-supplied `limit` |
| `TRADES_FETCH_MULTIPLIER` | `5` | Over-fetch ratio for trade filtering |
| `AMM_DEFAULT_TRADING_FEE` | `300` | 0.3% default for AMM pools |
| `AMM_MAX_TRADING_FEE` | `1000` | 1% cap on AMM fees |
| `MAX_DOMAIN_CREDENTIALS` | `10` | Max credentials per domain |
| `MAX_CREDENTIAL_TYPE_LENGTH` | `128` | Credential type string cap |

### TypeScript (`tsconfig.json`)

- `strict: true` enabled
- Target: `ES2017`
- Module resolution: `bundler` (Next.js convention)
- Path alias: `@/*` maps to project root

### Linting (`eslint.config.mjs`)

Uses ESLint flat config with three configs chained: `eslint-config-next/core-web-vitals`, `eslint-config-next/typescript`, and `eslint-config-prettier` (to disable style rules that conflict with Prettier).

### Formatting (`.prettierrc`)

Semicolons, double quotes, 2-space tabs, trailing commas. Markdown files are excluded from formatting (`.prettierignore`).

### Tailwind v4 (`postcss.config.mjs`, `app/globals.css`)

Uses `@tailwindcss/postcss` plugin (v4 approach). Theme is CSS-based via `@theme inline` in `globals.css` rather than a `tailwind.config.js` file. Dark mode uses `prefers-color-scheme` media query.

### Node Version (`.node-version`, `mise.toml`)

Both pin Node 22. `mise.toml` also specifies `pnpm = "latest"`. `package.json` pins `packageManager: pnpm@10.28.2` via Corepack.

## Monitoring & Metrics

### Health Check

`GET /api/ping` returns `{ "status": "ok" }`. This is a shallow check -- it does not verify XRPL WebSocket connectivity. The `test-ping.sh` script validates this endpoint.

### Logging

Logging is minimal console-based output in `proxy.ts`:
- Every API request logs: `{ISO timestamp} {method} {pathname} {duration}ms`
- Rate-limited requests additionally log with `429` status

`lib/xrpl/client.ts` logs `console.warn` on reconnection and disconnection failures. `lib/xrpl/networks.ts` logs `console.warn` on unknown network fallback.

There is no structured logging library, no log levels, no request IDs, and no error tracking service integration.

### No Metrics or Alerting

There is no application-level metrics collection (no Prometheus, no Datadog, etc.), no error reporting service (no Sentry), and no uptime monitoring beyond the `/api/ping` endpoint.

## Deployment

### Vercel

The app deploys to Vercel with zero configuration -- no `vercel.json` exists. Vercel auto-detects Next.js and uses the framework's build system. The `.gitignore` includes `.vercel/` suggesting the Vercel CLI has been used locally.

The scripts README references the deployment URL: `https://xrpl-issued-currencies-manager.vercel.app`.

### CI/CD Pipeline (`.github/workflows/`)

**`ci.yml`** -- Runs on push to `main` and PRs to `main` (skips `*.md` changes):
1. `install` -- `pnpm install --frozen-lockfile`, caches `node_modules`
2. `lint` -- `pnpm lint` (parallel with typecheck, format-check, build)
3. `typecheck` -- `pnpm typecheck` (`tsc --noEmit`)
4. `format-check` -- `pnpm format:check`
5. `build` -- `pnpm build`, uploads build output as artifact (5-day retention)
6. `bundle-size` -- PR-only; parses Next.js build output and posts/updates a comment with route sizes

**`e2e.yml`** -- Same triggers as `ci.yml`:
- Runs Playwright E2E tests against devnet
- Caches Playwright browsers by version
- Uploads `playwright-report/` and `test-results/` on failure (7-day retention)
- 20-minute timeout (devnet faucet calls can be slow)

**`dependency-review.yml`** -- PR-only:
- Uses `actions/dependency-review-action` to fail on `high` severity vulnerabilities

**`guard-commands.yml`** -- PR-only:
- Blocks `.claude/commands/` from being merged to `main` (these belong on the `web-session` branch)

**`sync-web-session.yml`** -- On push to `main` or manual dispatch:
- Force-pushes `web-session` branch as `main` + one commit with `.claude/commands/` from external dotfiles repo

All CI jobs use `ubuntu-latest` runners, `.node-version` for Node selection, and `pnpm/action-setup@v4`.

### Concurrency Control

Both `ci.yml` and `e2e.yml` use `cancel-in-progress: true` concurrency groups keyed by `${{ github.ref }}`, so pushing to a branch cancels in-flight CI for the same branch.

## Operational Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/test-all.sh` | Run all 17 API test scripts sequentially | `scripts/test-all.sh` or `BASE_URL=https://... scripts/test-all.sh` |
| `scripts/setup-full-state.sh` | Bootstrap 5 wallets, trust lines, currencies, credentials, and a domain | `NETWORK=devnet scripts/setup-full-state.sh` (or interactive prompt) |
| `scripts/make-market.sh` | Place 3-level bid/ask ladder orders across 6 currency pairs | `scripts/make-market.sh [state-file.json]` or `PERMISSIONED=true scripts/make-market.sh` |
| `scripts/lib.sh` | Shared helpers: `api_get`, `api_post`, `generate_account`, `create_trustline`, `issue_currency`, `place_offer`, `create_credential`, `accept_credential`, `create_domain` | Sourced by other scripts |
| `scripts/test-ping.sh` | Health check test | Standalone or via `test-all.sh` |
| `scripts/test-permissioned-dex.sh` | Full permissioned DEX flow test | Always runs against devnet regardless of `NETWORK` env var |

All scripts accept `BASE_URL` (default `http://localhost:3000`) and `NETWORK` (default `testnet`) via environment variables. They require `curl` and `jq` as system dependencies.

`setup-full-state.sh` outputs state JSON to `examples/setup-state-{network}-{date}.json`. These files are gitignored because they contain wallet seeds. `make-market.sh` auto-detects the latest state file in `examples/`.

## Testing Architecture

| Layer | Tool | Location | Trigger |
|-------|------|----------|---------|
| Unit tests | Vitest | `lib/xrpl/*.test.ts` (4 files) | `pnpm test` |
| API integration tests | Bash + curl + jq | `scripts/test-*.sh` (17 scripts) | `scripts/test-all.sh` (manual) |
| E2E tests | Playwright | `e2e/*.spec.ts` (5 spec files) | `pnpm e2e` / CI on every push |

Playwright configuration (`playwright.config.ts`):
- Tests run sequentially (`fullyParallel: false`) with 1 retry
- 90-second test timeout, 20-second assertion timeout
- `global-setup.ts` bootstraps devnet state (generates wallets, issues TCOIN) and saves browser storage to `.auth/wallet.json`
- All page specs depend on the `setup` project and reuse the stored auth state
- CI uses 5 workers; local uses 2
- Traces captured on first retry; screenshots on failure only
- Dev server started automatically (`pnpm dev`) and reused if already running locally

## Local Development Setup

Requirements:
- Node 22 (enforced by `.node-version` and `mise.toml`)
- pnpm (version 10.28.2 via Corepack, or latest via mise)
- `curl` and `jq` for running test scripts

Steps:
1. `pnpm install`
2. `pnpm dev` -- starts Next.js dev server on `http://localhost:3000`
3. No environment variables needed -- the app works with zero configuration

No database, no Docker, no external services beyond the public XRPL testnet/devnet nodes.

## Gotchas

- **No `.env.example` exists** -- Because no environment variables are used, there is no template. Developers expecting to configure the app via env vars will find nothing to configure.

- **`test-permissioned-dex.sh` overrides `NETWORK`** -- This script hardcodes `NETWORK="devnet"` on line 6, ignoring any env var. The PermissionedDEX amendment only exists on devnet.

- **`setup-full-state.sh` creates trust lines with swapped args** -- The `create_trustline` helper in this script takes `(seed, address, currency, issuer)` but the `lib.sh` version takes `(seed, issuer, currency, limit, network, address)`. The script uses its own internal helper, not `lib.sh`'s version.

- **CSP allows `'unsafe-inline'` for scripts** -- The Content Security Policy in `next.config.ts` permits inline scripts, which weakens XSS protection. This is likely required for Next.js hydration scripts.

- **State files contain wallet seeds in plaintext** -- `examples/setup-state-*.json` files are gitignored but written to the filesystem by `setup-full-state.sh`. These contain seeds that can control testnet/devnet funds.

- **Rate limiter cleanup uses wall-clock time** -- The token-bucket cleanup in `lib/rate-limit.ts` evicts entries older than 10 minutes, checked every 5 minutes. On serverless cold starts, the entire bucket map is empty, effectively resetting all rate limits.

- **XRPL client is a global singleton across all API routes** -- A single WebSocket connection is shared. If a request to a different network arrives while another is in-flight, the first request's connection may be disrupted.

- **Bundle size reporting is best-effort** -- The `bundle-size` CI job uses `continue-on-error: true`, so parsing failures won't block the PR.

- **No unit test CI job** -- The `ci.yml` workflow runs lint, typecheck, format-check, and build, but does not run `pnpm test` (Vitest unit tests). Unit tests are only run manually or via Playwright setup (which is in a separate `e2e.yml` workflow).

## Cross-references

- API endpoint details: `docs/learnings/api-surface.md` (rate limiting per-endpoint, caching headers)
- Test patterns and CI gaps: `docs/learnings/testing.md` (what runs in CI vs manually)
- Project structure and build system: `docs/learnings/structure.md` (module layout, dependency tree)
- External service configuration: `docs/learnings/integrations.md` (hardcoded network URLs, faucet endpoints)

## Scan Limitations

- **Vercel project settings not visible** -- Vercel configuration beyond what's in the repo (environment variables, domain settings, build settings, serverless function regions) is managed in the Vercel dashboard and not captured here.
- **OpenAPI spec not fully analyzed** -- `openapi.yaml` was confirmed to exist and covers the API surface but was not read in full for schema-level details.
- **E2E spec content not read** -- Individual `e2e/*.spec.ts` files were not read beyond `global-setup.ts`; only the Playwright config and project structure were analyzed.
- **Individual test scripts not all read** -- Only `test-ping.sh`, `test-permissioned-dex.sh`, and `test-all.sh` were read in full. Other `test-*.sh` scripts follow the same `lib.sh` pattern but may have unique edge-case testing.
- **No access to Vercel deployment logs or runtime metrics** -- Cannot verify actual deployment behavior, cold start frequency, or regional distribution.
