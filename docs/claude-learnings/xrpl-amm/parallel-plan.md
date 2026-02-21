# Parallel Plan: XRPL AMM Integration

## Context

Adding AMM (XLS-30) support to the XRPL Issued Currencies Manager. This includes backend API routes for AMMCreate, AMMDeposit, AMMWithdraw, and amm_info queries, plus frontend UI components (pool panel, create/deposit/withdraw modals) integrated into the existing `/trade` page. All decisions were confirmed by the user on 2026-02-21 — see `implementation-plan.md` for the full decision table.

## Shared Contract

### Types

```typescript
// ── lib/xrpl/types.ts (append after existing DeleteDomainRequest) ──

export interface AmmInfoQuery {
  baseCurrency: string;
  baseIssuer?: string;
  quoteCurrency: string;
  quoteIssuer?: string;
  network?: string;
}

export interface CreateAmmRequest {
  seed: string;
  amount: DexAmount;
  amount2: DexAmount;
  tradingFee: number; // 0–1000 (0%–1%)
  network?: string;
}

export interface DepositAmmRequest {
  seed: string;
  asset: { currency: string; issuer?: string };
  asset2: { currency: string; issuer?: string };
  amount?: DexAmount;
  amount2?: DexAmount;
  lpTokenOut?: DexAmount;
  mode: "two-asset" | "single-asset" | "two-asset-if-empty";
  network?: string;
}

export interface WithdrawAmmRequest {
  seed: string;
  asset: { currency: string; issuer?: string };
  asset2: { currency: string; issuer?: string };
  amount?: DexAmount;
  amount2?: DexAmount;
  lpTokenIn?: DexAmount;
  mode: "withdraw-all" | "two-asset" | "single-asset";
  network?: string;
}

// ── lib/types.ts (append after existing DomainInfo) ──

export interface AmmPoolInfo {
  exists: boolean;
  account?: string;
  asset1?: { currency: string; issuer?: string; value: string };
  asset2?: { currency: string; issuer?: string; value: string };
  lpToken?: { currency: string; issuer: string; value: string };
  tradingFee?: number;
  tradingFeeDisplay?: string;
  spotPrice?: string;
  assetFrozen?: boolean;
  asset2Frozen?: boolean;
  auctionSlot?: AmmAuctionSlot | null;
  voteSlots?: AmmVoteSlot[];
}

export interface AmmAuctionSlot {
  account: string;
  discountedFee: number;
  expiration: string;
  price: { currency: string; issuer: string; value: string };
  timeInterval: number;
}

export interface AmmVoteSlot {
  account: string;
  tradingFee: number;
  voteWeight: number;
}

// ── lib/xrpl/constants.ts (add in validation bounds section) ──

/** AMM maximum trading fee (1% = 1000 in fee units of 1/100,000). */
export const AMM_MAX_TRADING_FEE = 1000;

/** AMM default trading fee (0.3% — reasonable default for non-stable pairs). */
export const AMM_DEFAULT_TRADING_FEE = 300;

// ── lib/xrpl/lp-token.ts (new file) ──

export function isLpTokenCurrency(currencyCode: string): boolean;
export function formatLpTokenLabel(
  currencyCode: string,
  assetPair?: { base: string; quote: string },
): string;

// ── lib/xrpl/amm-fee.ts (new file) ──

export function formatAmmFee(fee: number): string;    // 300 → "0.30%"
export function parseAmmFeeInput(percentString: string): number; // "0.3" → 300

// ── lib/xrpl/amm-helpers.ts (new file) ──

import type { Currency } from "xrpl";
export function buildCurrencySpec(asset: { currency: string; issuer?: string }): Currency;

// ── lib/api.ts (modify existing function) ──

// Extended signature (adds optional errorMap):
export function txFailureResponse(
  result: TxResponse,
  errorMap?: Record<string, string>,
): Response | null;
```

### API Contracts

```
GET /api/amm/info?base_currency=XRP&quote_currency=USD&quote_issuer=rXXX&network=testnet
  → AmmPoolInfo
  Notes:
    - Uses snake_case query params (reuses validateCurrencyPair helper)
    - When no pool exists: { exists: false }
    - spotPrice normalized to user's base/quote orientation
    - Includes assetFrozen/asset2Frozen booleans

POST /api/amm/create  { CreateAmmRequest }
  → 201 { result: TxResult }
  Notes:
    - xrpl.js autofill handles the special AMMCreate fee
    - Uses AMM_CREATE_ERRORS map with txFailureResponse

POST /api/amm/deposit  { DepositAmmRequest }
  → 200 { result: TxResult }
  Notes:
    - Mode maps to AMMDepositFlags (tfTwoAsset, tfSingleAsset, tfTwoAssetIfEmpty)
    - Uses AMM_DEPOSIT_ERRORS map with txFailureResponse

POST /api/amm/withdraw  { WithdrawAmmRequest }
  → 200 { result: TxResult, poolDeleted?: boolean }
  Notes:
    - Mode maps to AMMWithdrawFlags (tfWithdrawAll, tfTwoAsset, tfSingleAsset)
    - For withdraw-all: re-queries amm_info to check if pool was deleted
    - Uses AMM_WITHDRAW_ERRORS map with txFailureResponse
```

### Import Paths

```
# Server-side types (API routes)
AmmInfoQuery, CreateAmmRequest, DepositAmmRequest, WithdrawAmmRequest, DexAmount
  → import from "@/lib/xrpl/types"

# Client-side types (hooks, components)
AmmPoolInfo, AmmAuctionSlot, AmmVoteSlot
  → import from "@/lib/types"

# Utilities
isLpTokenCurrency, formatLpTokenLabel  → import from "@/lib/xrpl/lp-token"
formatAmmFee, parseAmmFeeInput         → import from "@/lib/xrpl/amm-fee"
buildCurrencySpec                      → import from "@/lib/xrpl/amm-helpers"
AMM_MAX_TRADING_FEE, AMM_DEFAULT_TRADING_FEE → import from "@/lib/xrpl/constants"

# Existing utilities used by AMM routes
validateRequired, walletFromSeed, validatePositiveAmount, validateCurrencyPair,
  getNetworkParam, txFailureResponse, apiErrorResponse
  → import from "@/lib/api"
getClient                              → import from "@/lib/xrpl/client"
resolveNetwork                         → import from "@/lib/xrpl/networks"
toXrplAmount, fromXrplAmount           → import from "@/lib/xrpl/currency"
Assets                                 → import from "@/lib/assets"

# Hooks
useAmmPool      → import from "@/lib/hooks/use-amm-pool"
useApiMutation  → import from "@/lib/hooks/use-api-mutation"
CurrencyOption  → import from "@/lib/hooks/use-trading-data"

# Components
AmmPoolPanel      → import from "./amm-pool-panel"       (within trade components)
AmmCreateModal    → import from "./amm-create-modal"      (within trade components)
AmmDepositModal   → import from "./amm-deposit-modal"     (within trade components)
AmmWithdrawModal  → import from "./amm-withdraw-modal"    (within trade components)
ModalShell        → import from "@/app/components/modal-shell"

# UI constants
inputClass, labelClass, primaryButtonClass, errorTextClass, successBannerClass,
  SUCCESS_MESSAGE_DURATION_MS → import from "@/lib/ui/ui"
```

## Prompt Preamble

**Project commands:**
- `pnpm build` — verify compilation (TypeScript type-check + Next.js build)
- `pnpm lint` — ESLint check (optional, run if time permits)

**Verification workflow (replaces TDD):**
This project has NO test framework (no vitest, jest, or mocha). All verification uses `pnpm build` to confirm type safety and compilation. For each change:
1. Write the code
2. Run `pnpm build` to verify it compiles without errors
3. Fix any type errors or build failures

