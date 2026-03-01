<!-- scan-metadata
agent: processing-flows
commit: 14d3ca5
branch: claude/branch-off-web-session-ueID3
date: 2026-03-01
-->

# Processing Flows

## Overview

The XRPL Issued Currencies Manager is a full-stack application for managing the complete lifecycle of issued currencies on the XRP Ledger. The business domain spans five major areas: wallet management, currency issuance, peer-to-peer transfers, DEX trading (including AMM and permissioned DEX), and compliance (credentials + permissioned domains). All persistent state lives on the XRP Ledger itself; the application stores wallet credentials in browser localStorage and uses API routes as thin wrappers around XRPL WebSocket commands. Every mutation follows a consistent pattern: validate inputs server-side, construct an XRPL transaction, submit via `client.submitAndWait()`, check the transaction result, and return success or a domain-specific error message.

## Key Findings

1. **Two-phase "Receive Currency" workflow**: The `WalletSetupModal` orchestrates a two-step XRPL flow -- first creating a trust line (TrustSet), then issuing currency (Payment from issuer). The trust line step is automatically skipped if it already exists on-ledger. This is the only multi-transaction workflow exposed through the UI.

2. **Rippling repair is a hidden multi-transaction operation**: The `/api/accounts/[address]/rippling` endpoint does more than set `DefaultRipple`. It also iterates through all existing trust lines and clears `NoRipple` on each one individually, because `DefaultRipple` only affects *future* trust lines. A single API call can submit N+1 transactions.

3. **Trade data uses the issuer's `account_tx` as a global trade feed**: The `/api/dex/trades` endpoint queries the *issuer's* transaction history (not any specific trader), because all issued currency movements touch the issuer's RippleState entries. This gives a complete view of all trades for a currency pair regardless of who placed them.

4. **Interleaved CLOB + AMM fill estimation**: The `estimateFillCombined()` function walks CLOB order book levels and the AMM constant-product curve simultaneously, always consuming from whichever source offers the better price. This supports the trade form's slippage estimation.

5. **Polling with visibility-gating and expiration timers**: The trade page uses `usePollInterval` (3-second interval) gated on page visibility via the Page Visibility API, plus `useOfferExpirationTimers` that schedules a targeted refresh when the nearest offer is about to expire (within 5 minutes). Reactive fill detection also watches for new trade hashes involving the current user.

6. **Permissioned DEX flows use a separate book_offers path**: When a `domain` parameter is present, the orderbook endpoint falls back to raw `book_offers` with a domain filter instead of `client.getOrderbook()`, because the SDK's high-level method does not support the domain parameter.

7. **Frontend state is per-network**: `AppStateProvider` stores wallet data separately per network (`xrpl-manager-state-testnet` vs `xrpl-manager-state-devnet`), with automatic migration from an older single-key format. Network switching re-keys all localStorage reads.

## Core Workflows

### 1. Wallet Generation & Account Setup

**Trigger**: User clicks "Generate Issuer Wallet" or "Generate Recipient" on `/setup`, or "Generate" on `/compliance`.

**Steps**:
1. Frontend calls `POST /api/accounts/generate` with `{ network, isIssuer? }`.
2. API route (`app/api/accounts/generate/route.ts`) generates a random `Wallet` via `Wallet.generate()`.
3. Funds the wallet via `client.fundWallet(wallet, { amount: "1000" })` using the network's faucet.
4. If `isIssuer: true`, submits an `AccountSet` transaction with `asfDefaultRipple` flag to enable rippling.
5. Returns `{ address, seed, publicKey, balance }` with status 201.
6. Frontend stores wallet info in `AppStateContext` -> localStorage.

**Error handling**: If `DefaultRipple` AccountSet fails, returns 422 with the specific `TransactionResult`. Faucet failures propagate as 500.

**Code**: `app/api/accounts/generate/route.ts`, `app/setup/components/issuer-setup.tsx`

### 2. Account Re-funding

