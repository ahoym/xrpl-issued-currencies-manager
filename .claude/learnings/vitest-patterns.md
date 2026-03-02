# Vitest Patterns

## vi.mock() Hoisting and Shared Mocks

`vi.mock()` factory functions are **hoisted above all imports and variable declarations**. A mock factory cannot reference variables declared at module scope because those variables don't exist yet when the factory runs.

**Broken:**
```ts
const mockClient = createMockClient(); // declared at module scope

vi.mock("@/lib/xrpl/client", () => ({
  getClient: vi.fn().mockResolvedValue(mockClient), // ERROR: mockClient not yet initialized
}));
```

**Fix — use `vi.hoisted()`:**
```ts
const mockClient = vi.hoisted(() => ({
  request: vi.fn(),
  submitAndWait: vi.fn(),
  isConnected: vi.fn().mockReturnValue(true),
  connect: vi.fn(),
}));

vi.mock("@/lib/xrpl/client", () => ({
  getClient: vi.fn().mockResolvedValue(mockClient),
}));
```

`vi.hoisted()` runs its callback at the hoisted level (before imports), so the variable is available inside `vi.mock()` factories.

## Route Handler Test Structure for Next.js App Router

Pattern for testing Next.js route handlers that depend on an XRPL client singleton:

```ts
import { vi, describe, it, expect, beforeEach } from "vitest";
import { postRequest, successTxResult, TEST_WALLET } from "@/lib/test-helpers";

// 1. Hoist the mock client BEFORE vi.mock
const mockClient = vi.hoisted(() => ({
  request: vi.fn(),
  submitAndWait: vi.fn(),
  isConnected: vi.fn().mockReturnValue(true),
  connect: vi.fn(),
}));

// 2. Mock the module that provides the client
vi.mock("@/lib/xrpl/client", () => ({
  getClient: vi.fn().mockResolvedValue(mockClient),
}));

// 3. Import the route handler AFTER mocks are set up
import { POST } from "./route";

describe("POST /api/...", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default happy-path mocks
    mockClient.submitAndWait.mockResolvedValue(successTxResult());
  });

  // Tests call the exported handler directly
  it("returns 201 on success", async () => {
    const res = await POST(postRequest("/api/...", { /* body */ }));
    expect(res.status).toBe(201);
  });
});
```

Key details:
- `vi.hoisted()` → `vi.mock()` → `import { handler }` order is critical
- `beforeEach(() => vi.clearAllMocks())` prevents mock state leaking between tests
- For dynamic routes, wrap params in a resolved Promise: `{ params: Promise.resolve({ address: "r..." }) }`

## Shared Test Helpers Design

A single `lib/test-helpers.ts` file should provide:
- **Stable test wallets**: `Wallet.generate()` called once at module level (not per test)
- **Mock client factory**: Returns object matching the XRPL client interface with all methods as `vi.fn()`
- **Request factories**: `postRequest(path, body)` and `getRequest(path, params?)` wrapping `NextRequest`
- **Response factories**: `successTxResult()` and `failedTxResult(code)` for mock `submitAndWait` returns
- **Route param helper**: `routeParams({ address })` wrapping in `Promise.resolve()` for Next.js 16

Note: `createMockClient()` from test-helpers can't be used inside `vi.hoisted()` (it imports `vi` from vitest, which causes circular issues in the hoisted scope). Instead, inline the mock object in `vi.hoisted()` and use `createMockClient()` only in non-hoisted contexts.

## Test Isolation: Mock Currency Encoding Must Match Runtime

When mocking XRPL responses that contain currency fields (e.g., trust line `lines[]`), the mock currency value must match the encoding the code under test will compare against. If the route calls `encodeXrplCurrency("USD")` which returns `"USD"` (3-char passthrough), the mock trust line must also use `"USD"` — not the 40-char hex form `"0000000000000000000000005553440000000000"`.

This caused a test that passed in isolation to fail in the full suite: the mock had hex-encoded currency, but the route compared against the 3-char form, so the trust line check always failed with "no trust line found."