**Key project conventions:**
- `"use client"` directive required for all React components and hooks
- Tailwind dark mode: use `dark:bg-zinc-*`, `dark:text-zinc-*` consistently
- XRPL `dropsToXrp()` returns `number` — always wrap with `String()` for string fields
- Follow existing import patterns — check neighboring files for style
- API routes: use `NextRequest` for request type, return `Response.json()`
- API GET routes use `request.nextUrl.searchParams` for query params
- API POST routes use `await request.json()` for body

**DO NOT modify files owned by other agents.** Each agent's file list is exclusive. If you need a type or utility from another agent's file, import it — it will exist at build time because the executor respects the dependency DAG.

**Completion Report:**
When done, end your output with:
- Files created/modified
- Build-verify results (pass/fail)
- Checkpoint: last completed step
- Discoveries: any gotchas, surprises, or learnings

## Agents

### A: foundation
- **depends_on**: []
- **soft_depends_on**: []
- **creates**: []
- **modifies**: [lib/xrpl/types.ts, lib/types.ts, lib/xrpl/constants.ts, lib/api.ts]
- **deletes**: []
- **estimated_duration**: 45s
- **description**: Add AMM type definitions, constants, and extend txFailureResponse with optional error map parameter.
- **tdd_steps**:
    1. build-verify → "pnpm build" (type definitions and utility extension — tested via compilation)
- **prompt**: |
    Add AMM foundation types, constants, and extend txFailureResponse.

    ## Files to Modify (4 files)

    ### 1. lib/xrpl/types.ts — Append AMM request types

    **Landmark**: File ends at line 103 with `export interface DeleteDomainRequest`. Append after it.

    Add these exported interfaces (exact definitions in Shared Contract above):
    - `AmmInfoQuery`
    - `CreateAmmRequest` (reuses existing `DexAmount` type from line 43)
    - `DepositAmmRequest`
    - `WithdrawAmmRequest`

    ### 2. lib/types.ts — Append AMM frontend types

    **Landmark**: File ends at line 87 with `export interface DomainInfo`. Append after it.

    Add these exported interfaces (exact definitions in Shared Contract above):
    - `AmmPoolInfo`
    - `AmmAuctionSlot`
    - `AmmVoteSlot`

    ### 3. lib/xrpl/constants.ts — Add AMM constants

    **Landmark**: Validation bounds section starts at line 41. Add after `HEX_CURRENCY_CODE_LENGTH` (line 59), before the epoch helpers section (line 61).

    Add:
    ```typescript
    /** AMM maximum trading fee (1% = 1000 in fee units of 1/100,000). */
    export const AMM_MAX_TRADING_FEE = 1000;

    /** AMM default trading fee (0.3% — reasonable default for non-stable pairs). */
    export const AMM_DEFAULT_TRADING_FEE = 300;
    ```

    ### 4. lib/api.ts — Extend txFailureResponse

    **Landmark**: `txFailureResponse` is at lines 200-209. Current signature:
    ```typescript
    export function txFailureResponse(result: TxResponse): Response | null {
    ```

    Change to accept an optional `errorMap` parameter:
    ```typescript
    export function txFailureResponse(
      result: TxResponse,
      errorMap?: Record<string, string>,
    ): Response | null {
      const txResult = getTransactionResult(result.result.meta);
      if (txResult && txResult !== "tesSUCCESS") {
        const friendlyMessage = errorMap?.[txResult];
        return Response.json(
          {
            error: friendlyMessage || `Transaction failed: ${txResult}`,
            ...(friendlyMessage ? { code: txResult } : {}),
            result: result.result,
          },
          { status: 422 },
        );
      }
      return null;
    }
    ```

    Existing callers pass no second argument and continue to work unchanged.

    ## DO NOT MODIFY
    - lib/xrpl/decode-currency-client.ts (owned by Agent B)
    - lib/xrpl/lp-token.ts, lib/xrpl/amm-fee.ts, lib/xrpl/amm-helpers.ts (owned by Agent B)
    - Any files in app/ (owned by other agents)

    ## Verification
    Run `pnpm build` to confirm all types compile and existing code is unaffected.

### B: server-utilities
- **depends_on**: []
- **soft_depends_on**: []
- **creates**: [lib/xrpl/lp-token.ts, lib/xrpl/amm-fee.ts, lib/xrpl/amm-helpers.ts]
- **modifies**: [lib/xrpl/decode-currency-client.ts]
- **deletes**: []
- **estimated_duration**: 85s
- **description**: Create LP token detection, AMM fee formatting, currency spec builder utilities, and update decode-currency-client to handle LP tokens.
- **tdd_steps**:
    1. build-verify → "pnpm build" (utility functions — tested via compilation)
- **prompt**: |
    Create three new utility files and update decode-currency-client for LP token handling.

    ## Files to Create (3 new files)

    ### 1. lib/xrpl/lp-token.ts

    LP token currency codes are 40-char hex strings starting with "03" prefix.

    ```typescript
    /**
     * Detect whether a currency code is an AMM LP token.
     * LP tokens use 160-bit hex codes where the first byte is 0x03.
     */
    export function isLpTokenCurrency(currencyCode: string): boolean {
      return currencyCode.length === 40 && currencyCode.startsWith("03");
    }

    /**
     * Format LP token for display.
     * Returns "LP (BASE/QUOTE)" if asset pair info is available, otherwise "LP Token".
     */
    export function formatLpTokenLabel(
      currencyCode: string,
      assetPair?: { base: string; quote: string },
    ): string {
      if (!isLpTokenCurrency(currencyCode)) return currencyCode;
      if (assetPair) return `LP (${assetPair.base}/${assetPair.quote})`;
      return "LP Token";
    }
    ```

    ### 2. lib/xrpl/amm-fee.ts

    AMM fee units: 0–1000 maps to 0%–1%. 1 unit = 0.001%.

    ```typescript
    /**
     * Convert AMM trading fee (0–1000) to display percentage string.
     * Example: 300 → "0.30%", 1000 → "1.00%", 0 → "0.00%"
     */
    export function formatAmmFee(fee: number): string {
      return (fee / 1000).toFixed(2) + "%";
    }

    /**
     * Convert percentage input (e.g., "0.3") to AMM fee units (e.g., 300).
     * Clamps to 0–1000 range.
     */
    export function parseAmmFeeInput(percentString: string): number {
      const percent = parseFloat(percentString);
      if (!Number.isFinite(percent)) return 0;
      return Math.round(Math.min(1000, Math.max(0, percent * 1000)));
    }
    ```

    ### 3. lib/xrpl/amm-helpers.ts

    Build XRPL Currency spec objects for AMM Asset/Asset2 fields (identifier only, no amount value).

    ```typescript
    import type { Currency } from "xrpl";
    import { Assets } from "@/lib/assets";
    import { encodeXrplCurrency } from "./currency";

    /**
     * Build XRPL Currency spec (no amount) for AMM Asset/Asset2 fields.
     * XRP → { currency: "XRP" }
     * Issued → { currency: "USD", issuer: "rXXX" }
     */
    export function buildCurrencySpec(
      asset: { currency: string; issuer?: string },
    ): Currency {
      if (asset.currency === Assets.XRP) {
        return { currency: "XRP" };
      }
      return {
        currency: encodeXrplCurrency(asset.currency),
        issuer: asset.issuer!,
      };
    }
    ```

    Note: `encodeXrplCurrency` is in `lib/xrpl/currency.ts` (Node-only, uses Buffer). This is fine since `buildCurrencySpec` is only used in API routes (server-side).

    ## File to Modify (1 file)

    ### 4. lib/xrpl/decode-currency-client.ts — Add LP token detection

    **Landmark**: Current code at line 7-8:
    ```typescript
    export function decodeCurrency(code: string): string {
      if (code.length !== 40) return code;
    ```

    Add LP token check immediately after the length check (before the hex stripping on line 10):
    ```typescript
    export function decodeCurrency(code: string): string {
      if (code.length !== 40) return code;
      // LP token codes start with 0x03 — return human-readable label
      if (code.startsWith("03")) return "LP Token";
      // Strip trailing zero-padding from the hex representation
      const stripped = code.replace(/0+$/, "");
      // ... rest unchanged
    ```

    Import nothing — this file is browser-safe and must stay dependency-free.

    ## DO NOT MODIFY
    - lib/xrpl/types.ts, lib/types.ts, lib/xrpl/constants.ts, lib/api.ts (owned by Agent A)
    - Any files in app/ (owned by other agents)

    ## Verification
    Run `pnpm build` to confirm all utilities compile and decode-currency-client still works.