**Trigger**: User clicks "Fund from Faucet" on any wallet card.

**Steps**:
1. Frontend calls `POST /api/accounts/[address]/fund` with `{ network }`.
2. API route (`app/api/accounts/[address]/fund/route.ts`) looks up the network's faucet URL from `NETWORKS`.
3. If no faucet exists (mainnet), returns 400.
4. Makes an HTTP POST to the faucet endpoint with `{ destination: address }`.
5. Returns `{ address, amount }` on success.

**Error handling**: Faucet HTTP errors return 502 with the faucet's error text.

**Code**: `app/api/accounts/[address]/fund/route.ts`, `app/setup/components/recipient-card.tsx`, `app/setup/components/issuer-setup.tsx`

### 3. Trust Line Creation

**Trigger**: User clicks "Set Up" in `WalletSetupModal`, "Trust RLUSD", or "Add Custom Trust Line" on `/setup`.

**Steps**:
1. Frontend calls `POST /api/accounts/[address]/trustlines` with `{ seed, currency, issuer, limit, network }`.
2. API route (`app/api/accounts/[address]/trustlines/route.ts`) validates required fields, derives wallet from seed, verifies seed matches URL address.
3. Encodes currency code via `encodeXrplCurrency()` (handles 3-char standard, 4-20 char non-standard, or 40-char pre-encoded hex).
4. Submits `TrustSet` transaction with `{ currency, issuer, value: limit }`.
5. Returns the transaction result with status 201.

**Business rule**: Default trust line limit is `"1000000"` (from `DEFAULT_TRUST_LINE_LIMIT`).

**Code**: `app/api/accounts/[address]/trustlines/route.ts`, `app/setup/components/wallet-setup-modal.tsx`

### 4. Currency Issuance (Issuer -> Recipient Payment)

**Trigger**: User clicks "Set Up" or "Issue More" in `WalletSetupModal` on `/setup` (after trust line step).

**Steps**:
1. Frontend calls `POST /api/currencies/issue` with `{ issuerSeed, recipientAddress, currencyCode, amount, network }`.
2. API route (`app/api/currencies/issue/route.ts`) validates all fields, derives issuer wallet from seed.
3. **Trust line prerequisite check**: Queries `account_lines` for the recipient, filtered to the issuer peer. Checks if a trust line exists for the encoded currency. Returns 400 if missing.
4. Constructs a `Payment` transaction from issuer to recipient with the issued currency amount.
5. Submits via `submitAndWait()` and checks result.

**Business rule**: The issuer is both the sender and the `issuer` field in the `Amount` object. This is what makes it an issuance rather than a transfer.

**Code**: `app/api/currencies/issue/route.ts`, `app/setup/components/wallet-setup-modal.tsx`

### 5. Currency Transfer (Peer-to-Peer Payment)

**Trigger**: User clicks "Send" on `/transact` page and submits the transfer modal form.

**Steps**:
1. Frontend (`app/transact/components/transfer-modal.tsx`) loads sender balances via `useBalances()`.
2. User selects currency, amount, and recipient.
3. `useTrustLineValidation()` hook runs async checks:
   - Fetches recipient's trust lines to verify a matching trust line exists.
   - If trust line exists and sender is not the issuer, fetches issuer's `account_info` to check the `lsfDefaultRipple` flag.
   - Skips checks for XRP transfers and burns (sending back to issuer).
4. On submit, calls `POST /api/transfers` with `{ senderSeed, recipientAddress, currencyCode, amount, issuerAddress?, network }`.
5. API route (`app/api/transfers/route.ts`) constructs a `Payment` transaction.
   - For XRP: uses `xrpToDrops()` to convert amount to drops string.
   - For issued currencies: requires `issuerAddress` and uses the object `Amount` form.
6. Submits and checks result against a detailed `tecMessages` map providing user-friendly errors for `tecPATH_DRY`, `tecNO_LINE`, `tecUNFUNDED_PAYMENT`, etc.

