# Development Patterns

How to add new API routes, test scripts, and frontend hooks. Follow these patterns for consistency.

## API Route Pattern

### POST Route (Transaction)

Annotated skeleton based on `app/api/currencies/issue/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { Payment } from "xrpl";                           // Transaction type
import { getClient } from "@/lib/xrpl/client";            // Singleton XRPL client
import { resolveNetwork } from "@/lib/xrpl/networks";     // Network resolver
import { encodeXrplCurrency } from "@/lib/xrpl/currency"; // Currency codec
import {
  validateRequired,       // Check required fields → 400 or null
  walletFromSeed,         // Seed → { wallet } | { error: Response }
  validateAddress,        // XRPL address format → 400 or null
  validatePositiveAmount, // Positive finite number → 400 or null
  txFailureResponse,      // Check tx result → 422 or null
  apiErrorResponse,       // Catch-all error → 500 (or 404)
} from "@/lib/api";
import type { IssueCurrencyRequest, ApiError } from "@/lib/xrpl/types";

export async function POST(request: NextRequest) {
  try {
    // 1. Parse body
    const body: IssueCurrencyRequest = await request.json();

    // 2. Structural validation (all required fields present)
    const invalid = validateRequired(
      body as unknown as Record<string, unknown>,
      ["issuerSeed", "recipientAddress", "currencyCode", "amount"],
    );
    if (invalid) return invalid;

    // 3. Field-level validation
    const seedResult = walletFromSeed(body.issuerSeed);
    if ("error" in seedResult) return seedResult.error;
    const wallet = seedResult.wallet;

    const badAddr = validateAddress(body.recipientAddress, "recipientAddress");
    if (badAddr) return badAddr;

    const badAmount = validatePositiveAmount(body.amount, "amount");
    if (badAmount) return badAmount;

    // 4. Acquire XRPL client
    const client = await getClient(resolveNetwork(body.network));

    // 5. Business logic validation (ledger queries)
    const accountLines = await client.request({
      command: "account_lines",
      account: body.recipientAddress,
      peer: wallet.address,
      ledger_index: "validated",
    });
    // ... check preconditions, return 400 if not met

    // 6. Build and submit transaction
    const tx: Payment = {
      TransactionType: "Payment",
      Account: wallet.address,
      Destination: body.recipientAddress,
      Amount: { currency: encodeXrplCurrency(body.currencyCode), issuer: wallet.address, value: body.amount },
    };
    const result = await client.submitAndWait(tx, { wallet });

    // 7. Check transaction result
    const failure = txFailureResponse(result);
    if (failure) return failure;   // Returns 422

    // 8. Success
    return Response.json({ result: result.result }, { status: 201 });

  } catch (err) {
    return apiErrorResponse(err, "Failed to issue currency");
  }
}
```

### GET Route (Ledger Query)

Annotated skeleton based on `app/api/accounts/[address]/balances/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { dropsToXrp } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { decodeCurrency } from "@/lib/xrpl/currency";
import { getNetworkParam, validateAddress, apiErrorResponse } from "@/lib/api";
import type { CurrencyBalance } from "@/lib/xrpl/types";

// CRITICAL: Next.js 16 dynamic params are Promise<{...}>
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    // 1. Await dynamic route params (Next.js 16 requirement)
    const { address } = await params;

    // 2. Validate
    const badAddr = validateAddress(address, "XRPL address");
    if (badAddr) return badAddr;

    // 3. Acquire client (extract network from query param)
    const client = await getClient(resolveNetwork(getNetworkParam(request)));

    // 4. Fetch data (parallelize independent requests)
    const [accountInfo, accountLines] = await Promise.all([
      client.request({ command: "account_info", account: address, ledger_index: "validated" }),
      client.request({ command: "account_lines", account: address, ledger_index: "validated" }),
    ]);

    // 5. Transform and return
    const xrpBalance: CurrencyBalance = {
      currency: "XRP",
      value: String(dropsToXrp(accountInfo.result.account_data.Balance)), // Always wrap with String()
    };
    return Response.json({ address, balances: [xrpBalance, ...issuedBalances] });

  } catch (err) {
    return apiErrorResponse(err, "Failed to fetch balances", { checkNotFound: true });
  }
}
```

### Response Status Conventions

| Status | When |
|---|---|
| 200 | Successful GET (default, no override needed) |
| 201 | Successful POST that creates/modifies ledger state |
| 400 | Validation error (missing fields, bad format, failed preconditions) |
| 404 | Account not found (use `{ checkNotFound: true }` in `apiErrorResponse`) |
| 422 | Transaction submitted but failed on-ledger (via `txFailureResponse`) |
| 500 | Server error (catch-all via `apiErrorResponse`) |

### Validation Helpers (`lib/api.ts`)