### C: amm-info-route
- **depends_on**: [A, B]
- **soft_depends_on**: []
- **creates**: [app/api/amm/info/route.ts]
- **modifies**: []
- **deletes**: []
- **estimated_duration**: 75s
- **description**: Create GET /api/amm/info route that queries XRPL amm_info and returns normalized pool data.
- **tdd_steps**:
    1. build-verify → "pnpm build" (API route handler — tested via integration)
- **prompt**: |
    Create the AMM info GET route.

    ## Reference Pattern

    Follow `app/api/dex/orderbook/route.ts` (GET route pattern):
    - Uses `validateCurrencyPair(request)` for query param parsing (snake_case: `base_currency`, `quote_currency`, `base_issuer`, `quote_issuer`)
    - Uses `getNetworkParam(request)` for network
    - Uses `getClient(resolveNetwork(network))` for XRPL connection
    - Returns `Response.json(data)`

    Read that file first to match the exact pattern.

    ## File to Create

    ### app/api/amm/info/route.ts

    ```typescript
    import { NextRequest } from "next/server";
    import { validateCurrencyPair, getNetworkParam, apiErrorResponse } from "@/lib/api";
    import { getClient } from "@/lib/xrpl/client";
    import { resolveNetwork } from "@/lib/xrpl/networks";
    import { buildCurrencySpec } from "@/lib/xrpl/amm-helpers";
    import { formatAmmFee } from "@/lib/xrpl/amm-fee";
    import { fromXrplAmount } from "@/lib/xrpl/currency";
    import { Assets } from "@/lib/assets";

    export async function GET(request: NextRequest) {
      // 1. Parse & validate query params
      const pairResult = validateCurrencyPair(request);
      if (pairResult instanceof Response) return pairResult;
      const { baseCurrency, baseIssuer, quoteCurrency, quoteIssuer } = pairResult;
      const network = getNetworkParam(request);

      // 2. Build XRPL Currency specs for amm_info
      const asset = buildCurrencySpec({ currency: baseCurrency, issuer: baseIssuer });
      const asset2 = buildCurrencySpec({ currency: quoteCurrency, issuer: quoteIssuer });

      try {
        const client = await getClient(resolveNetwork(network));
        const response = await client.request({
          command: "amm_info",
          asset,
          asset2,
        });

        const amm = response.result.amm;

        // 3. Extract and normalize amounts
        const amount1 = fromXrplAmount(amm.amount as any);
        const amount2 = fromXrplAmount(amm.amount2 as any);

        // 4. Determine if response asset order matches query base/quote
        //    amm_info returns assets in pool creation order, which may not match
        //    the user's selected base/quote pair
        const amount1IsBase =
          amount1.currency === baseCurrency &&
          (baseCurrency === Assets.XRP || amount1.issuer === baseIssuer);

        const [baseAmount, quoteAmount] = amount1IsBase
          ? [amount1, amount2]
          : [amount2, amount1];

        // 5. Calculate spot price (price of 1 base in quote terms)
        const spotPrice =
          parseFloat(baseAmount.value) > 0
            ? (parseFloat(quoteAmount.value) / parseFloat(baseAmount.value)).toString()
            : "0";

        // 6. Build response
        return Response.json({
          exists: true,
          account: amm.account,
          asset1: baseAmount,
          asset2: quoteAmount,
          lpToken: fromXrplAmount(amm.lp_token as any),
          tradingFee: amm.trading_fee,
          tradingFeeDisplay: formatAmmFee(amm.trading_fee),
          spotPrice,
          assetFrozen: !!(amm as any).asset_frozen,
          asset2Frozen: !!(amm as any).asset2_frozen,
          auctionSlot: amm.auction_slot
            ? {
                account: amm.auction_slot.account,
                discountedFee: amm.auction_slot.discounted_fee,
                expiration: amm.auction_slot.expiration?.toString() ?? "",
                price: fromXrplAmount(amm.auction_slot.price as any),
                timeInterval: amm.auction_slot.time_interval ?? 0,
              }
            : null,
          voteSlots: (amm.vote_slots ?? []).map((v: any) => ({
            account: v.account,
            tradingFee: v.trading_fee,
            voteWeight: v.vote_weight,
          })),
        });
      } catch (err: unknown) {
        // amm_info returns error when no AMM exists for the pair
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("actNotFound") || msg.includes("ammNotFound")) {
          return Response.json({ exists: false });
        }
        return apiErrorResponse(err, "Failed to fetch AMM info");
      }
    }
    ```

    **Key details:**
    - `spotPrice` is normalized: always "price of 1 base in quote terms"
    - The `asset_frozen` / `asset2_frozen` fields may not exist on all responses — use `!!` coercion
    - `amm_info` errors when no pool exists — catch and return `{ exists: false }` (not a 500)
    - The frozen fields refer to the pool's original asset order, but since we normalize to user's base/quote, the frozen status should also be mapped accordingly. If amount1 is not base, swap the frozen flags too.

    Fix the frozen flag mapping: if `amount1IsBase` is false, swap `assetFrozen` and `asset2Frozen`.

    ## DO NOT MODIFY
    - lib/api.ts, lib/xrpl/types.ts (owned by Agent A)
    - lib/xrpl/amm-helpers.ts, lib/xrpl/amm-fee.ts (owned by Agent B)
    - Any other files in app/ (owned by other agents)

    ## Verification
    Run `pnpm build` to confirm the route compiles.

### D: amm-create-route
- **depends_on**: [A]
- **soft_depends_on**: []
- **creates**: [app/api/amm/create/route.ts]
- **modifies**: []
- **deletes**: []
- **estimated_duration**: 80s
- **description**: Create POST /api/amm/create route for creating AMM pools, with error map for friendly messages.
- **tdd_steps**:
    1. build-verify → "pnpm build" (API route handler — tested via integration)
