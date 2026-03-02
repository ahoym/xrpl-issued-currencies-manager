# Next.js Patterns

## Next.js 16: Dynamic Route Params are Promises

In Next.js 16 (App Router), dynamic route handler params are `Promise<{...}>` — they must be awaited before accessing values.

```ts
// Next.js 16
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  // ...
}
```

This is a breaking change from earlier App Router versions where params were synchronous objects.

## Testing Route Handlers Directly (No Server Required)

Route handlers exported from `app/api/**/route.ts` are plain async functions — import and call directly in vitest without spinning up the Next.js server:

```ts
import { POST } from "./route";
const res = await POST(new NextRequest(...));
expect(res.status).toBe(201);
```

For dynamic routes with `[address]` segments, the second argument needs Next.js 16 Promise-wrapped params:

```ts
import { GET } from "./route";
const res = await GET(request, { params: Promise.resolve({ address: "rXYZ..." }) });
```

This is much faster than HTTP-based integration tests and allows mocking dependencies via `vi.mock()`.

## Adding a Network ID Requires Updating All Network-Keyed Maps

When adding a new network to a `NetworkId` union type (e.g., adding `"mainnet"` to `"testnet" | "devnet"`), every `Record<NetworkId, ...>` in the codebase must be updated. TypeScript will catch missing keys — but the errors may be in unexpected files (e.g., `lib/assets.ts` has `WELL_KNOWN_CURRENCIES: Record<NetworkId, ...>`, not just `lib/xrpl/networks.ts`).

Search for `Record<NetworkId` across the codebase when extending the union.
