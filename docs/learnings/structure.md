<!-- scan-metadata
agent: structure
commit: 14d3ca5
branch: claude/branch-off-web-session-ueID3
date: 2026-03-01
-->

# Structure

## Project Overview

XRPL Issued Currencies Manager is a Next.js 16 (App Router) full-stack application for managing issued currencies, credentials, permissioned domains, and DEX trading on the XRP Ledger. It is a single-package monorepo (no workspaces) using pnpm as the package manager and targeting Node 22. There is no database -- all state comes from the XRP Ledger, and wallet secrets stay client-side (only sent to API routes when transaction signing is needed). The app is deployed to Vercel at `xrpl-issued-currencies-manager.vercel.app`.

The codebase is organized into four main areas: `app/` (Next.js App Router pages and API route handlers), `lib/` (shared library code for XRPL interaction, hooks, types, and UI utilities), `scripts/` (bash test scripts and demo bootstrap utilities using curl + jq), and `e2e/` (Playwright browser tests). Documentation lives in `docs/claude-learnings/` as task-scoped reference material, and `examples/` holds generated state files from demo setup scripts.

## Key Findings

1. **`proxy.ts` replaces `middleware.ts`**: Next.js 16 uses a `proxy()` export from `proxy.ts` at the project root for request-level logic. Having both `proxy.ts` and `middleware.ts` causes a build error. All rate limiting and request logging is implemented here, scoped to `/api/:path*` via the `config.matcher`.

2. **Three-tier rate limiting**: The proxy applies three rate limit tiers -- STRICT (5/min for wallet generation), MODERATE (15/min for POST routes), and RELAXED (60/min for GET routes). Bucket keys combine IP + method + pathname, keeping GET and POST limits independent.

3. **No unit test framework for API routes**: API routes are tested exclusively through bash scripts (`scripts/test-*.sh`) that use curl + jq against a running dev server, plus Playwright E2E tests. Vitest exists but is only used for `lib/xrpl/` utility functions (3 test files: `amm-math.test.ts`, `estimate-fill.test.ts`, `estimate-fill-combined.test.ts`, `midprice.test.ts`).

4. **Claude Code skills via web-session branch**: The `.claude/commands/` directory contains ~50+ skill files synced from a separate dotfiles repo via the `sync-web-session.yml` workflow. A `guard-commands.yml` workflow prevents these files from being merged into `main`. Skills are only available on the `web-session` branch.

5. **State file pipeline for demo setup**: `setup-full-state.sh` generates a JSON state file with 5 funded wallets, trust lines, credentials, and a permissioned domain. `make-market.sh` consumes this file to place 3-level bid/ask ladder orders across 6 currency pairs. Both scripts auto-detect the latest state file in `examples/`.

6. **Devnet-only features**: The permissioned DEX (XLS-81) amendment is only enabled on devnet. `test-permissioned-dex.sh` hard-codes `NETWORK=devnet`. The RLUSD well-known issuer (`rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV`) only exists on testnet.

7. **Playwright E2E uses a shared global setup**: `global-setup.ts` bootstraps a full devnet state (generate wallets, add currency, receive tokens) and saves browser storage state to `.auth/wallet.json`. All 5 test projects (`setup-page`, `transact-page`, `trade-dex`, `trade-amm`, `compliance-page`) depend on this setup and reuse the saved storage state.

## Modules

### `app/` -- Next.js App Router (pages + API routes)

- **Location**: `app/`
- **Purpose**: Frontend pages and backend API route handlers
- **Entry point**: `app/layout.tsx` (root layout with `Providers` and `NavBar`)

**Pages** (4 routes):
- `/` (`app/page.tsx`) -- Client-side redirect to `/setup`
- `/setup` (`app/setup/page.tsx`) -- Wallet management, currency setup, trust lines. Components in `app/setup/components/` (8 files).
- `/transact` (`app/transact/page.tsx`) -- Transfer issued currencies. Components in `app/transact/components/` (1 file: `transfer-modal.tsx`).
- `/trade` (`app/trade/page.tsx`) -- DEX trading with order book, AMM pools. Components in `app/trade/components/` (13 files).
- `/compliance` (`app/compliance/page.tsx`) -- Credential and domain management. Components in `app/compliance/components/` (6 files).

**Shared UI components**: `app/components/` (8 files: `balance-display.tsx`, `empty-wallets.tsx`, `explorer-link.tsx`, `loading-screen.tsx`, `modal-shell.tsx`, `nav-bar.tsx`, `network-selector.tsx`, `providers.tsx`).