- **prompt**: |
    Create the AMMCreate POST route.

    ## Reference Pattern

    Follow `app/api/dex/offers/route.ts` (POST route pattern):
    - `await request.json()` for body
    - `validateRequired(body, [...fields])`
    - `walletFromSeed(body.seed)` → check for error
    - `getClient(resolveNetwork(body.network))` → connect
    - Build transaction object
    - `client.submitAndWait(tx, { wallet })` → submit
    - `txFailureResponse(result, errorMap)` → check for failure
    - Return 201 on success

    Read that file first to match the exact pattern.

    ## File to Create

    ### app/api/amm/create/route.ts

    **Error map** (define at top of file):
    ```typescript
    const AMM_CREATE_ERRORS: Record<string, string> = {
      tecDUPLICATE: "An AMM pool already exists for this currency pair.",
      tecAMM_UNFUNDED: "Insufficient balance to fund the pool.",
      tecFROZEN: "Cannot create pool: one or both currencies are frozen.",
      tecNO_AUTH: "You are not authorized to hold one of the pool assets.",
      tecNO_LINE: "You need a trust line for both assets before creating a pool.",
      tecNO_PERMISSION: "One of the selected currencies cannot be used in an AMM pool.",
      tecAMM_INVALID_TOKENS: "Invalid asset selection. These currencies conflict with LP token encoding.",
      tecINSUF_RESERVE_LINE: "Not enough XRP reserve to hold LP tokens.",
      terNO_RIPPLE: "The token issuer must enable Default Ripple first.",
      temAMM_BAD_TOKENS: "Invalid asset pair. Both assets must be different currencies.",
      temBAD_FEE: "Trading fee must be between 0% and 1% (0-1000).",
    };
    ```

    **Implementation outline:**
    1. `validateRequired(body, ["seed", "amount", "amount2", "tradingFee"])`
    2. `walletFromSeed(body.seed)` → wallet
    3. Validate `tradingFee` is 0–1000 using `AMM_MAX_TRADING_FEE` from constants
    4. Validate both amounts are positive with `validatePositiveAmount`
    5. Build `AMMCreate` transaction:
       ```typescript
       import { AMMCreate } from "xrpl";
       const tx: AMMCreate = {
         TransactionType: "AMMCreate",
         Account: wallet.address,
         Amount: toXrplAmount(body.amount),
         Amount2: toXrplAmount(body.amount2),
         TradingFee: body.tradingFee,
       };
       ```
    6. `client.submitAndWait(tx, { wallet })` — xrpl.js autofill handles the special fee
    7. `txFailureResponse(result, AMM_CREATE_ERRORS)` — uses the extended errorMap
    8. Return `Response.json({ result: result.result }, { status: 201 })`

    **Imports needed:**
    - `validateRequired, walletFromSeed, validatePositiveAmount, getNetworkParam, txFailureResponse, apiErrorResponse` from `@/lib/api`
    - `getClient` from `@/lib/xrpl/client`
    - `resolveNetwork` from `@/lib/xrpl/networks`
    - `toXrplAmount` from `@/lib/xrpl/currency`
    - `AMM_MAX_TRADING_FEE` from `@/lib/xrpl/constants`
    - `AMMCreate` type from `xrpl`

    ## DO NOT MODIFY
    - lib/api.ts, lib/xrpl/types.ts, lib/xrpl/constants.ts (owned by Agent A)
    - lib/xrpl/amm-helpers.ts (owned by Agent B)
    - Any other files

    ## Verification
    Run `pnpm build` to confirm the route compiles.

### E: amm-deposit-withdraw-routes
- **depends_on**: [A, B]
- **soft_depends_on**: []
- **creates**: [app/api/amm/deposit/route.ts, app/api/amm/withdraw/route.ts]
- **modifies**: []
- **deletes**: []
- **estimated_duration**: 135s
- **description**: Create POST routes for AMMDeposit and AMMWithdraw with mode-based flag mapping and error maps.
- **tdd_steps**:
    1. build-verify → "pnpm build" (API route handlers — tested via integration)
- **prompt**: |
    Create the AMMDeposit and AMMWithdraw POST routes.

    ## Reference Pattern

    Follow `app/api/dex/offers/route.ts` for POST route structure. Read it first.

    ## Files to Create (2 files)

    ### 1. app/api/amm/deposit/route.ts

    **Error map:**
    ```typescript
    const AMM_DEPOSIT_ERRORS: Record<string, string> = {
      tecAMM_EMPTY: "This pool is empty. Use two-asset-if-empty mode to refund it.",
      tecAMM_NOT_EMPTY: "This pool already has assets. Use a standard deposit instead.",
      tecAMM_FAILED: "Deposit failed: the effective price exceeds your specified limit.",
      tecUNFUNDED_AMM: "Insufficient balance to make this deposit.",
      tecFROZEN: "Cannot deposit: this currency is frozen by its issuer.",
      tecINSUF_RESERVE_LINE: "Not enough XRP reserve to hold LP tokens.",
      temBAD_AMM_TOKENS: "Invalid LP token specification.",
      temBAD_AMOUNT: "Deposit amount must be positive.",
      terNO_AMM: "No AMM pool exists for this currency pair.",
    };
    ```

    **Implementation:**
    1. `validateRequired(body, ["seed", "asset", "asset2", "mode"])`
    2. `walletFromSeed(body.seed)` → wallet
    3. Mode-specific validation:
       - `"two-asset"` → require `amount` AND `amount2`
       - `"single-asset"` → require `amount` (one asset only)
       - `"two-asset-if-empty"` → require `amount` AND `amount2`
    4. Flag mapping:
       ```typescript
       import { AMMDeposit, AMMDepositFlags } from "xrpl";
       const flagMap: Record<string, number> = {
         "two-asset": AMMDepositFlags.tfTwoAsset,
         "single-asset": AMMDepositFlags.tfSingleAsset,
         "two-asset-if-empty": AMMDepositFlags.tfTwoAssetIfEmpty,
       };
       ```
    5. Build transaction using `buildCurrencySpec` for Asset/Asset2 and `toXrplAmount` for Amount/Amount2:
       ```typescript
       const tx: AMMDeposit = {
         TransactionType: "AMMDeposit",
         Account: wallet.address,
         Asset: buildCurrencySpec(body.asset),
         Asset2: buildCurrencySpec(body.asset2),
         Flags: flagMap[body.mode],
       };
       if (body.amount) tx.Amount = toXrplAmount(body.amount);
       if (body.amount2) tx.Amount2 = toXrplAmount(body.amount2);
       ```
    6. Submit, check with `txFailureResponse(result, AMM_DEPOSIT_ERRORS)`
    7. Return `Response.json({ result: result.result })`

    ### 2. app/api/amm/withdraw/route.ts

    **Error map:**
    ```typescript
    const AMM_WITHDRAW_ERRORS: Record<string, string> = {
      tecAMM_EMPTY: "This pool has no assets to withdraw.",
      tecAMM_BALANCE: "Cannot complete withdrawal: would drain one side of the pool entirely.",
      tecAMM_FAILED: "Withdrawal failed: the effective price is below your specified limit.",
      tecAMM_INVALID_TOKENS: "Withdrawal amount is too small to process.",
      tecFROZEN: "Cannot withdraw: this currency is frozen by its issuer.",
      tecINSUF_RESERVE_LINE: "Not enough XRP reserve for this withdrawal.",
      tecNO_AUTH: "You are not authorized to hold one of the withdrawn assets.",
      temBAD_AMM_TOKENS: "Invalid LP token specification.",
      terNO_AMM: "No AMM pool exists for this currency pair.",
    };
    ```

    **Implementation:**
    1. `validateRequired(body, ["seed", "asset", "asset2", "mode"])`
    2. `walletFromSeed(body.seed)` → wallet
    3. Mode-specific validation:
       - `"withdraw-all"` → no amounts needed
       - `"two-asset"` → require `amount` AND `amount2`
       - `"single-asset"` → require `amount`
    4. Flag mapping:
       ```typescript
       import { AMMWithdraw, AMMWithdrawFlags } from "xrpl";
       const flagMap: Record<string, number> = {
         "withdraw-all": AMMWithdrawFlags.tfWithdrawAll,
         "two-asset": AMMWithdrawFlags.tfTwoAsset,
         "single-asset": AMMWithdrawFlags.tfSingleAsset,
       };
       ```
    5. Build and submit transaction (same pattern as deposit)
    6. Check with `txFailureResponse(result, AMM_WITHDRAW_ERRORS)`
    7. **For withdraw-all only:** After success, re-query `amm_info` to check if pool was deleted:
       ```typescript
       let poolDeleted = false;
       if (body.mode === "withdraw-all") {
         try {
           await client.request({ command: "amm_info", asset: ..., asset2: ... });
         } catch {
           poolDeleted = true; // amm_info fails = pool deleted
         }
       }
       return Response.json({ result: result.result, ...(poolDeleted ? { poolDeleted: true } : {}) });
       ```

    **Imports for both routes:**
    - `validateRequired, walletFromSeed, validatePositiveAmount, txFailureResponse, apiErrorResponse` from `@/lib/api`
    - `getClient` from `@/lib/xrpl/client`
    - `resolveNetwork` from `@/lib/xrpl/networks`
    - `toXrplAmount` from `@/lib/xrpl/currency`
    - `buildCurrencySpec` from `@/lib/xrpl/amm-helpers`

    ## DO NOT MODIFY
    - lib/api.ts, lib/xrpl/types.ts (owned by Agent A)
    - lib/xrpl/amm-helpers.ts (owned by Agent B)
    - app/api/amm/info/ (owned by Agent C)
    - app/api/amm/create/ (owned by Agent D)

    ## Verification
    Run `pnpm build` to confirm both routes compile.

