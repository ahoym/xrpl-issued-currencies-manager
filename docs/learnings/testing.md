<!-- scan-metadata
agent: testing
commit: 14d3ca5
branch: claude/branch-off-web-session-ueID3
date: 2026-03-01
-->

# Testing

## Overview

The project uses a three-tier testing strategy: **unit tests** (Vitest) for pure computation logic, **bash API scripts** (curl + jq) for integration testing of every API route against a live XRPL testnet/devnet, and **Playwright E2E tests** for full browser-based UI flows. The bash scripts are the most mature layer, covering all 20+ API routes with multi-step scenario orchestration that provisions wallets, trust lines, and currencies from scratch per test run. Unit tests are limited to 4 files covering DEX/AMM math functions. There is no mocking framework and no database fixtures -- all state comes from the live XRP Ledger, which means tests require network connectivity and funded wallets from the XRPL faucet.

## Key Findings

1. **Unit tests (`pnpm test`) are not run in CI.** The CI workflow (`ci.yml`) runs lint, typecheck, format:check, and build -- but never `pnpm test`. Vitest tests only run locally. This is a coverage gap.

2. **Bash test scripts are the primary API integration test suite.** 17 individual test scripts are orchestrated by `test-all.sh`, each self-provisioning all required XRPL state (wallets, trust lines, currency issuance) from scratch. They share a helper library (`scripts/lib.sh`) with reusable HTTP assertion helpers.

3. **Playwright E2E tests use a project-dependency model for state bootstrapping.** A `global-setup.ts` "setup" project generates wallets on devnet, creates trust lines, issues currency, and saves browser `storageState` to `.auth/wallet.json`. All 5 spec projects (`setup-page`, `transact-page`, `trade-dex`, `trade-amm`, `compliance-page`) depend on this setup project and reuse its state.

4. **E2E tests are NOT parallelized across specs** (`fullyParallel: false`), and each spec file uses `test.describe.serial()` -- tests within a file run sequentially and share state via `let` variables in closure scope. This is intentional because tests build on each other (e.g., placing an order before cancelling it).

5. **Test data is ephemeral and network-dependent.** Bash scripts generate fresh wallets from the XRPL faucet per run. E2E tests generate wallets on devnet. The `setup-full-state.sh` script creates persistent state files in `examples/` that `make-market.sh` and `test-amm.sh` consume. State files contain wallet seeds and are gitignored.

6. **Some bash test scripts have ordering dependencies.** `test-account-info.sh`, `test-balances.sh`, `test-transactions.sh`, and `test-trustlines.sh` read from `.test-account.json` written by `test-generate-account.sh`. The `test-all.sh` runner executes them in the correct order.

7. **The `test-permissioned-dex.sh` script hard-codes `NETWORK="devnet"`** because the PermissionedDEX amendment is only enabled on devnet. All other bash scripts default to testnet.

## Test Types

| Type | ~Count | Location Pattern | Run Command |
|------|--------|------------------|-------------|
| Unit (Vitest) | 4 files, ~80 test cases | `lib/xrpl/*.test.ts` | `pnpm test` |
| API integration (bash) | 17 scripts | `scripts/test-*.sh` | `scripts/test-all.sh` |
| E2E (Playwright) | 5 spec files + 1 setup, ~50 test cases | `e2e/*.spec.ts`, `e2e/global-setup.ts` | `pnpm e2e` |
| Setup/utility scripts | 2 scripts | `scripts/setup-full-state.sh`, `scripts/make-market.sh` | Manual |

## Test Frameworks

- **Vitest 4.x** -- Unit test runner. Configured in `vitest.config.ts` with `@` path alias to project root. Explicitly excludes `e2e/**` from its test discovery.
- **Playwright** -- E2E browser testing. Uses Chromium only in CI. Configured with 90s test timeout, 20s expect timeout, 1 retry, trace-on-first-retry, screenshot-only-on-failure.
- **Bash + curl + jq** -- Custom API integration testing framework. No external test runner; each script exits non-zero on failure, and `test-all.sh` aggregates pass/fail counts.
- **BigNumber.js** -- Used extensively in unit tests for precise decimal arithmetic assertions (AMM math, order fill estimation).

## Test Utilities & Base Classes

### `scripts/lib.sh`
- **Location:** `scripts/lib.sh`
- **Purpose:** Shared test helpers for all bash API test scripts
- **Provides:**
  - `parse_response()` -- Splits curl response into `$BODY` and `$HTTP_CODE`
  - `assert_status()` -- Asserts HTTP status code, prints PASS/FAIL, exits on failure
  - `api_get()` / `api_post()` -- Generic HTTP helpers with status assertion (defaults: GET expects 200, POST expects 201)
  - `generate_account()` -- Generates and funds a test wallet via the faucet API
  - `create_trustline()` -- Creates a trust line between two accounts
  - `issue_currency()` -- Issues currency from an issuer to a recipient
  - `place_offer()` -- Places a DEX offer with optional `domainID` for permissioned DEX
  - `create_credential()` / `accept_credential()` -- Credential lifecycle helpers
  - `create_domain()` -- Creates a permissioned domain
