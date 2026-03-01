<!-- scan-metadata
commit: c6edc8f
branch: claude/branch-off-web-session-ueID3
date: 2026-03-01
-->

# Documentation Inconsistencies

Comparison of existing documentation (CLAUDE.md, README.md) against what the codebase scan actually found.

## Doc-vs-Code Inconsistencies

### Critical — Actively misleading

#### 1. xrpl package version [FIXED]
- **Doc source:** CLAUDE.md (line 1, "**Stack**" section) and README.md (line 8)
- **What it claims:** `xrpl v4.5.0` / `xrpl.js v4.5.0`
- **What the code actually does:** `package.json` specifies `"xrpl": "^4.6.0"`, and `structure.md` scan confirmed this
- **Suggested fix:** Update both files to `xrpl v4.6.0`

### Medium — Partially wrong

#### 2. README.md state file output path [FIXED]
- **Doc source:** README.md, "Full State Setup" section (line 44)
- **What it claims:** "saves all wallet keys and metadata to a JSON state file at `scripts/setup-state-<network>-<date>.json`"
- **What the code actually does:** `setup-full-state.sh` writes to `examples/setup-state-{network}-{date}.json` (confirmed by `config-ops.md` scan and `.gitignore` patterns)
- **Suggested fix:** Change path to `examples/setup-state-<network>-<date>.json`

#### 3. README.md API routes table is incomplete [UNFIXED — requires judgment on scope]
- **Doc source:** README.md, "API Routes" section
- **What it claims:** Lists 18 API routes
- **What the code actually does:** The application has 29 HTTP endpoints. Missing routes: `/api/ping` (GET), `/api/accounts/[address]/fund` (POST), `/api/accounts/[address]/filled-orders` (GET), `/api/accounts/[address]/rippling` (POST), `/api/dex/trades` (GET), `/api/amm/info` (GET), `/api/amm/create` (POST), `/api/amm/deposit` (POST), `/api/amm/withdraw` (POST)
- **Suggested fix:** Add the 9 missing routes to the README table. Not auto-fixed because the README may intentionally show a simplified view.

#### 4. CLAUDE.md Commands section is incomplete [FIXED]
- **Doc source:** CLAUDE.md, "Commands" section
- **What it claims:** Lists 4 commands (`pnpm dev`, `pnpm build`, `pnpm lint`, `scripts/test-all.sh`)
- **What the code actually does:** The project also has `pnpm test` (Vitest), `pnpm typecheck` (tsc --noEmit), `pnpm format:check` (Prettier), `pnpm format:write`, `pnpm e2e` (Playwright), `pnpm start`
- **Suggested fix:** Add missing commands to the Commands section

#### 5. CLAUDE.md lib/xrpl Module Map is incomplete [FIXED]
- **Doc source:** CLAUDE.md, "`lib/` Module Map" → "XRPL Core" table
- **What it claims:** Lists 9 modules in `lib/xrpl/`
- **What the code actually does:** `lib/xrpl/` contains 20 files. Missing from docs: `order-book-levels.ts`, `midprice.ts`, `aggregate-depth.ts`, `amm-math.ts`, `estimate-fill.ts`, `estimate-fill-combined.ts`
- **Suggested fix:** Add missing modules to the table

#### 6. CLAUDE.md Hooks table is incomplete [FIXED]
- **Doc source:** CLAUDE.md, "`lib/` Module Map" → "UI & Hooks" table
- **What it claims:** Lists 14 hooks
- **What the code actually does:** `lib/hooks/` contains 17 hooks. Missing: `use-offer-expiration-timers.ts`, `use-page-visible.ts`, `use-poll-interval.ts`
- **Suggested fix:** Add missing hooks to the table

### Low — Minor inaccuracies

#### 7. CLAUDE.md Next.js version [UNFIXED — cosmetic]
- **Doc source:** CLAUDE.md, "**Stack**" line
- **What it claims:** `Next.js 16.1.6`
- **What the code actually does:** `package.json` has `"next": "16.1.6"` — this is correct as of the scan. No action needed.

#### 8. CLAUDE.md missing `pnpm e2e` from Commands [FIXED]
- **Doc source:** CLAUDE.md, "Commands" section
- **What it claims:** Does not mention E2E test command
- **What the code actually does:** `pnpm e2e` runs Playwright tests (configured in `playwright.config.ts`, run in `e2e.yml` CI workflow)
- **Suggested fix:** Add `pnpm e2e` to Commands

## Config Artifact Drift

### No `.env` template drift
The project has zero environment variables and no `.env` files. No drift to check.

### CI pipeline vs actual commands

| CI Job | CI Command | package.json Script | Status |
|---|---|---|---|
| lint | `pnpm lint` | `"lint": "next lint"` | Match |
| typecheck | `pnpm typecheck` | `"typecheck": "tsc --noEmit"` | Match |
| format-check | `pnpm format:check` | `"format:check": "prettier --check ."` | Match |
| build | `pnpm build` | `"build": "next build"` | Match |
| e2e | `pnpm e2e` | `"e2e": "playwright test"` | Match |
| unit tests | **Not in CI** | `"test": "vitest"` | **Gap** — `pnpm test` exists but is never run in CI |

**Finding:** All CI commands match their `package.json` definitions. The one gap is that `pnpm test` (Vitest unit tests) is defined but not included in any CI workflow.

### Dockerfile / deployment drift
No Dockerfile exists. Deployment is via Vercel (detected from `vercel.json`-less configuration in `next.config.ts`). No version drift to check.