### F: use-amm-pool-hook
- **depends_on**: []
- **soft_depends_on**: [A]
- **creates**: [lib/hooks/use-amm-pool.ts]
- **modifies**: []
- **deletes**: []
- **estimated_duration**: 55s
- **description**: Create useAmmPool hook that fetches AMM pool info for the selected currency pair.
- **tdd_steps**:
    1. build-verify → "pnpm build" (React hook — tested via compilation)
- **prompt**: |
    Create the useAmmPool hook for fetching AMM pool data.

    ## Reference

    The existing `useApiFetch` hook (lib/hooks/use-api-fetch.ts) returns `T[]` (arrays), but we need a single `AmmPoolInfo | null`. Write a custom hook with `useState` + `useEffect` + `fetch` instead.

    Reference `use-api-fetch.ts` for the general pattern (loading/error state, refresh mechanism, external refresh key).

    ## File to Create

    ### lib/hooks/use-amm-pool.ts

    ```typescript
    "use client";

    import { useState, useEffect, useCallback } from "react";
    import type { AmmPoolInfo } from "@/lib/types";

    interface UseAmmPoolParams {
      baseCurrency?: string;
      baseIssuer?: string;
      quoteCurrency?: string;
      quoteIssuer?: string;
      network: string;
      refreshKey: number;
    }

    export function useAmmPool({
      baseCurrency,
      baseIssuer,
      quoteCurrency,
      quoteIssuer,
      network,
      refreshKey,
    }: UseAmmPoolParams) {
      const [pool, setPool] = useState<AmmPoolInfo | null>(null);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState<string | null>(null);
      const [internalKey, setInternalKey] = useState(0);

      // Build URL — return null to skip fetch when pair is incomplete
      const url = baseCurrency && quoteCurrency
        ? `/api/amm/info?base_currency=${encodeURIComponent(baseCurrency)}` +
          (baseIssuer ? `&base_issuer=${encodeURIComponent(baseIssuer)}` : "") +
          `&quote_currency=${encodeURIComponent(quoteCurrency)}` +
          (quoteIssuer ? `&quote_issuer=${encodeURIComponent(quoteIssuer)}` : "") +
          `&network=${encodeURIComponent(network)}`
        : null;

      useEffect(() => {
        if (!url) {
          setPool(null);
          return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        fetch(url)
          .then((res) => res.json())
          .then((data) => {
            if (cancelled) return;
            if (data.error) {
              setError(data.error);
              setPool(null);
            } else {
              setPool(data as AmmPoolInfo);
            }
          })
          .catch(() => {
            if (!cancelled) setError("Failed to fetch AMM info");
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
        return () => { cancelled = true; };
      }, [url, refreshKey, internalKey]);

      const refresh = useCallback(() => setInternalKey((k) => k + 1), []);

      return { pool, loading, error, refresh };
    }
    ```

    **Key details:**
    - Uses snake_case query params (`base_currency`, `quote_currency`, etc.) to match `validateCurrencyPair` in the API route
    - Returns `null` pool when pair is incomplete (no fetch)
    - Cleanup function prevents state updates after unmount
    - `refresh()` function triggers manual re-fetch

    ## DO NOT MODIFY
    - lib/types.ts (owned by Agent A — provides AmmPoolInfo type)
    - lib/hooks/use-api-fetch.ts, lib/hooks/use-api-mutation.ts (shared hooks, not ours)

    ## Verification
    Run `pnpm build` to confirm the hook compiles.

### G: amm-pool-panel
- **depends_on**: []
- **soft_depends_on**: [A]
- **creates**: [app/trade/components/amm-pool-panel.tsx]
- **modifies**: []
- **deletes**: []
- **estimated_duration**: 130s
- **description**: Create the AMM Pool Panel component showing pool info, spot price, reserves, and action buttons.
- **tdd_steps**:
    1. build-verify → "pnpm build" (React component — tested via compilation)
- **prompt**: |
    Create the AMM Pool Panel component for the trade page left column.

    ## Design Reference

    Match existing card styling from `app/trade/components/balances-panel.tsx`:
    - Outer div: `rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950`
    - Section headers: `text-sm font-semibold text-zinc-900 dark:text-zinc-100`
    - Values: `text-xs` with appropriate zinc colors
    - Use `font-mono` for numeric values

    Also reference `app/trade/components/recent-trades.tsx` for the loading skeleton pattern.

    ## File to Create

    ### app/trade/components/amm-pool-panel.tsx

    **Props interface:**
    ```typescript
    interface AmmPoolPanelProps {
      pool: AmmPoolInfo | null;
      loading: boolean;
      pairSelected: boolean;
      onCreatePool: () => void;
      onDeposit: () => void;
      onWithdraw: () => void;
    }
    ```

    **States to handle:**

    1. **No pair selected** → Show "Select a currency pair to view AMM pool info" (muted text, centered)

    2. **Loading** → Show skeleton placeholder (2-3 animated lines)

    3. **Pool does not exist** (`pool?.exists === false` or `pool === null` after load):
       - "No AMM Pool" heading
       - "No AMM pool exists for this pair" subtext
       - "Create Pool" button (blue, calls `onCreatePool`)

    4. **Pool exists, not empty**:
       - **Spot Price**: "1 BASE = {spotPrice} QUOTE" — prominent, larger text
       - **Reserves**: "{asset1.value} {asset1.currency} + {asset2.value} {asset2.currency}"
       - **Trading Fee**: "{tradingFeeDisplay}"
       - **Action buttons**: "Deposit" (blue) and "Withdraw" (outline) buttons side by side
       - Decode currency names with `decodeCurrency` from `@/lib/xrpl/decode-currency-client`

    5. **Pool exists, empty** (exists=true but asset1.value and asset2.value are "0"):
       - "Pool is Empty" warning
       - "Re-fund Pool" button (calls `onDeposit`)

    6. **Frozen assets** (`assetFrozen` or `asset2Frozen`):
       - Yellow warning banner: "One or more pool assets are frozen."
       - Disable Deposit/Withdraw buttons

    **Layout**: Compact vertical card. Keep it small — this sits above RecentTrades in a narrow 2-column area. Use `space-y-2` for tight spacing.

    **Styling for buttons**: Use small buttons:
    ```tsx
    <button
      onClick={onDeposit}
      className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
    >
      Deposit
    </button>
    ```

    Format numeric values with `BigNumber` (already used in balances-panel):
    ```typescript
    import BigNumber from "bignumber.js";
    // Display: new BigNumber(value).toFixed(4)
    ```

    ## DO NOT MODIFY
    - lib/types.ts (owned by Agent A — provides AmmPoolInfo)
    - app/trade/components/trade-grid.tsx (owned by Agent J)
    - app/trade/components/balances-panel.tsx (owned by Agent K)
    - app/trade/page.tsx (owned by Agent J)

    ## Verification
    Run `pnpm build` to confirm the component compiles.

### H: amm-create-modal
- **depends_on**: []
- **soft_depends_on**: [A]
- **creates**: [app/trade/components/amm-create-modal.tsx]
- **modifies**: []
- **deletes**: []
- **estimated_duration**: 120s
- **description**: Create the AMM Create Pool modal with two-step form (input → preview → confirm).
- **tdd_steps**:
    1. build-verify → "pnpm build" (React component — tested via compilation)