- **Used by:** All 17 `test-*.sh` scripts source this file

### `e2e/helpers/wait-for-xrpl.ts`
- **Location:** `e2e/helpers/wait-for-xrpl.ts`
- **Purpose:** Playwright helpers for waiting on XRPL-dependent UI state
- **Provides:**
  - `waitForWalletGenerated(page, nth, timeout)` -- Waits for an XRPL address link (`r[a-zA-Z0-9]{24,}`) to appear at the nth position
  - `waitForXrpBalance(page, timeout)` -- Waits for XRP balance text to appear (confirms faucet funding)
  - `assertSuccessMessage(page, text, timeout)` -- Asserts a success banner is visible (handles auto-clearing banners)
- **Used by:** `global-setup.ts`, `transact.spec.ts`, `trade-dex.spec.ts`, `compliance.spec.ts`

### `e2e/global-setup.ts`
- **Location:** `e2e/global-setup.ts`
- **Purpose:** Playwright setup project that bootstraps all E2E test state
- **Provides:** Creates `.auth/wallet.json` containing browser storageState with:
  - An issuer wallet (with rippling enabled) on devnet
  - A "TCOIN" currency
  - A recipient wallet with a TCOIN trust line and 1,000 TCOIN issued
- **Used by:** All 5 E2E spec projects depend on the "setup" project

### Unit test helper factories
- Each unit test file defines local helper factories (not shared):
  - `amm-math.test.ts`: `makePool()`, `makeParams()` -- create `AmmPoolInfo` and `AmmPoolParams` objects
  - `estimate-fill.test.ts` / `estimate-fill-combined.test.ts` / `midprice.test.ts`: `level()` -- creates `PricedLevel` objects with BigNumber fields
  - `estimate-fill-combined.test.ts`: `makeAmm()` -- creates `AmmPoolParams`

## Test Data Management

### Ephemeral wallet generation
All test scripts (bash and E2E) generate fresh wallets from the XRPL faucet at runtime. No pre-seeded test data exists. This means:
- Tests require a running dev server (`pnpm dev`)
- Tests require network connectivity to XRPL testnet/devnet faucets
- Test execution time is dominated by faucet requests and ledger transaction settlement

### State file chain (bash scripts)
1. `test-generate-account.sh` writes `.test-account.json` (gitignored implicitly by being a dot-file in `scripts/`)
2. `test-account-info.sh`, `test-balances.sh`, `test-transactions.sh`, `test-trustlines.sh` read from this file
3. Other test scripts (e.g., `test-issue-currency.sh`, `test-transfer.sh`) are self-contained and generate all state internally

### Setup state files (demo bootstrapping)
1. `setup-full-state.sh` generates 5 wallets, trust lines, currencies, credentials, and a permissioned domain, saving everything to `examples/setup-state-<network>-<date>.json`
2. `make-market.sh` reads the latest state file and places 3-level bid/ask ladders across 6 currency pairs
3. `test-amm.sh` also reads state files for its AMM lifecycle test
4. State files contain wallet seeds and are gitignored via `examples/setup-state-*.json`

### Browser storage state (E2E)
- `global-setup.ts` saves browser localStorage to `.auth/wallet.json`
- All E2E spec projects load this state via Playwright's `storageState` option
- `.auth/` is gitignored

## Test Patterns & Conventions

### Bash API scripts
- **Naming:** `test-<feature>.sh` with clear step-by-step structure (`--- Step N: Description ---`)
- **Assertion style:** Manual string comparison with `if/then/else/exit 1`; `assert_status` for HTTP codes
- **Setup:** Each complex test script provisions its own wallets, trust lines, and currencies from scratch (no shared fixtures)
- **Output:** PASS/FAIL messages printed to stdout, non-zero exit on failure
- **Environment variables:** `BASE_URL` (default: `http://localhost:3000`), `NETWORK` (default: `testnet`)

### Playwright E2E specs
- **Naming:** `<page-name>.spec.ts` (e.g., `setup.spec.ts`, `transact.spec.ts`, `trade-dex.spec.ts`)
- **Organization:** One `test.describe.serial()` block per file with shared `BrowserContext` via `beforeAll`/`afterAll`
- **Selectors:** Primarily role-based (`getByRole`, `getByText`, `getByPlaceholder`, `getByLabel`); regex patterns for XRPL addresses (`/^r[a-zA-Z0-9]{24,}/`)
- **Timeouts:** Individual tests that perform ledger transactions use `test.setTimeout(60_000)` to `test.setTimeout(180_000)`; several use long expect timeouts (15-45s)
- **Conditional skipping:** `trade-amm.spec.ts` uses try/catch with `test.skip(true, reason)` to skip tests when the AMM pool doesn't exist or already exists
- **Local helper functions:** `selectTcoinXrpPair()` and `tradeFormLocator()` are defined within spec files, not shared