| Helper | Returns | Use |
|---|---|---|
| `validateRequired(data, fields)` | `Response \| null` | Check all required fields present |
| `walletFromSeed(seed)` | `{ wallet } \| { error: Response }` | Derive wallet; discriminated union |
| `validateAddress(address, fieldName)` | `Response \| null` | XRPL classic address format |
| `validateSeedMatchesAddress(wallet, address)` | `Response \| null` | Wallet matches URL address |
| `validatePositiveAmount(amount, fieldName)` | `Response \| null` | Finite, positive number |
| `validateCredentialType(type)` | `Response \| null` | Length check (max 128 chars) |
| `validateCurrencyPair(request)` | `Response \| CurrencyPair` | Extract + validate base/quote from query params |
| `getNetworkParam(request)` | `string \| undefined` | Extract optional `?network=` query param |
| `txFailureResponse(result)` | `Response \| null` | 422 if transaction failed |
| `apiErrorResponse(err, message, opts?)` | `Response` | Build error response; 404 if `checkNotFound` + actNotFound |

## Test Script Pattern

### Structure

Annotated skeleton based on `scripts/test-issue-currency.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

echo "=== End-to-End: Feature Name ==="

# --- Step 1: Setup ---
ISSUER=$(generate_account)
ISSUER_ADDRESS=$(echo "$ISSUER" | jq -r '.address')
ISSUER_SEED=$(echo "$ISSUER" | jq -r '.seed')

RECIPIENT=$(generate_account)
RECIPIENT_ADDRESS=$(echo "$RECIPIENT" | jq -r '.address')
RECIPIENT_SEED=$(echo "$RECIPIENT" | jq -r '.seed')

# --- Step 2: Prerequisites ---
create_trustline "$RECIPIENT_SEED" "$ISSUER_ADDRESS" "USD" "1000000" "$NETWORK" "$RECIPIENT_ADDRESS" > /dev/null

# --- Step 3: Test main flow ---
issue_currency "$ISSUER_SEED" "$RECIPIENT_ADDRESS" "USD" "100" "$NETWORK" > /dev/null

# --- Step 4: Verify ---
BALANCES=$(api_get "/api/accounts/${RECIPIENT_ADDRESS}/balances?network=${NETWORK}")
USD_BALANCE=$(echo "$BALANCES" | jq -r '.balances[] | select(.currency == "USD") | .value')

if [ "$USD_BALANCE" = "100" ]; then
  echo "PASS: Recipient has 100 USD"
else
  echo "FAIL: Expected 100 USD, got ${USD_BALANCE}"
  exit 1
fi

echo ""
echo "=== All tests passed ==="
```

### Shared Helpers (`scripts/lib.sh`)

**Environment variables:**
- `BASE_URL` — defaults to `http://localhost:3000`
- `NETWORK` — defaults to `testnet`

**Generic HTTP:**

| Helper | Default Status | Usage |
|---|---|---|
| `api_get "/path"` | 200 | GET request, asserts status, echoes body |
| `api_post "/path" "$json"` | 201 | POST request, asserts status, echoes body |
| `parse_response "$response"` | — | Splits curl output into `$BODY` and `$HTTP_CODE` |
| `assert_status $code "description"` | — | Assert `$HTTP_CODE`; exits 1 on mismatch |

**Domain-specific:**

| Helper | Signature | Purpose |
|---|---|---|
| `generate_account` | `[network] [extra_json]` | POST to `/api/accounts/generate`, echo body |
| `create_trustline` | `seed issuer currency limit network address` | POST to `/api/accounts/{address}/trustlines` |
| `issue_currency` | `issuer_seed recipient currency amount [network]` | POST to `/api/currencies/issue` |
| `place_offer` | `seed taker_gets_json taker_pays_json [network] [domain_id]` | POST to `/api/dex/offers` |
| `create_credential` | `seed subject credential_type [network]` | POST to `/api/credentials/create` |
| `accept_credential` | `seed issuer credential_type [network]` | POST to `/api/credentials/accept` |
| `create_domain` | `seed accepted_creds_json [network]` | POST to `/api/domains/create` |

### Curl Convention

All curl calls use `-s -w "\n%{http_code}"` to append the HTTP status code on the last line. `parse_response` splits on the last line to set `$BODY` and `$HTTP_CODE`.

### Output Formatting

- `===` section headers for test groups
- `---` step headers within a test
- `PASS: description` / `FAIL: description` for assertions
- Suppress setup noise with `> /dev/null`

## Naming Conventions

| What | Pattern | Example |
|---|---|---|
| API route (collection) | `app/api/<resource>/route.ts` | `app/api/transfers/route.ts` |
| API route (item) | `app/api/<resource>/[param]/route.ts` | `app/api/accounts/[address]/route.ts` |
| API route (action) | `app/api/<resource>/<action>/route.ts` | `app/api/dex/offers/cancel/route.ts` |
| Test script | `scripts/test-<feature>.sh` | `scripts/test-dex-offers.sh` |
| React hook | `lib/hooks/use-<name>.ts` | `lib/hooks/use-balances.ts` |
| React hook (with JSX) | `lib/hooks/use-<name>.tsx` | `lib/hooks/use-app-state.tsx` |
| XRPL utility | `lib/xrpl/<concern>.ts` | `lib/xrpl/currency.ts` |
| Request/response types | `lib/xrpl/types.ts` | `CreateOfferRequest`, `DexAmount` |
| Frontend types | `lib/types.ts` | `WalletInfo`, `PersistedState` |
| Page components | `app/<page>/components/<name>.tsx` | `app/trade/components/order-book.tsx` |
| Shared components | `app/components/<name>.tsx` | `app/components/modal-shell.tsx` |