- **prompt**: |
    Create the AMM Create Pool modal component.

    ## Design Reference

    Follow `app/trade/components/make-market-modal.tsx` for the two-step modal pattern. Read it first.
    Use `ModalShell` from `app/components/modal-shell.tsx` for the modal wrapper (props: `title`, `onClose`, `children`).
    Use `useApiMutation` from `lib/hooks/use-api-mutation.ts` for the POST call.
    Use UI constants from `lib/ui/ui.ts` (`inputClass`, `labelClass`, `primaryButtonClass`, `errorTextClass`, `successBannerClass`, `SUCCESS_MESSAGE_DURATION_MS`).

    ## File to Create

    ### app/trade/components/amm-create-modal.tsx

    **Props interface:**
    ```typescript
    import type { CurrencyOption } from "@/lib/hooks/use-trading-data";

    interface AmmCreateModalProps {
      baseCurrency: CurrencyOption;
      quoteCurrency: CurrencyOption;
      walletSeed: string;
      network: string;
      onClose: () => void;
      onSuccess: () => void;
    }
    ```

    **Two-step flow:**

    **Step 1 — Form:**
    - Base amount input (label: "{baseCurrency.label} Amount")
    - Quote amount input (label: "{quoteCurrency.label} Amount")
    - Trading fee input with presets:
      - Default: 0.30%
      - Preset buttons: "0.10%" (stable), "0.30%" (normal), "1.00%" (volatile)
      - Manual input field (percentage, 0-1)
      - Use `parseAmmFeeInput` from `@/lib/xrpl/amm-fee` to convert
    - Cost warning (non-dismissible):
      ```tsx
      <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
        Creating an AMM pool costs approximately 0.2 XRP (owner reserve).
        This is destroyed, not held in reserve.
      </div>
      ```
      (TODO: fetch dynamically from server_info in a future iteration)
    - "Preview" button → advances to step 2

    **Step 2 — Preview:**
    - Summary: "Create {base}/{quote} pool"
    - Amount details: "{baseAmount} {base} + {quoteAmount} {quote}"
    - Trading fee: "{fee}%"
    - "Confirm & Create" button (uses `useApiMutation` to POST to `/api/amm/create`)

    **POST body (CreateAmmRequest shape):**
    ```typescript
    {
      seed: walletSeed,
      amount: { currency: baseCurrency.currency, issuer: baseCurrency.issuer, value: baseAmountStr },
      amount2: { currency: quoteCurrency.currency, issuer: quoteCurrency.issuer, value: quoteAmountStr },
      tradingFee: feeUnits, // 0-1000
      network,
    }
    ```

    **Post-submit:**
    - On success: show success banner for `SUCCESS_MESSAGE_DURATION_MS`, then call `onSuccess()` and `onClose()`
    - On error: show error from API response

    **State management:**
    - `step: "form" | "preview"` for two-step flow
    - Amount inputs as strings
    - Fee input as string (percentage)
    - Use `useApiMutation` for the create call

    ## DO NOT MODIFY
    - app/components/modal-shell.tsx (shared component)
    - lib/hooks/use-api-mutation.ts (shared hook)
    - lib/ui/ui.ts (shared constants)
    - lib/xrpl/amm-fee.ts (owned by Agent B)

    ## Verification
    Run `pnpm build` to confirm the component compiles.

### I: amm-deposit-withdraw-modals
- **depends_on**: []
- **soft_depends_on**: [A]
- **creates**: [app/trade/components/amm-deposit-modal.tsx, app/trade/components/amm-withdraw-modal.tsx]
- **modifies**: []
- **deletes**: []
- **estimated_duration**: 180s
- **description**: Create deposit and withdraw modal components with mode selectors, fee warnings, and empty pool handling.
- **tdd_steps**:
    1. build-verify → "pnpm build" (React components — tested via compilation)
- **prompt**: |
    Create the AMM Deposit and Withdraw modal components.

    ## Design Reference

    Use `ModalShell` from `app/components/modal-shell.tsx` for modal wrapper.
    Use `useApiMutation` from `lib/hooks/use-api-mutation.ts` for POST calls.
    Use UI constants from `lib/ui/ui.ts`.
    Read `app/trade/components/make-market-modal.tsx` for modal patterns.

    ## Files to Create (2 files)

    ### 1. app/trade/components/amm-deposit-modal.tsx

    **Props:**
    ```typescript
    import type { AmmPoolInfo } from "@/lib/types";
    import type { CurrencyOption } from "@/lib/hooks/use-trading-data";

    interface AmmDepositModalProps {
      pool: AmmPoolInfo;
      baseCurrency: CurrencyOption;
      quoteCurrency: CurrencyOption;
      walletSeed: string;
      network: string;
      onClose: () => void;
      onSuccess: () => void;
    }
    ```

    **Mode selector** (tabs or radio buttons):
    - "Both Assets" (default) — `mode: "two-asset"`
    - "Single Asset" — `mode: "single-asset"`
    - Auto-detect empty pool: if `pool.asset1?.value === "0" && pool.asset2?.value === "0"`, force `mode: "two-asset-if-empty"` and show banner: "This pool is empty — provide both assets to re-fund it."

    **Both Assets mode:**
    - Two amount inputs (base + quote)
    - Info: "Current pool ratio: {ratio}" (calculated from pool.asset1.value / pool.asset2.value)
    - Note: "Proportional deposits incur no trading fee"

    **Single Asset mode:**
    - Asset selector dropdown (base or quote)
    - One amount input
    - Warning (amber): "Single-asset deposits incur the pool's trading fee ({pool.tradingFeeDisplay})"

    **POST body (DepositAmmRequest shape):**
    ```typescript
    {
      seed: walletSeed,
      asset: { currency: baseCurrency.currency, issuer: baseCurrency.issuer },
      asset2: { currency: quoteCurrency.currency, issuer: quoteCurrency.issuer },
      amount: { currency: selectedCurrency, issuer: selectedIssuer, value: amountStr },
      amount2: mode === "two-asset" || mode === "two-asset-if-empty"
        ? { currency: quoteCurrency.currency, issuer: quoteCurrency.issuer, value: amount2Str }
        : undefined,
      mode,
      network,
    }
    ```

    **Post-submit:** Success banner → `onSuccess()` → `onClose()`

    ### 2. app/trade/components/amm-withdraw-modal.tsx

    **Props:**
    ```typescript
    interface AmmWithdrawModalProps {
      pool: AmmPoolInfo;
      baseCurrency: CurrencyOption;
      quoteCurrency: CurrencyOption;
      walletSeed: string;
      network: string;
      onClose: () => void;
      onSuccess: () => void;
    }
    ```

    **Mode selector:**
    - "Withdraw All" (default) — `mode: "withdraw-all"`
    - "Both Assets" — `mode: "two-asset"`
    - "Single Asset" — `mode: "single-asset"`

    **Withdraw All mode:**
    - Show current LP token balance from `pool.lpToken?.value`
    - "This will redeem all your LP tokens for both pool assets"
    - One-click "Withdraw All" button

    **Both Assets mode:**
    - Two amount inputs
    - Shows LP tokens that will be burned (estimate)

    **Single Asset mode:**
    - Asset selector + one amount input
    - Fee warning (same as deposit)

    **POST body (WithdrawAmmRequest shape):**
    ```typescript
    {
      seed: walletSeed,
      asset: { currency: baseCurrency.currency, issuer: baseCurrency.issuer },
      asset2: { currency: quoteCurrency.currency, issuer: quoteCurrency.issuer },
      amount: mode !== "withdraw-all"
        ? { currency: selectedCurrency, issuer: selectedIssuer, value: amountStr }
        : undefined,
      amount2: mode === "two-asset"
        ? { currency: quoteCurrency.currency, issuer: quoteCurrency.issuer, value: amount2Str }
        : undefined,
      mode,
      network,
    }
    ```

    **Post-submit:** If response includes `poolDeleted: true`, show "Pool has been deleted" message. Then `onSuccess()` → `onClose()`.

    ## Shared patterns for both modals:
    - Use `useState` for mode, amount inputs
    - Use `useApiMutation` for POST calls
    - Show loading state on submit button (`loading ? "Submitting..." : "Confirm"`)
    - Show error from `useApiMutation`'s error state
    - Use `SUCCESS_MESSAGE_DURATION_MS` for success banner auto-clear
    - Disable submit when amounts are empty or loading

    ## DO NOT MODIFY
    - app/components/modal-shell.tsx (shared)
    - lib/hooks/use-api-mutation.ts (shared)
    - lib/types.ts (owned by Agent A)
    - Any other component files

    ## Verification
    Run `pnpm build` to confirm both modals compile.

