# Refactoring Methodology

Patterns and lessons from the frontend refactoring session (March 2026). Applicable to future refactoring work in this codebase.

## Planning: Survey Before Acting

Before proposing any changes, do a full survey:

1. **Count instances** — grep for the pattern across the codebase, not just spot-check. The `useFormSubmit` extraction found 7 components with the pattern, not the 3-4 initially visible.
2. **Categorize variants** — not all instances of a "similar" pattern are identical. The form submission audit found 4 distinct variants (standard, step-based, hook-abstracted, minimal). Only the "standard" variant was worth extracting.
3. **Check existing abstractions** — before creating a new hook/component, verify one doesn't already exist. This codebase already had `useApiFetch`/`useApiMutation` as building blocks.
4. **Size the work** — count files touched, lines changed, and test coverage gaps before committing to a refactoring plan.

## Execution Order: Tests First, Then Refactor

The sequence matters:

1. **Set up test infrastructure** — Vitest config, jsdom, @testing-library/react, setup file
2. **Write tests for existing behavior** — core hooks (useApiFetch, useApiMutation, useLocalStorage) tested before any changes
3. **Extract + test new abstractions** — write the new hook/component AND its tests together (e.g., useFormSubmit + 13 tests)
4. **Refactor consumers** — swap old inline code for the new abstraction
5. **Typecheck + test after each commit** — catch breakage immediately, not at the end

This order means you always have a safety net. When the `trade-form.tsx` refactor broke (stale `setError`/`setSuccess` references), TypeScript caught it immediately.

## Commit Granularity

One logical unit per commit, not one file per commit:

| Good | Bad |
|---|---|
| "Extract useFormSubmit hook and refactor 7 components" | "Create use-form-submit.ts" then "Update transfer-modal.tsx" then "Update trade-form.tsx" ... |
| "Add createAccountFetchHook factory for thin wrapper hooks" | "Add factory" then "Refactor useBalances" then "Refactor useTrustLines" |

The new abstraction + all its consumers + its tests belong in one commit. This makes each commit independently reviewable and revertable.

## Pattern: When to Use a Factory vs Individual Hooks

**Use a factory** (`createAccountFetchHook`) when:
- 3+ hooks follow an identical pattern with only 1-2 parameters varying
- The hooks have no extra logic beyond what the factory provides
- Examples: `useBalances`, `useFetchTrustLines`, `useAccountDomains` all just fetch `/api/accounts/{address}/{path}` and extract a JSON field

**Keep individual hooks** when:
- The hook has extra parameters (e.g., `useAccountCredentials` needs a `role` query param)
- The hook has custom logic beyond fetch-and-extract (e.g., `useIssuerCurrencies` transforms trust lines into a `Set`)
- Only 1-2 instances exist — wait for a third before abstracting

## Pattern: When to Extract a Shared Component

**Extract when**:
- The same UI pattern (markup + state + behavior) appears in 3+ places
- The pattern involves interactive state (toggle, tabs, form submission) — not just static markup
- `CollapsibleSection` appeared in 5 places with identical collapsed/toggle logic
- `TabBar` appeared in 2 places but was clearly going to recur (generic enough)

**Don't extract when**:
- The "similar" markup differs in structure, not just content (e.g., different DOM nesting)
- The component would need so many props that it's harder to use than inline code
- Only visual similarity, no shared behavior/state

## Gotcha: React 19 Testing

- `@testing-library/react-hooks` is **incompatible** with React 19 — it fails on peer dependency resolution
- Use `renderHook` from `@testing-library/react` v16 instead (it's built in)
- jsdom provides native `fetch` and `localStorage` — no need to polyfill, but you can't test "fetch unavailable" scenarios by checking `globalThis.fetch === undefined`

## Remaining Refactoring Opportunities

See `docs/plans/deferred-refactoring.md` for detailed plans on the three identified items (useTradingData split, trade component split, AbortController in fetch hooks).
