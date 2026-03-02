# Session Process Patterns

## Planning a Multi-File Refactoring Effort

### Phase 1: Discovery — Parallel Exploration

Start with parallel agents exploring different axes of the codebase simultaneously:
- **Agent 1**: API routes — structure, patterns, duplication
- **Agent 2**: Shared libs — utilities, types, helpers
- **Agent 3**: Test coverage — what exists, what's missing

This gives a comprehensive map in one round-trip instead of sequential exploration.

### Phase 2: Catalog and Prioritize

Present all identified refactoring opportunities in a numbered list with:
- What the duplication/issue is
- Which files are affected
- Whether test coverage exists for the affected code

Then ask the user to scope (all vs subset), choose test strategy (unit, integration, both), and clarify dependencies. Batch these questions into one interaction rather than asking one at a time.

### Phase 3: Test Coverage First, Then Refactor

Execute in strict order:
1. **Test infrastructure** — shared helpers, mock factories, request builders
2. **Lib-level unit tests** — pure functions first (validators, parsers, encoders)
3. **Route handler tests** — every route gets a colocated `route.test.ts`
4. **Integration tests** — bash/curl scripts for error paths
5. **Run all tests green** against the *unmodified* code
6. **Then refactor** — with confidence that any test failure signals a real regression

### Phase 4: Refactoring Execution Strategy

Group refactors by dependency and blast radius:

- **Foundation refactors first**: Changes to shared modules (`lib/api.ts`, `lib/xrpl/networks.ts`) that other refactors depend on
- **Mechanical sweeps second**: Same pattern applied across many files (e.g., remove casts from 16 files, update walletFromSeed in 13 files) — do inline, not via agent
- **Complex single-file refactors last**: Logic restructuring within one module (e.g., `parseFilledOrders` type guards + helper extraction)

After each group, run `pnpm test` to catch regressions early.

### Deciding What NOT to Refactor

Some identified opportunities aren't worth pursuing. Skip when:
- Only 2 instances exist and they serve different purposes (e.g., Cache-Control: `no-store` for mutations vs `s-maxage` for reads)
- The "refactor" would add a feature (new cache headers) rather than deduplicate existing code
- The change would require judgment calls about behavior, not just mechanical cleanup

Document skipped items and why — it shows thoroughness without wasted effort.

## Write One, Validate, Then Parallelize

When generating N similar files (e.g., route test files), write **one** first, run it, fix issues, then use the validated version as a template for parallel generation. This avoids mass-failure scenarios where the same bug hits all N files simultaneously.

## Simple Multi-File Patterns: Inline over Agent

For mechanical substitutions across many files (e.g., changing a 3-line pattern to 2 lines in 13 files), inline editing with `replace_all` or sequential Edit calls is faster and more reliable than launching an agent. Agents are better for files requiring judgment or different logic per file.

## Context Budget: Delegate Bulk Generation Early

When a task involves both bulk file creation (tests) and iterative refactoring, delegate the bulk creation to agents early to preserve main context for the refactoring phase where judgment and iteration matter more.

## Tests-First Refactoring: The Full Methodology

### Why Tests First (Not Just Safety)

Writing tests before refactoring serves three purposes beyond regression safety:
1. **Bug discovery** — tests codify expected behavior; mismatches reveal actual bugs (e.g., AMM routes returning 200 instead of 201)
2. **Forces understanding** — writing a test for a route you're about to refactor requires reading and understanding every code path in that route
3. **Defines the contract** — tests lock in the API surface (status codes, response shapes, error messages) so the refactor can change internals freely

### Build Test Infrastructure First

Before writing any test, create shared helpers that all tests will use. This prevents divergent test patterns across files:

```
lib/test-helpers.ts
├── TEST_WALLET, TEST_WALLET_2, TEST_WALLET_3  (stable, reusable)
├── createMockClient(overrides?)                (vi.fn() for every client method)
├── successTxResult(extra?), failedTxResult(code)  (mock submitAndWait returns)
├── postRequest(path, body), getRequest(path, params?)  (NextRequest factories)
└── routeParams({ address })                    (Promise-wrapped for Next.js 16)
```