**API routes**: 27 route handlers across 5 resource groups (`accounts`, `currencies`, `transfers`, `credentials`, `domains`, `dex`, `amm`), plus `/api/ping`. All follow the App Router `route.ts` convention with named exports (`GET`, `POST`).

### `lib/xrpl/` -- XRPL Core Library

- **Location**: `lib/xrpl/`
- **Purpose**: XRPL client management, currency encoding, DEX utilities, AMM helpers
- **Key files**: 20 files total
- **Dependencies**: `xrpl` (v4.6.0), `bignumber.js`

Notable modules:
- `client.ts` -- Singleton XRPL WebSocket client (`getClient(network)`) that persists across requests
- `networks.ts` -- Network definitions (`NETWORKS`, `NetworkId`, `resolveNetwork()`, `DEFAULT_NETWORK`, `EXPLORER_URLS`)
- `types.ts` -- Request/response interfaces for all API operations
- `constants.ts` -- Ledger flags, limits, epoch helpers
- `currency.ts` -- Node-only currency encoding (`encodeXrplCurrency`, `toXrplAmount`, `fromXrplAmount`)
- `decode-currency-client.ts` -- Browser-safe hex-to-ASCII decoder (separate from Node-only `currency.ts`)
- `estimate-fill.ts` / `estimate-fill-combined.ts` -- Order book fill estimation with unit tests
- `amm-math.ts` -- AMM price/share calculations with unit tests
- `midprice.ts` -- Midprice calculation from order book with unit tests

### `lib/hooks/` -- React Hooks

- **Location**: `lib/hooks/`
- **Purpose**: Client-side state management, data fetching, API mutations
- **Key files**: 17 hooks

Core patterns:
- `use-app-state.tsx` -- Global `AppStateProvider` and `useAppState()` context
- `use-api-fetch.ts` -- Generic GET hook with `refreshKey` for cache invalidation
- `use-api-mutation.ts` -- Generic POST hook
- `use-local-storage.ts` -- localStorage sync with SSR hydration handling

Domain hooks: `use-balances.ts`, `use-trust-lines.ts`, `use-issuer-currencies.ts`, `use-account-credentials.ts`, `use-account-domains.ts`, `use-trading-data.ts`, `use-trust-line-validation.ts`, `use-domain-mode.ts`, `use-wallet-generation.ts`, `use-make-market-execution.ts`, `use-amm-pool.ts`, `use-offer-expiration-timers.ts`, `use-page-visible.ts`, `use-poll-interval.ts`

### `lib/` -- Shared Utilities

- `api.ts` -- Server-side validation helpers (`validateRequired`, `walletFromSeed`, `validateAddress`, `validateSeedMatchesAddress`, `validatePositiveAmount`, `validateCredentialType`, `validateCurrencyPair`, `getNetworkParam`, `getTransactionResult`, `txFailureResponse`, `apiErrorResponse`)
- `rate-limit.ts` -- In-memory token-bucket rate limiter consumed by `proxy.ts`
- `types.ts` -- Shared frontend types (`WalletInfo`, `PersistedState`, `NetworkData`, `TrustLine`, `BalanceEntry`, `OrderBookAmount`, `OrderBookEntry`, `CredentialInfo`, `DomainInfo`)
- `assets.ts` -- Well-known currencies and issuers per network (`Assets`, `WELL_KNOWN_CURRENCIES`)
- `ui/ui.ts` -- Tailwind class constants and UI timing constants

### `e2e/` -- Playwright End-to-End Tests

- **Location**: `e2e/`
- **Purpose**: Browser-based integration tests against devnet
- **Entry point**: `global-setup.ts` (bootstraps wallet state)
- **Files**: 7 files (1 setup, 5 specs, 1 helper)

Test projects run with dependencies on the global setup:
- `setup.spec.ts` -- Wallet generation, currency management, export/import, UI interactions (12 tests)
- `transact.spec.ts` -- Transfer modal, currency selection, trust line validation, send flow (8 tests)
- `trade-dex.spec.ts` -- Order placement, order book, cancellation, Make Market modal (10 tests)
- `trade-amm.spec.ts` -- AMM pool create, deposit, withdraw lifecycle (7 tests)
- `compliance.spec.ts` -- Credential issue/accept/delete, domain create/edit/delete (12 tests)

### `scripts/` -- Bash Test Scripts

- **Location**: `scripts/`
- **Purpose**: API endpoint testing and demo environment bootstrap
- **Shared library**: `lib.sh` (HTTP helpers, domain-specific helpers for accounts, trust lines, offers, credentials, domains)
- **Files**: 21 shell scripts + 1 README

## Build System

**Tool**: pnpm (v10.28.2, specified via `packageManager` field)

