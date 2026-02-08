# xrpl.js Validation Patterns

## Validation Helpers

xrpl.js v4.5.0 provides built-in validation helpers that should always be used before interacting with the XRPL:

- **`isValidClassicAddress(address)`** — validates that a string is a well-formed XRP Ledger classic address
- **`isValidSeed(seed)`** — validates that a string is a well-formed XRPL wallet seed

### Usage Pattern

Always validate inputs before using them in XRPL operations:

```typescript
import { isValidClassicAddress, isValidSeed, Wallet } from "xrpl";

// Validate address before using in requests
if (!isValidClassicAddress(address)) {
  return NextResponse.json({ error: "Invalid XRPL address" }, { status: 400 });
}

// Validate seed and wrap Wallet.fromSeed in try-catch as defense-in-depth
if (!isValidSeed(secret)) {
  return NextResponse.json({ error: "Invalid wallet seed" }, { status: 400 });
}

let wallet: Wallet;
try {
  wallet = Wallet.fromSeed(secret);
} catch {
  return NextResponse.json({ error: "Failed to derive wallet from seed" }, { status: 400 });
}
```

### Why Defense-in-Depth Matters

Even with `isValidSeed()` pre-validation, always wrap `Wallet.fromSeed()` in a try-catch. The validation function checks format, but edge cases in encoding or library updates could still cause exceptions. The try-catch ensures graceful error handling regardless.