**Business rules**:
- `issuerAddress` is required for non-XRP transfers.
- The transfer route has the richest error message mapping in the codebase (11 `tec` codes).
- Frontend prevents submission when trust line or rippling checks fail.

**Code**: `app/api/transfers/route.ts`, `app/transact/components/transfer-modal.tsx`, `lib/hooks/use-trust-line-validation.ts`

### 6. Enable/Repair Rippling

**Trigger**: User clicks "Enable Rippling" or "Repair Trust Lines" on the issuer setup card.

**Steps**:
1. Frontend calls `POST /api/accounts/[address]/rippling` with `{ seed, network }`.
2. API route (`app/api/accounts/[address]/rippling/route.ts`):
   a. Submits `AccountSet` with `asfDefaultRipple` flag.
   b. Queries `account_lines` to find all trust lines with `no_ripple: true`.
   c. For each such trust line, submits a `TrustSet` transaction with `TF_CLEAR_NO_RIPPLE` (0x00040000) flag.
3. Returns `{ message: "Rippling enabled", trustLinesUpdated: N }`.

**Business rule**: `DefaultRipple` only affects *newly created* trust lines. Existing trust lines retain their `NoRipple` flag and must be individually repaired. The frontend detects the "needs_repair" state by checking both the account's `DefaultRipple` flag and scanning trust lines for any with `no_ripple: true`.

**Code**: `app/api/accounts/[address]/rippling/route.ts`, `app/setup/components/issuer-setup.tsx`

### 7. DEX Order Placement

**Trigger**: User submits the trade form on `/trade` page.

**Steps**:
1. Frontend (`app/trade/components/trade-form.tsx`) collects: amount, price, execution type, flags, expiration, domain ID.
2. Calculates `total = amount * price`.
3. Constructs `takerGets` and `takerPays` based on buy/sell side:
   - **Buy**: `takerGets` = quote currency (total), `takerPays` = base currency (amount).
   - **Sell**: `takerGets` = base currency (amount), `takerPays` = quote currency (total).
4. Calls `POST /api/dex/offers` with `{ seed, takerGets, takerPays, flags?, expiration?, offerSequence?, domainID?, network }`.
5. API route (`app/api/dex/offers/route.ts`) performs extensive validation:
   - Both sides must have currency + value.
   - Non-XRP currencies require issuer.
   - Values must be positive.
   - Expiration must be positive integer.
   - Flags validated against `VALID_OFFER_FLAGS` (passive, immediateOrCancel, fillOrKill, sell, hybrid).
6. Resolves flags to bitwise values via `resolveOfferFlags()`.
7. Converts amounts via `toXrplAmount()` (XRP -> drops, issued -> object form).
8. Submits `OfferCreate` transaction.

**Offer flags**: `passive` prevents matching against existing orders. `immediateOrCancel` cancels any unfilled portion. `fillOrKill` cancels the entire order if it cannot be fully filled. `sell` sells the specified amount regardless of price improvement. `hybrid` (permissioned DEX only) allows orders to match in both permissioned and open books.

**Code**: `app/api/dex/offers/route.ts`, `app/trade/components/trade-form.tsx`, `lib/xrpl/offers.ts`

### 8. DEX Order Cancellation

**Trigger**: User clicks cancel on an open offer in the orders section on `/trade`.

**Steps**:
1. Frontend calls `POST /api/dex/offers/cancel` with `{ seed, offerSequence, network }`.
2. API route submits `OfferCancel` transaction with the offer's sequence number.

**Code**: `app/api/dex/offers/cancel/route.ts`, `app/trade/page.tsx` (handleCancel)

### 9. Make Market (Batch Order Placement)

**Trigger**: User opens "Make Market" modal on `/trade` and configures a multi-level bid/ask ladder.