### J: trade-page-integration
- **depends_on**: [F, G, H, I]
- **soft_depends_on**: []
- **creates**: []
- **modifies**: [app/trade/components/trade-grid.tsx, app/trade/page.tsx]
- **deletes**: []
- **estimated_duration**: 120s
- **description**: Wire AMM pool hook, panel, and modals into the trade page and grid layout.
- **tdd_steps**:
    1. build-verify → "pnpm build" (page integration — tested via compilation)
- **prompt**: |
    Integrate AMM components into the trade page.

    ## Files to Modify (2 files)

    ### 1. app/trade/page.tsx

    **Landmark**: Read the full file first. Key areas:
    - Import block: lines 1-20
    - `useTradingData` hook call: lines 63-84
    - `TradeGrid` render: lines 238-253

    **Changes:**

    a) Add imports at top:
    ```typescript
    import { useAmmPool } from "@/lib/hooks/use-amm-pool";
    ```

    b) Add `useAmmPool` hook call alongside `useTradingData` (after line 84):
    ```typescript
    // AMM pool data
    const { pool: ammPool, loading: ammLoading } = useAmmPool({
      baseCurrency: sellingCurrency?.currency,
      baseIssuer: sellingCurrency?.issuer,
      quoteCurrency: buyingCurrency?.currency,
      quoteIssuer: buyingCurrency?.issuer,
      network: state.network,
      refreshKey,
    });
    ```

    c) Add AMM modal state (near other useState calls, around line 32):
    ```typescript
    const [showCreateAmm, setShowCreateAmm] = useState(false);
    const [showDepositAmm, setShowDepositAmm] = useState(false);
    const [showWithdrawAmm, setShowWithdrawAmm] = useState(false);
    ```

    d) Pass AMM props to `TradeGrid` (add to the JSX around line 238):
    ```tsx
    <TradeGrid
      {...existingProps}
      ammPool={ammPool}
      ammLoading={ammLoading}
      onCreateAmm={() => setShowCreateAmm(true)}
      onDepositAmm={() => setShowDepositAmm(true)}
      onWithdrawAmm={() => setShowWithdrawAmm(true)}
    />
    ```

    e) Add AMM modal renders after the `MakeMarketModal` block (around line 266):
    ```tsx
    {showCreateAmm && sellingCurrency && buyingCurrency && focusedWallet && (
      <AmmCreateModal
        baseCurrency={sellingCurrency}
        quoteCurrency={buyingCurrency}
        walletSeed={focusedWallet.seed}
        network={state.network}
        onClose={() => setShowCreateAmm(false)}
        onSuccess={onRefresh}
      />
    )}
    {showDepositAmm && ammPool?.exists && sellingCurrency && buyingCurrency && focusedWallet && (
      <AmmDepositModal
        pool={ammPool}
        baseCurrency={sellingCurrency}
        quoteCurrency={buyingCurrency}
        walletSeed={focusedWallet.seed}
        network={state.network}
        onClose={() => setShowDepositAmm(false)}
        onSuccess={onRefresh}
      />
    )}
    {showWithdrawAmm && ammPool?.exists && sellingCurrency && buyingCurrency && focusedWallet && (
      <AmmWithdrawModal
        pool={ammPool}
        baseCurrency={sellingCurrency}
        quoteCurrency={buyingCurrency}
        walletSeed={focusedWallet.seed}
        network={state.network}
        onClose={() => setShowWithdrawAmm(false)}
        onSuccess={onRefresh}
      />
    )}
    ```

    f) Add modal imports at top:
    ```typescript
    import { AmmCreateModal } from "./components/amm-create-modal";
    import { AmmDepositModal } from "./components/amm-deposit-modal";
    import { AmmWithdrawModal } from "./components/amm-withdraw-modal";
    ```

    ### 2. app/trade/components/trade-grid.tsx

    **Landmark**: Read the full file first. Key areas:
    - `TradeGridProps` interface: lines 13-28
    - Left column div: lines 54-63 (contains only `RecentTrades`)

    **Changes:**

    a) Add import:
    ```typescript
    import { AmmPoolPanel } from "./amm-pool-panel";
    import type { AmmPoolInfo } from "@/lib/types";
    ```

    b) Extend `TradeGridProps` interface — add these fields:
    ```typescript
    ammPool: AmmPoolInfo | null;
    ammLoading: boolean;
    onCreateAmm: () => void;
    onDepositAmm: () => void;
    onWithdrawAmm: () => void;
    ```

    c) Destructure the new props in the function signature.

    d) Add `AmmPoolPanel` in the left column div, ABOVE `RecentTrades` (line 54-63):
    ```tsx
    {/* Left column: AMM Pool + Recent Trades */}
    <div className="space-y-6 lg:col-span-2">
      <AmmPoolPanel
        pool={ammPool}
        loading={ammLoading}
        pairSelected={pairSelected}
        onCreatePool={onCreateAmm}
        onDeposit={onDepositAmm}
        onWithdraw={onWithdrawAmm}
      />
      <RecentTrades ... />
    </div>
    ```

    The `space-y-6` class on the column div handles spacing between the panel and RecentTrades.

    ## DO NOT MODIFY
    - lib/hooks/use-amm-pool.ts (owned by Agent F)
    - app/trade/components/amm-pool-panel.tsx (owned by Agent G)
    - app/trade/components/amm-create-modal.tsx (owned by Agent H)
    - app/trade/components/amm-deposit-modal.tsx, amm-withdraw-modal.tsx (owned by Agent I)
    - app/trade/components/balances-panel.tsx (owned by Agent K)

    ## Verification
    Run `pnpm build` to confirm the full trade page compiles with all AMM integration.

### K: polish
- **depends_on**: [C, D, E, J]
- **soft_depends_on**: []
- **creates**: [scripts/test-amm.sh]
- **modifies**: [app/trade/components/balances-panel.tsx, openapi.yaml, CLAUDE.md]
- **deletes**: []
- **estimated_duration**: 140s
- **description**: Filter LP tokens from balances, update OpenAPI spec and CLAUDE.md, create test script.
- **tdd_steps**:
    1. build-verify → "pnpm build" (balances filter change — tested via compilation)
    2. build-verify → "pnpm build" (confirms no type errors from documentation-only changes)
