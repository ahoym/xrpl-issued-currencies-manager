# API Route DRY Patterns

## validateRequired() helper

Instead of repeating manual field-presence checks in every POST route:

```typescript
// Before — repeated in every route
if (!body.seed || !body.currency || !body.issuer) {
  return Response.json(
    { error: "Missing required fields: seed, currency, issuer" } satisfies ApiError,
    { status: 400 },
  );
}
```

Extract a shared helper:

```typescript
// lib/api.ts
export function validateRequired(
  data: Record<string, unknown>,
  fields: string[],
): Response | null {
  const missing = fields.filter((f) => !data[f]);
  if (missing.length > 0) {
    return Response.json(
      { error: `Missing required fields: ${missing.join(", ")}` } satisfies ApiError,
      { status: 400 },
    );
  }
  return null;
}
```

Usage:

```typescript
const invalid = validateRequired(body as unknown as Record<string, unknown>, ["seed", "currency", "issuer"]);
if (invalid) return invalid;
```

The `as unknown as Record<string, unknown>` cast is needed when the body is typed as a specific request interface.

## getNetworkParam() helper

When many GET routes extract the network query param the same way:

```typescript
// Before
const network = request.nextUrl.searchParams.get("network") ?? undefined;

// After
import { getNetworkParam } from "@/lib/api";
const network = getNetworkParam(request);
```

## When to keep manual validation

Keep manual checks for domain-specific validations that go beyond field presence:
- Array length bounds (`acceptedCredentials.length < MIN`)
- Cross-field relationships (`!body.subject && !body.issuer`)
- Wallet address mismatches (`wallet.address !== address`)