**Build commands**:
| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start Next.js dev server |
| `pnpm build` | Production build (verifies compilation) |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint (flat config, eslint-config-next + prettier) |
| `pnpm typecheck` | TypeScript type checking (`tsc --noEmit`) |
| `pnpm format:check` | Prettier format verification |
| `pnpm format:write` | Prettier auto-format |
| `pnpm test` | Vitest unit tests (lib/xrpl utilities only) |
| `pnpm e2e` | Playwright browser tests |

**TypeScript config**: Strict mode, `bundler` module resolution, path alias `@/*` mapping to project root. Target ES2017. Incremental compilation enabled.

**ESLint config**: Flat config (`eslint.config.mjs`) using `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript` + `eslint-config-prettier`.

**Prettier config**: Double quotes, semicolons, 2-space tabs, trailing commas. Ignores markdown files, lock files, and build output.

**PostCSS**: Tailwind v4 via `@tailwindcss/postcss` plugin.

**Tooling manager**: `mise.toml` specifies Node 22 + latest pnpm.

## Dependencies

**Runtime**:
- `next` (16.1.6) -- Framework (App Router)
- `react` / `react-dom` (19.2.4) -- UI library
- `xrpl` (^4.6.0) -- XRPL client library for WebSocket communication, wallet management, transaction signing
- `bignumber.js` (^9.3.1) -- Precise decimal arithmetic for financial calculations

**Development**:
- `@playwright/test` (^1.58.2) -- E2E browser testing
- `vitest` (^4.0.18) -- Unit testing (lib utilities)
- `tailwindcss` (^4) -- CSS framework
- `eslint` (^9) + `eslint-config-next` + `eslint-config-prettier` -- Linting
- `prettier` (^3.8.1) -- Code formatting
- `typescript` (^5) -- Type checking

## CI/CD Pipeline

Five GitHub Actions workflows:

### `ci.yml` -- Main CI Pipeline
- **Triggers**: Push to main, PRs to main (ignores `*.md` files)
- **Concurrency**: Cancels in-progress runs per branch
- **Jobs** (all depend on `install`):
  1. **Install** -- `pnpm install --frozen-lockfile`, caches `node_modules` keyed by `pnpm-lock.yaml` hash
  2. **Lint** -- `pnpm lint`
  3. **Type check** -- `pnpm typecheck`
  4. **Format check** -- `pnpm format:check`
  5. **Build** -- `pnpm build`, uploads build output as artifact
  6. **Bundle size** (PR-only, after build) -- Parses Next.js build output route table, posts/updates a PR comment with bundle sizes

### `e2e.yml` -- Playwright E2E Tests
- **Triggers**: Push to main, PRs to main (ignores `*.md` files)
- **Timeout**: 20 minutes
- **Browser**: Chromium only, cached by Playwright version
- **Workers**: 5 in CI, 2 locally
- **Artifacts**: Uploads playwright-report and test-results on failure

### `dependency-review.yml` -- Dependency Security Review
- **Triggers**: PRs to main
- **Action**: `actions/dependency-review-action@v4` with `fail-on-severity: high`

### `guard-commands.yml` -- Prevent Skills from Reaching Main
- **Triggers**: PRs to main
- **Purpose**: Fails if any files under `.claude/commands/` are included in the PR, with rebase instructions in the error message

### `sync-web-session.yml` -- Sync Skills to Web-Session Branch
- **Triggers**: Push to main, manual dispatch
- **Purpose**: Clones dotfiles repo, copies `.claude/commands/` + `.claude/web-skills/`, force-pushes to `web-session` branch

## Scripts & Utilities