- **prompt**: |
    Polish: LP token filtering, documentation updates, and test script.

    ## Files to Modify (3 files) + 1 New File

    ### 1. app/trade/components/balances-panel.tsx — Filter LP tokens

    **Landmark**: Line 44-45, the balances map:
    ```typescript
    <div className="mt-2 space-y-1">
      {balances.map((b, i) => {
    ```

    Add LP token filtering. Import `isLpTokenCurrency` and filter before mapping:
    ```typescript
    import { isLpTokenCurrency } from "@/lib/xrpl/lp-token";
    ```

    Change the map to filter first:
    ```tsx
    {balances
      .filter((b) => !isLpTokenCurrency(b.currency))
      .map((b, i) => {
    ```

    This hides LP tokens from the main balances panel. LP balances are shown in the AMM Pool Panel instead.

    ### 2. openapi.yaml — Add AMM endpoints

    Read the existing `openapi.yaml` first to match its structure and style.

    Add 4 new paths:
    - `GET /api/amm/info` — Query AMM pool state
      - Query params: `base_currency`, `base_issuer`, `quote_currency`, `quote_issuer`, `network`
      - Response: `AmmPoolInfo` schema
    - `POST /api/amm/create` — Create AMM pool
      - Request body: `CreateAmmRequest` schema
      - Response 201: `{ result: object }`
    - `POST /api/amm/deposit` — Deposit to AMM
      - Request body: `DepositAmmRequest` schema
      - Response 200: `{ result: object }`
    - `POST /api/amm/withdraw` — Withdraw from AMM
      - Request body: `WithdrawAmmRequest` schema
      - Response 200: `{ result: object, poolDeleted: boolean }`

    Add schema definitions for request/response types. Reference the Shared Contract (prepended above) for exact field definitions.

    ### 3. CLAUDE.md — Add AMM routes and modules

    Read the existing `CLAUDE.md` first. Add entries to:

    **API Routes table** (add after the `/api/dex/trades` row):
    ```
    | `/api/amm/info` | GET | AMM pool info for a currency pair | `test-amm.sh` |
    | `/api/amm/create` | POST | Create AMM pool | `test-amm.sh` |
    | `/api/amm/deposit` | POST | Deposit to AMM pool | `test-amm.sh` |
    | `/api/amm/withdraw` | POST | Withdraw from AMM pool | `test-amm.sh` |
    ```

    **`lib/` Module Map — XRPL Core** section (add after existing entries):
    ```
    | `lp-token.ts` | `isLpTokenCurrency()`, `formatLpTokenLabel()` — LP token detection and display |
    | `amm-fee.ts` | `formatAmmFee()`, `parseAmmFeeInput()` — AMM fee formatting |
    | `amm-helpers.ts` | `buildCurrencySpec()` — XRPL Currency spec builder for AMM |
    ```

    **UI & Hooks table** (add):
    ```
    | `hooks/use-amm-pool.ts` | `useAmmPool()` — fetches AMM pool info for selected pair |
    ```

    ### 4. scripts/test-amm.sh — Full lifecycle test

    Read `scripts/test-permissioned-dex.sh` for the reference pattern (uses `lib.sh` helpers, reads state from `examples/`, uses `curl` + `jq`).

    Also read `scripts/lib.sh` to understand available helper functions.

    **Test script flow:**
    1. Source `lib.sh` for helpers
    2. Read state from `examples/` (wallets, currencies)
    3. Query AMM info (should return `exists: false`)
    4. Create AMM pool with wallet + XRP + issued currency
    5. Query AMM info (should return `exists: true` with pool data)
    6. Deposit (two-asset mode)
    7. Query AMM info (verify updated reserves)
    8. Deposit (single-asset mode)
    9. Withdraw (single-asset mode)
    10. Withdraw all
    11. Query AMM info (should return `exists: false` — pool deleted)
    12. Report pass/fail summary

    Make the script executable. Use `set -euo pipefail`.

    **Important**: The test script hits a running dev server. Use `BASE_URL` env var defaulting to `http://localhost:3000`. Match the exact pattern from other test scripts.

    ## DO NOT MODIFY
    - lib/xrpl/lp-token.ts (owned by Agent B)
    - app/api/amm/* (owned by Agents C, D, E)
    - app/trade/* (owned by Agents G, H, I, J)

    ## Verification
    Run `pnpm build` to confirm the balances filter compiles.
    Run `chmod +x scripts/test-amm.sh` to make the test script executable.

## DAG Visualization

```
        ┌──→ D ────────────────────────┐
A ───┬──┤                              │
     │  ├──→ C ────────────────────────┤
     │  │    ↑                         │
B ───┼──┘    │                         │
     └──────→ E ───────────────────────┤
                                       │
A ··→ F ──┐                            │
A ··→ G ──┼──→ J ─────────────────────→ K
A ··→ H ──┤
A ··→ I ──┘
```

Legend: `──→` hard dependency, `··→` soft dependency

## Pre-Execution Verification

```bash
pnpm build          # Verify project compiles before any changes
pnpm lint --help    # Verify lint is available
```

## Required Bash Permissions

```bash
pnpm build              # Bash(pnpm build)
pnpm lint               # Bash(pnpm lint)
chmod +x scripts/*      # Bash(chmod +x scripts/*)
```

## Critical Path Estimate

| Path | Agents | Estimated Wall-Clock |
|------|--------|---------------------|
| A → I → J → K | A(45s) + I(180s) + J(120s) + K(140s) | ~485s |
| B → E → K | B(85s) + E(135s) + K(140s) | ~360s |
| A → D → K | A(45s) + D(80s) + K(140s) | ~265s |

Total sequential estimate: ~1165s
Parallel estimate: ~485s (critical path)
Speedup: ~2.4x

## Integration Tests

1. **AMM info route returns normalized spotPrice**: Create a pool via `POST /api/amm/create`, then query `GET /api/amm/info` with the same pair in both orientations (base/quote swapped) — verify `spotPrice` is the inverse and `asset1`/`asset2` are normalized to match the query.

2. **Trade page renders AMM panel and modals**: Load `/trade`, select a currency pair → verify AmmPoolPanel renders in the left column above RecentTrades. If no pool exists, "Create Pool" button appears. Click it → verify AmmCreateModal opens.

3. **LP tokens filtered from balances**: After depositing to an AMM pool, refresh balances → verify LP tokens (0x03 prefix currencies) do NOT appear in the BalancesPanel but pool info shows LP balance in the AmmPoolPanel.

## Verification

After all agents complete:

1. `pnpm build` — full production build succeeds
2. `pnpm lint` — no new lint errors
3. Manual smoke test: start `pnpm dev`, navigate to `/trade`, select a currency pair, create a pool, deposit, withdraw
4. `scripts/test-amm.sh` — full lifecycle test passes against running dev server
5. Verify `openapi.yaml` has all 4 new AMM endpoints
6. Verify `CLAUDE.md` has updated API Routes and Module Map tables

## Review Notes

- [ ] AMMCreate cost is displayed as static "~0.2 XRP" rather than dynamically fetched via `server_info`. The user confirmed dynamic lookup, but adding a new API endpoint for `server_info` increases scope. The transaction itself uses the correct fee via xrpl.js autofill — the display is informational only. Recommend adding dynamic lookup as a fast follow-up.
- [ ] Agent I (180s estimated) is the largest agent and sits on the critical path. Consider splitting into I1 (deposit modal) and I2 (withdraw modal) if execution time is a concern. Kept merged because they share significant patterns and J depends on both.
- [ ] Frozen asset flag normalization in Agent C: when the amm_info response assets are in different order than the user's base/quote, the `assetFrozen`/`asset2Frozen` flags should also be swapped. The prompt notes this but it's an easy detail to miss.

## Execution State

_This section is managed by `/execute-parallel-plan`. Do not edit manually._

| Agent | Status | Agent ID | Duration | Notes |
|-------|--------|----------|----------|-------|
| A | pending | — | — | |
| B | pending | — | — | |
| C | pending | — | — | blocked by: A, B |
| D | pending | — | — | blocked by: A |
| E | pending | — | — | blocked by: A, B |
| F | pending | — | — | soft-blocked by: A |
| G | pending | — | — | soft-blocked by: A |
| H | pending | — | — | soft-blocked by: A |
| I | pending | — | — | soft-blocked by: A |
| J | pending | — | — | blocked by: F, G, H, I |
| K | pending | — | — | blocked by: C, D, E, J |

Started: —
Last updated: —
Build: not yet run