This upfront investment pays off immediately — 27 route test files all share the same helpers without drift.

### Test Layering Strategy

Build tests in layers, each adding confidence before the next:

**Layer 1: Pure function unit tests** — validators, parsers, encoders in `lib/`. These have no mocking, run instantly, and cover the helpers you're about to extract during refactoring.

**Layer 2: Route handler tests** — colocated `route.test.ts` next to each `route.ts`. These mock the XRPL client and test the full request→response flow. Cover:
- Missing required fields → 400
- Invalid field values → 400
- Invalid seed → 400
- Happy path → 201/200
- Transaction failure → 422
- Server error → 500

**Layer 3: Integration error-path tests** — bash/curl scripts that hit the running dev server. These catch issues that unit tests miss (middleware, serialization, actual HTTP behavior). Focus on error paths since happy paths require real XRPL testnet accounts.

### Run Tests Against Unmodified Code

Critical step: run the full suite *before any refactoring*. Two outcomes:

- **All green**: The tests correctly describe current behavior. Any future failure is a regression from your refactoring.
- **Some failures**: You've found bugs. Decide per failure:
  - Is this a real bug? → Fix the code, keep the test expectation
  - Is the test wrong? → Fix the test (e.g., route legitimately returns 500 for an edge case you expected 400)

In this session, AMM deposit/withdraw tests expected 200 (matching what the routes actually returned), which we then recognized as a bug and fixed to 201.

### What to Test When the Refactor Changes Behavior

Some refactors intentionally change behavior (e.g., status code 200→201). For these:
1. Write tests against the *current* behavior first
2. Run them green to confirm the tests work
3. Apply the refactor
4. Update the test expectations to match the new behavior
5. Verify the updated tests pass

This two-step approach proves both that the test was correctly observing the old behavior AND that the new behavior works.

## Categorize Route Tests for Parallel Agent Generation

When generating test files for many API routes, group them by route shape for parallel agent work:

1. **GET routes** (simple request/response, mock `client.request`)
2. **POST mutation routes** (validate body → submit tx → check result, mock `submitAndWait`)
3. **Specialized routes** (DEX orderbook with `getOrderbook`, AMM with multi-step flows)

Each category shares mock patterns and test structures, making them ideal for parallel agents with distinct templates.

## Refactoring Order: Dependencies First

When applying multiple refactors that depend on each other, order matters:

1. **Shared helpers first** (add `parseLimit`, `validateDexAmount` to `lib/api.ts`)
2. **Route changes second** (update routes to use new helpers)
3. **Test updates last** (adjust tests for changed status codes or response shapes)

Reversing this order causes intermediate failures that waste debugging time.

## Map Refactoring Targets to Test Coverage

Before starting any refactoring, build a coverage map:

| Refactor | Files Affected | Existing Tests? | Action |
|---|---|---|---|
| Extract `parseLimit` | 4 GET routes | No route tests | Write route tests first |
| Simplify `walletFromSeed` | 13 POST routes | No route tests | Write route tests first |
| Refactor `parseFilledOrders` | 1 lib file | No unit tests | Write unit tests first |
| Fix AMM status codes | 2 routes | No route tests | Write tests, they'll reveal the bug |
| Change `validateRequired` sig | 16 routes | Has lib test | Safe to refactor (lib test covers the function) |

This table drives the execution plan: items with no tests get tests first, items with existing coverage can be refactored immediately. Present this to the user so they can make informed scope decisions.

## Batching User Questions

When a task requires multiple decisions from the user, batch all questions into a single message rather than asking one at a time. Group them by topic:

1. **Scope**: Which items to include?
2. **Strategy**: What type of tests?
3. **Dependencies**: Any prerequisites to address first?
4. **Ideas**: Additional opportunities discovered during exploration?

This minimizes round-trips and lets the user see the full picture before deciding.