| Script | Purpose |
|--------|---------|
| `scripts/test-all.sh` | Runs all 17 test scripts sequentially, reports pass/fail summary |
| `scripts/lib.sh` | Shared bash helpers: `parse_response`, `assert_status`, `api_get`, `api_post`, `generate_account`, `create_trustline`, `issue_currency`, `place_offer`, `create_credential`, `accept_credential`, `create_domain` |
| `scripts/setup-full-state.sh` | Bootstraps demo env: 5 wallets, trust lines, issued currencies, credentials, permissioned domain. Saves JSON state to `examples/` |
| `scripts/make-market.sh` | Places 3-level bid/ask ladder orders across 6 currency pairs. Reads state from `setup-full-state.sh` output. Supports `PERMISSIONED=true` for domain-scoped offers |
| `scripts/test-ping.sh` | Tests `/api/ping` health check |
| `scripts/test-generate-account.sh` | Tests wallet generation, saves account to `.test-account.json` for dependent scripts |
| `scripts/test-fund-account.sh` | Tests re-funding an existing account via faucet |
| `scripts/test-account-info.sh` | Tests account info retrieval (depends on `.test-account.json`) |
| `scripts/test-balances.sh` | Tests balance retrieval (depends on `.test-account.json`) |
| `scripts/test-trustlines.sh` | Tests GET + POST trust line operations |
| `scripts/test-transactions.sh` | Tests transaction history retrieval |
| `scripts/test-issue-currency.sh` | End-to-end: generate wallets, trust line, issue currency, verify balance |
| `scripts/test-transfer.sh` | End-to-end: issue currency to Alice, transfer to Bob, verify balances |
| `scripts/test-rippling.sh` | Tests DefaultRipple flag, NoRipple repair, and peer-to-peer transfer flow |
| `scripts/test-dex-offers.sh` | Tests offer placement, account offers query, order book query, and offer cancellation |
| `scripts/test-dex-trades.sh` | Tests crossing offers and recent trades query |
| `scripts/test-filled-orders.sh` | Tests filled order history for both sides of a trade |
| `scripts/test-amm.sh` | Full AMM lifecycle: create, query, two-asset deposit, single-asset deposit, single-asset withdraw, withdraw-all |
| `scripts/test-credentials.sh` | Full credential lifecycle: create, list (unaccepted), accept, list (accepted), delete, verify gone |
| `scripts/test-domains.sh` | Full domain lifecycle: create credential, create domain, list, delete, verify gone |
| `scripts/test-permissioned-dex.sh` | Full permissioned DEX flow on devnet: credential, domain, domain-scoped offer, filtered order book, cancellation |

## Gotchas

1. **Test script dependency chain**: `test-account-info.sh`, `test-balances.sh`, and `test-transactions.sh` depend on `test-generate-account.sh` having run first (reads `.test-account.json`). However, `test-all.sh` runs them in the correct order.

2. **`proxy.ts` not `middleware.ts`**: Next.js 16 uses a `proxy()` export for request-level logic. Accidentally creating a `middleware.ts` will cause a build error.

3. **Browser-safe vs Node-only modules**: `decode-currency-client.ts` exists as a browser-safe alternative to `currency.ts` (which uses Node-only Buffer). Similarly, `credentials.ts` is Node-only for hex encoding.

4. **XRPL client singleton**: The WebSocket client in `lib/xrpl/client.ts` persists across API requests at module scope. Do not disconnect after each request.

5. **Next.js 16 async params**: Dynamic route params (e.g., `[address]`) are `Promise<{...}>` and must be awaited before accessing values.

6. **Generated state files contain secrets**: `examples/setup-state-*.json` files contain wallet seeds. They are gitignored but not the example file `setup-state-testnet-2026-02-08.json` which is checked in.

7. **Security headers in `next.config.ts`**: CSP, X-Frame-Options (DENY), and X-Content-Type-Options (nosniff) are configured for all routes via Next.js `headers()`.

8. **`xrpl.dropsToXrp()` returns `number`**: Must wrap with `String()` when assigning to string-typed fields.

9. **E2E tests are serial within each project**: All spec files use `test.describe.serial()` because XRPL operations have ordering dependencies (wallet must exist before trust line, etc.).

10. **Playwright `fullyParallel: false` but 5 workers in CI**: The 5 test projects run in parallel (each on its own worker), but tests within each project run serially. The global setup creates shared state via `.auth/wallet.json`.

## Cross-references

- API endpoint details and request/response shapes: `docs/learnings/api-surface.md`
- Type definitions and entity relationships: `docs/learnings/data-model.md`
- CI/CD pipeline and deployment config: `docs/learnings/config-ops.md`
- Test infrastructure and patterns: `docs/learnings/testing.md`
- External service connections: `docs/learnings/integrations.md`

## Scan Limitations

1. **OpenAPI spec not read**: `openapi.yaml` (46KB) was not read in detail. It is documented as being programmatically consumed and must be kept in sync with API routes.

2. **Individual API route handler implementations not read**: The 27 `route.ts` files under `app/api/` were not read in detail -- their interfaces are well-documented in CLAUDE.md and tested by the bash scripts.

3. **Frontend component implementations not read**: The ~30 component files under `app/` subdirectories were not inspected for implementation details. Their architecture patterns are documented in `docs/claude-learnings/frontend-architecture.md` and `.claude/guidelines/component-architecture.md`.

4. **`docs/claude-learnings/` deep reference docs not read**: The 10+ learning documents and AMM subdirectory contain task-specific research. Only `README.md` (the index) was read.

5. **`docs/plans/` not read**: Contains `orders-sheet.md` and `trade-ui-improvements.md` planning documents.
