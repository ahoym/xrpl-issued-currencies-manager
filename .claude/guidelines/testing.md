# Testing Guideline

## Stack

- **Vitest** with `jsdom` environment
- **@testing-library/react** v16 — includes `renderHook` natively (do NOT install `@testing-library/react-hooks`, it's incompatible with React 19)
- **@testing-library/jest-dom** — DOM matchers via `vitest.setup.ts`
- Config: `vitest.config.ts` sets `environment: "jsdom"` and `setupFiles: ["./vitest.setup.ts"]`

## Testing Hooks

Use `renderHook` from `@testing-library/react` (NOT from a separate hooks package):

```typescript
import { renderHook, waitFor, act } from "@testing-library/react";

const { result } = renderHook(() => useMyHook(args));
expect(result.current.someValue).toBe(expected);

// For async state changes:
await waitFor(() => {
  expect(result.current.data).toHaveLength(2);
});

// For manual triggers:
await act(async () => {
  result.current.refresh();
});
```

## Mocking fetch

jsdom provides a native `fetch`, so you can mock it with `vi.fn()`:

```typescript
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Don't assert `globalThis.fetch` is undefined to test "no fetch" —
// jsdom always provides it. Instead verify fetch wasn't *called*.
```

Clean up in `afterEach`:

```typescript
afterEach(() => {
  vi.restoreAllMocks();
});
```

## Fake Timers

For hooks with `setTimeout`/`setInterval` (e.g., `useFormSubmit` auto-clear):

```typescript
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

// Advance time:
vi.advanceTimersByTime(5000);
```

## Test File Location

Place test files in `__tests__/` subdirectories next to the code they test:

```
lib/hooks/__tests__/use-api-fetch.test.ts
lib/hooks/__tests__/use-form-submit.test.ts
lib/xrpl/midprice.test.ts          (legacy: co-located)
```

## What to Test

- **Pure functions** exported from hooks/modules (e.g., `migrateLegacyStorage()`) — easiest, highest value
- **Custom hooks** via `renderHook` — test state transitions, fetch behavior, cleanup
- **Factory functions** (e.g., `createAccountFetchHook`) — test the returned hook behaves correctly
- **Don't unit-test** trivial wrappers or components that are mostly JSX — rely on E2E (Playwright) for those

## Gotchas

- React 19's `renderHook` is built into `@testing-library/react` — the standalone `@testing-library/react-hooks` package will fail with peer dependency errors
- jsdom provides `localStorage` — no need to mock it; just call `localStorage.clear()` in `beforeEach`
- jsdom provides `fetch` natively — you cannot test "fetch is not available" by checking if it's undefined