**Steps**:
1. `MakeMarketModal` generates a list of `MakeMarketOrder[]` with side (Bid/Ask), price, qty, and wallet.
2. `useMakeMarketExecution()` hook processes orders sequentially:
   - For each order, builds `takerGets` and `takerPays` using `buildDexAmount()`.
   - Calls `POST /api/dex/offers` for each order.
   - Tracks progress (`current/total`), counts successes/failures.
   - Refreshes data after each successful order and at the end.
3. Shows result summary (e.g., "6/6 placed" or "5/6 placed" with first error).

**Business rule**: Orders are placed sequentially (not in parallel) because each requires a unique sequence number from the ledger.

**Code**: `lib/hooks/use-make-market-execution.ts`, `app/trade/components/make-market-modal.tsx`

### 10. Order Book Retrieval

**Trigger**: Currency pair selected on `/trade` page; auto-refreshes every 3 seconds.

**Steps**:
1. Frontend (`useTradingData`) calls `GET /api/dex/orderbook` with `base_currency`, `base_issuer`, `quote_currency`, `quote_issuer`, `network`, and optional `domain`.
2. API route (`app/api/dex/orderbook/route.ts`):
   - For **open DEX**: uses `client.getOrderbook()` which handles pagination and quality sorting.
   - For **permissioned DEX** (domain present): uses raw `book_offers` with domain parameter for both sides.
   - Has a dedicated mainnet client singleton (`getMainnetClient()`) for mainnet orderbook queries.
3. Normalizes offers via `normalizeOffer()` (converts XRPL Amounts to DexAmount format).
4. Builds priced ask and bid levels via `buildAsks()`/`buildBids()` from `order-book-levels.ts`.
5. Aggregates depth via `aggregateDepth()`.
6. Computes midprice metrics: mid, micro-price (volume-weighted at top of book), weighted VWAP, spread, spread in bps.
7. Returns `{ base, quote, buy, sell, depth, midprice }` with 3-second cache headers.

**Code**: `app/api/dex/orderbook/route.ts`, `lib/xrpl/order-book-levels.ts`, `lib/xrpl/midprice.ts`, `lib/xrpl/aggregate-depth.ts`

### 11. Recent Trades Retrieval

**Trigger**: Currency pair selected on `/trade` page; auto-refreshes every 3 seconds.

**Steps**:
1. Frontend calls `GET /api/dex/trades` with currency pair params and optional `domain`.
2. API route (`app/api/dex/trades/route.ts`):
   - Determines the issuer account (for the non-XRP side of the pair).
   - Queries `account_tx` for the issuer with `limit * TRADES_FETCH_MULTIPLIER` (5x over-fetch).
   - Iterates through transactions, filtering for successful `OfferCreate`.
   - **Domain filtering**: if domain specified, only includes trades with matching `DomainID`; otherwise excludes trades with any `DomainID`.
   - Uses `getBalanceChanges()` from xrpl.js to extract actual executed amounts.
   - Sums positive balance changes for base and quote across non-issuer accounts.
   - Subtracts transaction fee when XRP is the traded currency and the account is the submitter.
   - Skips offers that merely rested (no execution on both sides).
   - Determines buy/sell side by comparing `TakerPays` currency to the base currency.
   - Computes price as `quoteTotal / baseTotal`.

**Business rule**: The fee subtraction is critical for accurate XRP trade amounts. Without it, the transaction fee (in XRP) would inflate the apparent trade size.

**Code**: `app/api/dex/trades/route.ts`, `lib/xrpl/match-currency.ts`

### 12. Filled Orders (User's Own Trade History)

**Trigger**: Currency pair selected on `/trade` page.

**Steps**:
1. Frontend calls `GET /api/accounts/[address]/filled-orders` with currency pair params.
2. API route uses `parseFilledOrders()` from `lib/xrpl/filled-orders.ts`.
3. Logic is nearly identical to trades retrieval but:
   - Queries the *user's* `account_tx` (not the issuer's).
   - Only includes transactions where `Account === walletAddress`.
   - Skips both base and quote issuer accounts when summing balance changes.