### Vitest unit tests
- **Naming:** Co-located with source (`lib/xrpl/<module>.test.ts` next to `lib/xrpl/<module>.ts`)
- **Style:** `describe`/`it` blocks with `expect` assertions from Vitest
- **Focus:** Pure computational functions (AMM math, order fill estimation, midprice calculation) -- no I/O, no mocking
- **Precision:** Heavy use of `BigNumber` with explicit `.toFixed(N)` comparisons to verify decimal precision

## CI/CD Test Pipeline

### `ci.yml` -- Main CI pipeline
- **Trigger:** Push to `main` or PRs targeting `main` (ignores `**/*.md`)
- **Concurrency:** Cancel-in-progress per ref
- **Jobs (all parallel after `install`):**
  1. `install` -- pnpm install + cache node_modules
  2. `lint` -- `pnpm lint` (ESLint)
  3. `typecheck` -- `pnpm typecheck` (tsc --noEmit)
  4. `format-check` -- `pnpm format:check` (Prettier)
  5. `build` -- `pnpm build` (captures output to artifact)
  6. `bundle-size` -- PR-only; parses Next.js build output and posts a bundle size comment
- **Notable absence:** No `pnpm test` (vitest) step

### `e2e.yml` -- E2E pipeline
- **Trigger:** Push to `main` or PRs targeting `main` (ignores `**/*.md`)
- **Concurrency:** Cancel-in-progress per ref
- **Single job:** `Playwright E2E (devnet)`
  - Installs pnpm, Node.js, caches Playwright browsers
  - Runs `pnpm e2e` (which starts dev server via Playwright's `webServer` config)
  - Uploads `playwright-report/` and `test-results/` as artifacts on failure
  - 20-minute timeout
  - Uses 5 workers in CI (`process.env.CI ? 5 : 2`)

### Other workflows
- `dependency-review.yml` -- PR-only dependency vulnerability review (fail on `high` severity)
- `guard-commands.yml` -- Blocks `.claude/commands/` files from merging into main
- `sync-web-session.yml` -- Not test-related

### What is NOT in CI
- Vitest unit tests (`pnpm test`)
- Bash API integration tests (`scripts/test-all.sh`)
- The `setup-full-state.sh` / `make-market.sh` demo scripts

## Gotchas

1. **Bash test script ordering matters.** `test-all.sh` runs scripts in a specific order because some (`test-account-info.sh`, `test-balances.sh`, etc.) depend on `.test-account.json` written by `test-generate-account.sh`. Running individual scripts out of order will fail with "Run test-generate-account.sh first."

2. **E2E global setup has a 5-minute timeout** (`setup.setTimeout(300_000)`) because it must wait for faucet wallet generation, trust line creation, and currency issuance on devnet -- all real ledger transactions.

3. **`test-amm.sh` requires a pre-existing state file** from `setup-full-state.sh`. Unlike other bash test scripts, it does not self-provision wallets. Set `STATE_FILE` env var or run `setup-full-state.sh` first.

4. **E2E tests in CI use 5 workers** but each spec file's tests run serially within the file (`test.describe.serial`). The 5 workers allow spec files themselves to run in parallel.

5. **Success banners auto-clear after 2 seconds** (`SUCCESS_MESSAGE_DURATION_MS`). The `assertSuccessMessage` helper and inline assertions must catch the banner before it disappears. This is noted in comments throughout E2E specs.

6. **Unit test helper factories are duplicated** across test files (e.g., `level()` appears in 3 separate test files). There is no shared test utility module for unit tests.

7. **`setup-full-state.sh` re-defines its own helpers** (`create_trustline`, `issue_currency`, etc.) rather than sourcing `lib.sh`. The two implementations are similar but not identical -- `lib.sh` helpers use `parse_response`/`assert_status`, while `setup-full-state.sh` helpers parse HTTP codes inline.

8. **`api_post` defaults to expecting HTTP 201**, not 200. Tests that expect 200 (like the rippling endpoint) must pass the expected status explicitly: `api_post "/path" "$json" 200`.

## Cross-references

- API routes tested by bash scripts: `docs/learnings/api-surface.md` (endpoint definitions, validation rules)
- CI/CD pipeline configuration: `docs/learnings/config-ops.md` (workflow details, concurrency)
- Project structure and module layout: `docs/learnings/structure.md` (where tests live relative to source)
- Test coverage gap analysis: `docs/learnings/SYSTEM_OVERVIEW.md` § Test Coverage Gaps

## Scan Limitations

- Did not execute any tests to verify they pass; findings are based on code reading only.
- Did not check for Vitest coverage configuration or thresholds (none found).
- The `examples/setup-state-testnet-2026-02-08.json` state file was not read to avoid exposing wallet seeds.
- Pre-commit hooks or husky configuration were not investigated (not in scope for testing infrastructure).