**Code**: `app/api/accounts/[address]/filled-orders/route.ts`, `lib/xrpl/filled-orders.ts`

### 13. AMM Pool Operations

#### 13a. AMM Info

**Trigger**: Currency pair selected on `/trade` page; `useAmmPool` hook fetches automatically.

**Steps**:
1. Calls `GET /api/amm/info` with currency pair params.
2. API route (`app/api/amm/info/route.ts`) calls `amm_info` XRPL command.
3. Determines if response asset order matches query base/quote (the ledger may return them swapped).
4. Computes: spot price (Q/B), inverted spot price, effective price (accounting for fee), marginal buy/sell prices from AMM math.
5. If no AMM exists, `amm_info` throws; caught and returns `{ exists: false }`.

**Code**: `app/api/amm/info/route.ts`, `lib/xrpl/amm-math.ts`, `lib/xrpl/amm-fee.ts`

#### 13b. AMM Create

**Trigger**: User clicks "Create Pool" on `/trade` page.

**Steps**:
1. Frontend opens `AmmCreateModal`, user specifies amounts for both assets and trading fee.
2. Calls `POST /api/amm/create` with `{ seed, amount, amount2, tradingFee, network }`.
3. API validates: both amounts positive, issuers present for non-XRP, `tradingFee` is integer 0-1000.
4. Submits `AMMCreate` transaction.
5. Has a rich error map (`AMM_CREATE_ERRORS`) for 11 specific error codes.

**Business rule**: Trading fee uses units of 1/100,000 (so 300 = 0.30%, max 1000 = 1.00%).

**Code**: `app/api/amm/create/route.ts`, `app/trade/components/amm-create-modal.tsx`

#### 13c. AMM Deposit

**Trigger**: User clicks "Deposit" on the AMM pool panel.

**Steps**:
1. Calls `POST /api/amm/deposit` with `{ seed, asset, asset2, amount?, amount2?, mode, network }`.
2. Mode determines the deposit flag: `"two-asset"`, `"single-asset"`, `"two-asset-if-empty"`.
3. Validates mode-specific requirements (e.g., `two-asset` requires both amounts).
4. Submits `AMMDeposit` transaction.

**Code**: `app/api/amm/deposit/route.ts`, `app/trade/components/amm-deposit-modal.tsx`

#### 13d. AMM Withdraw

**Trigger**: User clicks "Withdraw" on the AMM pool panel.

**Steps**:
1. Calls `POST /api/amm/withdraw` with `{ seed, asset, asset2, amount?, amount2?, mode, network }`.
2. Mode determines the withdraw flag: `"withdraw-all"`, `"two-asset"`, `"single-asset"`.
3. After `withdraw-all`, checks if pool was deleted by attempting `amm_info`; returns `{ poolDeleted: true }` if so.

**Code**: `app/api/amm/withdraw/route.ts`, `app/trade/components/amm-withdraw-modal.tsx`

### 14. Credential Lifecycle (XLS-70)

#### 14a. Create Credential

**Trigger**: User submits "Issue Credential" form on `/compliance`.

**Steps**:
1. Calls `POST /api/credentials/create` with `{ seed, subject, credentialType, expiration?, uri?, network }`.
2. API validates subject address, credential type length (max 128 chars), URI length (max 256 bytes).
3. Encodes credential type to hex via `encodeCredentialType()` (UTF-8 -> hex, unlike currencies which use padded 40-char format).
4. Encodes URI to hex if present.
5. Submits `CredentialCreate` transaction.

**Code**: `app/api/credentials/create/route.ts`, `app/compliance/components/issue-credential-form.tsx`

#### 14b. Accept Credential

**Trigger**: Recipient clicks "Accept" on a pending credential in `/compliance`.

**Steps**:
1. Calls `POST /api/credentials/accept` with `{ seed, issuer, credentialType, network }`.
2. Submits `CredentialAccept` transaction (the subject's wallet signs this).

**State transition**: Credential moves from `Pending` (no `LSF_ACCEPTED` flag) to `Accepted` (`LSF_ACCEPTED` flag set).

**Code**: `app/api/credentials/accept/route.ts`, `app/compliance/components/recipient-credentials.tsx`

#### 14c. Delete Credential

**Trigger**: User clicks "Delete" on a credential in `/compliance`.

**Steps**:
1. Calls `POST /api/credentials/delete` with `{ seed, subject?, issuer?, credentialType, network }`.
2. At least one of `subject` or `issuer` is required.
3. Submits `CredentialDelete` transaction.

**Business rule**: Either the issuer or the subject can delete a credential. The signer's address determines the role.

**Code**: `app/api/credentials/delete/route.ts`, `app/compliance/components/recipient-credentials.tsx`, `app/compliance/components/issued-credentials-table.tsx`

### 15. Permissioned Domain Lifecycle (XLS-80)

#### 15a. Create/Update Domain

**Trigger**: User submits "Create Domain" or "Edit Domain" form on `/compliance`.

**Steps**:
1. Calls `POST /api/domains/create` with `{ seed, acceptedCredentials, domainID?, network }`.
2. API validates: at least 1 credential, at most 10 credentials (`MIN_DOMAIN_CREDENTIALS`, `MAX_DOMAIN_CREDENTIALS`).
3. Validates each credential's issuer address and credential type.
4. Encodes credential types to hex.
5. Submits `PermissionedDomainSet` transaction. If `domainID` is present, it's an update.
6. Extracts the new `DomainID` from `CreatedNode` in transaction metadata (for new domains).

**Code**: `app/api/domains/create/route.ts`, `app/compliance/components/create-domain-form.tsx`

#### 15b. Delete Domain

**Trigger**: User clicks "Delete" on a domain in `/compliance`.

**Steps**:
1. Calls `POST /api/domains/delete` with `{ seed, domainID, network }`.
2. Validates `domainID` is a 64-character hex string.
3. Submits `PermissionedDomainDelete` transaction.

**Code**: `app/api/domains/delete/route.ts`, `app/compliance/components/domains-list.tsx`

### 16. Permissioned DEX Trading

**Trigger**: User selects a domain on `/trade` page via `DomainSelector`.

**Steps**:
1. `useDomainMode()` hook manages domain selection state (open/select/custom).
2. When a domain is active, all trading data fetches include the `domain` parameter.
3. Order book uses raw `book_offers` with domain instead of `client.getOrderbook()`.
4. Recent trades filter by `DomainID` on each transaction.
5. Offer placement includes `domainID` in the `OfferCreate` payload.
6. The `hybrid` flag option appears only when a domain is active, allowing orders to match in both permissioned and open books.

**Code**: `lib/hooks/use-domain-mode.ts`, `app/trade/page.tsx`, `app/api/dex/orderbook/route.ts`, `app/api/dex/trades/route.ts`

## Business Rules

### Currency Code Encoding (`lib/xrpl/currency.ts`)
- 3-char alphanumeric: pass through as standard XRPL currency code.
- 4-20 chars: hex-encode and right-pad to 40 hex chars.
- Exactly 40 hex chars: pass through as pre-encoded.
- `< 3` or `21-39` chars: rejected (cannot fit in XRPL's 20-byte currency field).
- LP token currency codes start with byte `0x03` and are decoded to "LP Token".

### Amount Conversions (`lib/xrpl/currency.ts`)
- XRP values are always converted to/from drops (1 XRP = 1,000,000 drops).
- `dropsToXrp()` returns a number, always wrapped with `String()` for type safety.
- Issued currencies use the object form `{ currency, issuer, value }`.

### AMM Math (`lib/xrpl/amm-math.ts`)
- Constant-product model: `B * Q = k` where B = base reserves, Q = quote reserves.
- Trading fee is applied to the input asset: fee rate = `tradingFee / 100,000`.
- Marginal buy price: `Q*B / ((B - consumed)^2 * (1-f))`.
- Marginal sell price: `Q*B*(1-f) / (B + consumed*(1-f))^2`.
- AMM consumption capped at 99% of reserves to avoid the asymptote.

### Fill Estimation (`lib/xrpl/estimate-fill-combined.ts`)
- Interleaves CLOB levels and AMM curve, always consuming from the cheaper source.
- For buys, "better" = lower price; for sells, "better" = higher price.
- Computes: average price, worst price, slippage (vs midprice), filled amount, total cost, CLOB/AMM split.

### Midprice Metrics (`lib/xrpl/midprice.ts`)
- Mid = (bestAsk + bestBid) / 2.
- Micro-price = volume-weighted at top of book (best bid weighted by ask volume and vice versa).
- Weighted mid = VWAP across all levels.
- Spread = bestAsk - bestBid; spreadBps = spread / mid * 10,000.

### Order Book Level Construction (`lib/xrpl/order-book-levels.ts`)
- Uses funded amounts (`taker_gets_funded`, `taker_pays_funded`) when available, falling back to stated amounts.
- Drops offers with zero funded value (unfunded offers).
- Ask price = total / amount (quote per base). Bid price = total / amount.
- Both asks and bids sorted descending by price.

### Validation Rules (`lib/api.ts`)
- Addresses validated via `isValidClassicAddress()` from xrpl.js.
- Seed/wallet derivation failures return "Invalid seed format" (400).
- Seed-to-address mismatch returns "Seed does not match the account address in the URL" (400).
- Credential types limited to 128 characters.
- Positive amounts enforced via `Number.isFinite() && > 0`.
- Currency pairs require issuer for non-XRP currencies.

### Rate Limiting (`proxy.ts`, `lib/rate-limit.ts`)
- Token-bucket algorithm per IP + method + pathname.
- Three tiers: STRICT (5/min for wallet generation), MODERATE (15/min for POSTs), RELAXED (60/min for GETs).
- Stale buckets evicted after 10 minutes of inactivity.
- Returns 429 with `Retry-After` header when limit exceeded.

## Error & Recovery Flows

### Transaction Failure Pattern
All mutation routes follow a uniform pattern via `txFailureResponse()` in `lib/api.ts`:
1. Submit transaction via `client.submitAndWait()`.
2. Extract `TransactionResult` from metadata.
3. If not `tesSUCCESS`:
   - Look up the result code in a route-specific `errorMap` (if provided).
   - Return `{ error: friendlyMessage, code: tecCode, result: fullResult }` with status 422.
   - If no friendly message exists, return `"Transaction failed: {tecCode}"`.

### Domain-Specific Error Maps
- **Transfers** (`app/api/transfers/route.ts`): 11 `tec` codes mapped to user-friendly messages (tecPATH_DRY, tecNO_LINE, tecUNFUNDED_PAYMENT, etc.).
- **AMM Create** (`app/api/amm/create/route.ts`): 11 codes including tecDUPLICATE, tecAMM_UNFUNDED, terNO_RIPPLE.
- **AMM Deposit** (`app/api/amm/deposit/route.ts`): 8 codes including tecAMM_EMPTY, tecAMM_FAILED.
- **AMM Withdraw** (`app/api/amm/withdraw/route.ts`): 9 codes including tecAMM_BALANCE, tecAMM_INVALID_TOKENS.

### Catch-All Error Handler
`apiErrorResponse()` in `lib/api.ts`:
- Extracts error message from Error or converts to string.
- When `checkNotFound: true`, returns 404 for `actNotFound` errors (account not on ledger).
- Otherwise returns 500.

### Frontend Error Handling
- `useApiMutation` sets `error` state on non-OK responses or network failures.
- `useApiFetch` sets `error` state and stops loading on failures.
- Transfer modal displays trust line and rippling validation errors inline before submission.
- Trade form displays per-submission errors.
- Make-market execution tracks first error across a batch.

### XRPL Client Recovery (`lib/xrpl/client.ts`)
- Singleton pattern: one client per network, reused across requests.
- On reconnect failure: logs warning, creates new client.
- On network switch: disconnects old client, creates new one.

## Gotchas

1. **Trust line prerequisite is server-validated for issuance but only client-warned for transfers**: The `/api/currencies/issue` route actively queries `account_lines` and rejects if no trust line exists. The `/api/transfers` route does not -- it relies on the XRPL itself to return `tecPATH_DRY` or `tecNO_LINE`. The frontend's `useTrustLineValidation` provides a pre-flight warning but does not prevent submission if the async check hasn't completed.

2. **`DefaultRipple` does not retroactively fix existing trust lines**: This is the core reason the rippling endpoint needs to iterate and clear `NoRipple` on each existing trust line individually. The frontend surfaces this as a "Repair Trust Lines" button when it detects the discrepancy.

3. **Offer side semantics are inverted from user perspective**: On the XRPL, `TakerGets` is what the order *creator* is offering and the taker receives. For a "buy base" order, the creator offers quote currency (`TakerGets = quote`) and wants base (`TakerPays = base`). This inversion is handled in `trade-form.tsx` and `make-market-modal.tsx`.

4. **5x over-fetching for trade history**: Both `/api/dex/trades` and `/api/accounts/[address]/filled-orders` use `TRADES_FETCH_MULTIPLIER = 5` when fetching `account_tx`, because most transactions won't match the requested currency pair. This is a heuristic -- for rarely-traded pairs, fewer trades may be returned than the requested limit.

5. **Mainnet orderbook uses a separate client singleton**: The `/api/dex/orderbook` route maintains its own dedicated mainnet WebSocket client (`mainnetClient`) separate from the `getClient()` singleton. This is because `getClient()` is designed for testnet/devnet, and the orderbook supports mainnet for viewing real market data.

6. **AMM pool response may have swapped asset order**: The `amm_info` XRPL command may return `amount` and `amount2` in a different order than the query's base/quote. The API route detects this by comparing `amount1.currency` against `baseCurrency` and swaps accordingly.

7. **Domain ID validation uses uppercase-only hex regex**: The `DOMAIN_ID_REGEX` pattern is `/^[0-9A-F]{64}$/` (uppercase only). Domain IDs that come back from the ledger are uppercase, but manual input could fail if the user types lowercase.

8. **Credential type encoding differs from currency encoding**: Currency codes use 40-char padded hex format. Credential types use raw UTF-8 -> hex encoding with no padding. These are handled by separate functions (`encodeXrplCurrency` vs `encodeCredentialType`).

9. **Frontend state migration from old format**: `AppStateProvider` includes a one-time migration from the old `xrpl-manager-state` single-key format to the per-network `xrpl-manager-state-{network}` format. The old key is deleted after migration.

10. **Poll interval is visibility-gated**: `usePollInterval` stops polling when the browser tab is hidden (Page Visibility API). This prevents unnecessary WebSocket traffic for background tabs. Combined with the in-flight guard (`inFlightRef`), it prevents request pileup if the ledger is slow to respond.

## Scan Limitations

- **Test scripts** (`scripts/`) were not read. They contain end-to-end curl-based tests that may document additional edge cases or expected behaviors.
- **AMM modal components** (`amm-create-modal.tsx`, `amm-deposit-modal.tsx`, `amm-withdraw-modal.tsx`) were not read in full -- their structure was inferred from the API routes they call and the hooks they use.
- **`make-market-modal.tsx`** component was not fully read; the order generation logic (price ladder construction) was inferred from the execution hook.
- **OpenAPI spec** (`openapi.yaml`) was not read -- it may contain additional documentation of request/response schemas.
- The **`docs/claude-learnings/`** directory was not consulted as it is outside this agent's output scope.
- **Test files** (`amm-math.test.ts`, `estimate-fill.test.ts`, `estimate-fill-combined.test.ts`, `midprice.test.ts`) were not read; they likely contain edge case documentation.
