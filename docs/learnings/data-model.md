<!-- scan-metadata
agent: data-model
commit: 14d3ca5
branch: claude/branch-off-web-session-ueID3
date: 2026-03-01
-->

# Data Model

## Overview

The application defines **29 TypeScript interfaces/types** and **2 union types** across its data model, split between server-side API contracts (`lib/xrpl/types.ts`), shared frontend/backend types (`lib/types.ts`), component-local types in `app/`, and an OpenAPI 3.0.3 spec (`openapi.yaml`). There is **no database** -- all persistent state comes from two sources:

1. **XRP Ledger** (authoritative): Account balances, trust lines, offers, credentials, domains, AMM pools, and transaction history are queried live from testnet/devnet WebSocket endpoints.
2. **Browser localStorage** (client-side only): Wallet seeds, selected network, registered currencies, and recipient lists are persisted per-network under `xrpl-manager-state-{network}` keys.

Key relationship count: 6 core entity domains (Wallets, Currencies/Balances, DEX Offers, Credentials, Domains, AMM Pools) with cross-cutting types for amounts (`DexAmount`, `OrderBookAmount`, `CurrencyBalance`, `BalanceEntry`) serving as the connective tissue.

## Key Findings

1. **Dual amount representations**: The codebase maintains separate-but-isomorphic amount types for different contexts: `DexAmount` (API request/response for DEX), `OrderBookAmount` (order book display), `CurrencyBalance` (ledger query results), and `BalanceEntry` (frontend balance display). All share the same `{currency, value, issuer?}` shape but are defined independently, creating implicit structural subtyping rather than explicit inheritance.

2. **Currency encoding is asymmetric**: Encoding (`encodeXrplCurrency`) is Node-only (uses `Buffer`) while decoding (`decodeCurrency`) is browser-safe (pure string manipulation). This split is enforced by separate files: `lib/xrpl/currency.ts` (server) vs `lib/xrpl/decode-currency-client.ts` (client). LP tokens (prefix `0x03`) are special-cased to decode as "LP Token" rather than attempting ASCII interpretation.

3. **Credential types use raw hex, currencies use padded hex**: Credential type encoding (`encodeCredentialType`) produces variable-length uppercase hex from UTF-8. Currency encoding (`encodeXrplCurrency`) pads to exactly 40 hex chars (20 bytes) for non-standard codes. These are fundamentally different encoding schemes for the same ledger.

4. **PersistedState underwent a storage migration**: The app migrated from a single `xrpl-manager-state` localStorage key to per-network keys (`xrpl-manager-state-testnet`, `xrpl-manager-state-devnet`). A one-time migration in `use-app-state.tsx` reads the old key, splits it by network, and deletes the legacy key.

5. **Wallet seeds transit through API request bodies**: Despite the "client-side only" design principle, seeds are sent to API routes in POST request bodies (e.g., `IssueCurrencyRequest.issuerSeed`, `CreateOfferRequest.seed`) for transaction signing. The seeds never persist server-side but do cross the network boundary.

6. **XRPL time uses a custom epoch**: The Ripple epoch starts 2000-01-01 (offset `946684800` seconds from Unix epoch). Two helper functions (`toRippleEpoch`, `fromRippleEpoch`) in `lib/xrpl/constants.ts` handle conversions. Offer expirations and credential expirations use Ripple epoch timestamps.

7. **AMM fill estimation interleaves CLOB and AMM pricing**: `estimateFillCombined` walks order book levels and the AMM constant-product curve simultaneously, consuming from whichever source offers the better price at each step. This produces `CombinedFillResult` with separate `clobFilled` and `ammFilled` breakdowns.

## Core Entities

### WalletInfo
**File**: `lib/types.ts`
**Purpose**: Client-side wallet representation stored in localStorage.

| Field | Type | Description |
|-------|------|-------------|
| `address` | `string` | XRPL classic address (e.g., `rN7n3...`) |
| `seed` | `string` | Secret seed for signing transactions |
| `publicKey` | `string` | Ed25519/secp256k1 public key |

**Relationships**: Referenced by `PersistedState` (issuer, credentialIssuer, domainOwner, recipients). Used by `MakeMarketOrder.wallet` and `TradeFormProps.focusedWallet`.
**Special handling**: Seeds are sensitive -- stored in localStorage only, sent to API routes only when signing is needed.

### GenerateAccountResponse
**File**: `lib/xrpl/types.ts`
**Purpose**: API response from `/api/accounts/generate` (faucet-funded wallet creation).

| Field | Type | Description |
|-------|------|-------------|
| `address` | `string` | New account address |
| `seed` | `string` | Secret seed |
| `publicKey` | `string` | Public key |
| `balance` | `string` | Initial XRP balance from faucet |

**Relationships**: Superset of `WalletInfo` (adds `balance`). `useWalletGeneration` maps this to `WalletInfo` by dropping `balance`.

### PersistedState
**File**: `lib/types.ts`
**Purpose**: Complete client-side application state persisted to localStorage.

| Field | Type | Description |
|-------|------|-------------|
| `network` | `"testnet" \| "devnet"` | Active XRPL network |
| `issuer` | `WalletInfo \| null` | Currency issuer wallet |
| `credentialIssuer` | `WalletInfo \| null` | XLS-70 credential issuer wallet |
| `domainOwner` | `WalletInfo \| null` | XLS-80 domain owner wallet |
| `currencies` | `string[]` | Registered currency codes |
| `recipients` | `WalletInfo[]` | Recipient wallets for transfers |

**Storage**: Serialized to `localStorage` under key `xrpl-manager-state-{network}`. Network selection stored separately under `xrpl-manager-network`.
**Related type**: `NetworkData = Omit<PersistedState, "network">` -- the per-network slice without the network discriminator.

### BalanceEntry
**File**: `lib/types.ts`
**Purpose**: Frontend display of account balances (XRP + issued currencies).

| Field | Type | Description |
|-------|------|-------------|
| `currency` | `string` | Currency code (decoded) |
| `value` | `string` | Balance amount |
| `issuer` | `string?` | Issuer address (absent for XRP) |

### CurrencyBalance
**File**: `lib/xrpl/types.ts`
**Purpose**: API response shape for balance queries. Structurally identical to `BalanceEntry`.

| Field | Type | Description |
|-------|------|-------------|
| `currency` | `string` | Currency code |
| `value` | `string` | Balance amount |
| `issuer` | `string?` | Issuer address |

### TrustLine
**File**: `lib/types.ts`
**Purpose**: Parsed trust line from XRPL ledger.

| Field | Type | Description |
|-------|------|-------------|
| `account` | `string` | Counterparty address (issuer) |
| `currency` | `string` | Currency code (may be hex-encoded) |
| `balance` | `string` | Current balance on the trust line |
| `limit` | `string` | Maximum amount trusted |

**Special handling**: Currency field may be 40-char hex for non-standard codes; use `decodeCurrency()` to get human-readable form. Default trust line limit is `"1000000"` (`DEFAULT_TRUST_LINE_LIMIT` in constants).

### DexAmount
**File**: `lib/xrpl/types.ts`
**Purpose**: Universal amount representation for DEX operations (API layer).

| Field | Type | Description |
|-------|------|-------------|
| `currency` | `string` | Currency code ("XRP" or issued currency code) |
| `issuer` | `string?` | Issuer address (required for non-XRP) |
| `value` | `string` | Amount in human-readable units |

**Relationships**: Used by `CreateOfferRequest` (takerGets, takerPays), `CreateAmmRequest` (amount, amount2), `DepositAmmRequest`, `WithdrawAmmRequest`. Converted to/from XRPL native `Amount` type via `toXrplAmount()`/`fromXrplAmount()`.
**Special handling**: XRP amounts are in whole units (not drops); `toXrplAmount()` converts to drops for ledger submission.

### OrderBookAmount
**File**: `lib/types.ts`
**Purpose**: Amount representation within order book entries. Structurally identical to `DexAmount`.

| Field | Type | Description |
|-------|------|-------------|
| `currency` | `string` | Currency code |
| `value` | `string` | Amount |
| `issuer` | `string?` | Issuer address |

### OrderBookEntry
**File**: `lib/types.ts`
**Purpose**: Single offer in the order book (from `/api/dex/orderbook`).

| Field | Type | Description |
|-------|------|-------------|
| `account` | `string` | Offer creator's address |
| `taker_gets` | `OrderBookAmount` | What the taker receives |
| `taker_pays` | `OrderBookAmount` | What the taker pays |
| `taker_gets_funded` | `OrderBookAmount?` | Funded amount (actual available) |
| `taker_pays_funded` | `OrderBookAmount?` | Funded counterpart |
| `quality` | `string?` | Price quality metric |
| `sequence` | `number` | Offer sequence number |

**Special handling**: Funded amounts (`taker_gets_funded`, `taker_pays_funded`) reflect actual fillable liquidity when the creator's balance is less than the offer amount. Order book depth calculations prefer funded amounts.

### AccountOffer
**File**: `lib/types.ts`
**Purpose**: Account's own open DEX offers (from `/api/accounts/{address}/offers`).

| Field | Type | Description |
|-------|------|-------------|
| `seq` | `number` | Offer sequence number (used for cancellation) |
| `flags` | `number` | Bitwise offer flags |
| `taker_gets` | `OrderBookAmount` | What taker receives |
| `taker_pays` | `OrderBookAmount` | What taker pays |
| `quality` | `string` | Price quality |
| `expiration` | `number?` | Ripple epoch expiration timestamp |
| `domainID` | `string?` | Permissioned domain scope (64-char hex) |

### OfferFlag (Union Type)
**File**: `lib/xrpl/types.ts`
**Purpose**: Named offer behavior flags.

```
"passive" | "immediateOrCancel" | "fillOrKill" | "sell" | "hybrid"
```

**Mapping** (in `lib/xrpl/offers.ts`): Each flag maps to an XRPL `OfferCreateFlags` bitmask value. Multiple flags are bitwise OR'd together by `resolveOfferFlags()`.

**Note**: The OpenAPI spec (`openapi.yaml`) lists only 4 flags (`passive`, `immediateOrCancel`, `fillOrKill`, `sell`), omitting `hybrid`. The TypeScript type includes all 5.

### CreateOfferRequest
**File**: `lib/xrpl/types.ts`
**Purpose**: API request body for placing a DEX offer.

| Field | Type | Description |
|-------|------|-------------|
| `seed` | `string` | Wallet secret for signing |
| `takerGets` | `DexAmount` | What the taker will receive |
| `takerPays` | `DexAmount` | What the taker will pay |
| `flags` | `OfferFlag[]?` | Behavioral flags |
| `expiration` | `number?` | Ripple epoch expiration |
| `offerSequence` | `number?` | Existing offer to replace |
| `domainID` | `string?` | Permissioned domain scope |
| `network` | `string?` | Target network |

### CancelOfferRequest
**File**: `lib/xrpl/types.ts`

| Field | Type | Description |
|-------|------|-------------|
| `seed` | `string` | Wallet secret |
| `offerSequence` | `number` | Sequence of offer to cancel |
| `network` | `string?` | Target network |

### FilledOrder
**File**: `lib/types.ts`
**Purpose**: Historical filled trade from `parseFilledOrders()`.

| Field | Type | Description |
|-------|------|-------------|
| `side` | `"buy" \| "sell"` | Trade direction |
| `price` | `string` | Execution price (6 significant figures) |
| `baseAmount` | `string` | Base currency amount (6 sig figs) |
| `quoteAmount` | `string` | Quote currency amount (6 sig figs) |
| `time` | `string` | ISO 8601 timestamp |
| `hash` | `string` | Transaction hash |

### RecentTrade
**File**: `app/trade/components/recent-trades.tsx`
**Purpose**: Market-wide recent trade (extends `FilledOrder` with `account`).

| Field | Type | Description |
|-------|------|-------------|
| `side` | `"buy" \| "sell"` | Trade direction |
| `price` | `string` | Price |
| `baseAmount` | `string` | Base amount |
| `quoteAmount` | `string` | Quote amount |
| `account` | `string` | Trader's address |
| `time` | `string` | ISO timestamp |
| `hash` | `string` | Transaction hash |

### DepthSummary
**File**: `lib/types.ts`
**Purpose**: Aggregated order book depth statistics.

| Field | Type | Description |
|-------|------|-------------|
| `bidVolume` | `string` | Total bid-side volume |
| `bidLevels` | `number` | Number of bid price levels |
| `askVolume` | `string` | Total ask-side volume |
| `askLevels` | `number` | Number of ask price levels |

### MidpriceMetrics
**File**: `lib/types.ts`
**Purpose**: Computed midprice analytics for the order book.

| Field | Type | Description |
|-------|------|-------------|
| `mid` | `string \| null` | Simple midprice: (bestAsk + bestBid) / 2 |
| `microPrice` | `string \| null` | Volume-weighted at top of book |
| `weightedMid` | `string \| null` | VWAP across all levels |
| `spread` | `string \| null` | bestAsk - bestBid |
| `spreadBps` | `string \| null` | Spread in basis points |

### PricedLevel
**File**: `lib/xrpl/order-book-levels.ts`
**Purpose**: Internal representation of an order book price level with BigNumber math.

| Field | Type | Description |
|-------|------|-------------|
| `price` | `BigNumber` | Price (quote/base) |
| `amount` | `BigNumber` | Available volume |
| `total` | `BigNumber` | Total cost/proceeds |
| `account` | `string` | Offer creator |

### EstimateFillResult
**File**: `lib/xrpl/estimate-fill.ts`
**Purpose**: Result of CLOB-only fill estimation.

| Field | Type | Description |
|-------|------|-------------|
| `avgPrice` | `BigNumber` | Volume-weighted average fill price |
| `worstPrice` | `BigNumber` | Price of worst level touched |
| `slippage` | `BigNumber \| null` | Slippage percentage vs midprice |
| `filledAmount` | `BigNumber` | Base currency filled |
| `totalCost` | `BigNumber` | Total quote currency cost/proceeds |
| `fullFill` | `boolean` | Whether entire amount can be filled |

### CombinedFillResult
**File**: `lib/xrpl/estimate-fill-combined.ts`
**Purpose**: Result of interleaved CLOB + AMM fill estimation. Extends `EstimateFillResult` conceptually.

| Field | Type | Description |
|-------|------|-------------|
| `avgPrice` | `BigNumber` | Combined average fill price |
| `worstPrice` | `BigNumber` | Worst price touched |
| `slippage` | `BigNumber \| null` | Slippage percentage |
| `filledAmount` | `BigNumber` | Total base filled |
| `totalCost` | `BigNumber` | Total quote cost/proceeds |
| `fullFill` | `boolean` | Full fill possible |
| `clobFilled` | `BigNumber` | Amount filled from order book |
| `ammFilled` | `BigNumber` | Amount filled from AMM pool |

### CredentialInfo
**File**: `lib/types.ts`
**Purpose**: XLS-70 credential representation.

| Field | Type | Description |
|-------|------|-------------|
| `issuer` | `string` | Credential issuer address |
| `subject` | `string` | Credential subject address |
| `credentialType` | `string` | Decoded credential type string |
| `accepted` | `boolean` | Whether the subject has accepted |
| `expiration` | `number?` | Ripple epoch expiration |
| `uri` | `string?` | Optional URI reference |

**Lifecycle**: See State Machines section below.

### CreateCredentialRequest / AcceptCredentialRequest / DeleteCredentialRequest
**File**: `lib/xrpl/types.ts`
**Purpose**: API request bodies for credential CRUD operations.

**CreateCredentialRequest**:
| Field | Type | Description |
|-------|------|-------------|
| `seed` | `string` | Issuer's wallet secret |
| `subject` | `string` | Subject address |
| `credentialType` | `string` | Type string (max 128 chars) |
| `expiration` | `number?` | Ripple epoch expiration |
| `uri` | `string?` | Optional URI |
| `network` | `string?` | Network |

**AcceptCredentialRequest**:
| Field | Type | Description |
|-------|------|-------------|
| `seed` | `string` | Subject's wallet secret |
| `issuer` | `string` | Issuer address |
| `credentialType` | `string` | Credential type to accept |
| `network` | `string?` | Network |

**DeleteCredentialRequest**:
| Field | Type | Description |
|-------|------|-------------|
| `seed` | `string` | Signer's wallet secret |
| `subject` | `string?` | Subject (if deleting as issuer) |
| `issuer` | `string?` | Issuer (if deleting as subject) |
| `credentialType` | `string` | Credential type |
| `network` | `string?` | Network |

### DomainInfo
**File**: `lib/types.ts`
**Purpose**: XLS-80 permissioned domain representation.

| Field | Type | Description |
|-------|------|-------------|
| `domainID` | `string` | 64-character uppercase hex identifier |
| `owner` | `string` | Domain owner address |
| `acceptedCredentials` | `{issuer, credentialType}[]` | 1-10 credential specs |
| `sequence` | `number` | Ledger sequence |

**Validation constants**: `MIN_DOMAIN_CREDENTIALS=1`, `MAX_DOMAIN_CREDENTIALS=10`, `DOMAIN_ID_REGEX=/^[0-9A-F]{64}$/`.

### CreateDomainRequest / DeleteDomainRequest
**File**: `lib/xrpl/types.ts`

**CreateDomainRequest**:
| Field | Type | Description |
|-------|------|-------------|
| `seed` | `string` | Owner's wallet secret |
| `domainID` | `string?` | Existing domain ID (for updates) |
| `acceptedCredentials` | `{issuer, credentialType}[]` | Credential requirements |
| `network` | `string?` | Network |

**DeleteDomainRequest**:
| Field | Type | Description |
|-------|------|-------------|
| `seed` | `string` | Owner's wallet secret |
| `domainID` | `string` | Domain to delete |
| `network` | `string?` | Network |

### EditingDomain
**File**: `app/compliance/components/create-domain-form.tsx`
**Purpose**: UI state for editing an existing domain.

| Field | Type | Description |
|-------|------|-------------|
| `domainID` | `string` | Domain being edited |
| `acceptedCredentials` | `DomainInfo["acceptedCredentials"]` | Current credential specs |

### IssueCurrencyRequest
**File**: `lib/xrpl/types.ts`
**Purpose**: API request for issuing new currency (Payment from issuer to recipient).

| Field | Type | Description |
|-------|------|-------------|
| `issuerSeed` | `string` | Issuer's wallet secret |
| `recipientAddress` | `string` | Destination address |
| `currencyCode` | `string` | Currency to issue |
| `amount` | `string` | Amount to issue |
| `network` | `string?` | Network |

**Prerequisite**: Recipient must have a trust line to the issuer for the specified currency.

### TransferRequest
**File**: `lib/xrpl/types.ts`
**Purpose**: API request for transferring issued currency between accounts.

| Field | Type | Description |
|-------|------|-------------|
| `senderSeed` | `string` | Sender's wallet secret |
| `recipientAddress` | `string` | Destination address |
| `issuerAddress` | `string?` | Currency issuer (for disambiguation) |
| `currencyCode` | `string` | Currency to transfer |
| `amount` | `string` | Transfer amount |
| `network` | `string?` | Network |

### TrustLineRequest
**File**: `lib/xrpl/types.ts`
**Purpose**: API request for creating/modifying a trust line.

| Field | Type | Description |
|-------|------|-------------|
| `seed` | `string` | Account's wallet secret |
| `currency` | `string` | Currency code |
| `issuer` | `string` | Issuer address to trust |
| `limit` | `string` | Maximum trust amount |
| `network` | `string?` | Network |

### AmmPoolInfo
**File**: `lib/types.ts`
**Purpose**: AMM pool state from `/api/amm/info`.

| Field | Type | Description |
|-------|------|-------------|
| `exists` | `boolean` | Whether pool exists |
| `account` | `string?` | Pool account address |
| `asset1` | `{currency, issuer?, value}?` | First asset reserves |
| `asset2` | `{currency, issuer?, value}?` | Second asset reserves |
| `lpToken` | `{currency, issuer, value}?` | LP token info |
| `tradingFee` | `number?` | Fee in units of 1/100,000 |
| `tradingFeeDisplay` | `string?` | Human-readable fee (e.g., "0.30%") |
| `spotPrice` | `string?` | 1 base in quote terms |
| `invertedSpotPrice` | `string?` | 1 quote in base terms |
| `effectivePrice` | `string?` | Fee-adjusted inverted price |
| `marginalBuyPrice` | `string?` | Initial marginal buy cost |
| `marginalSellPrice` | `string?` | Initial marginal sell proceeds |
| `assetFrozen` | `boolean?` | Base asset frozen flag |
| `asset2Frozen` | `boolean?` | Quote asset frozen flag |
| `auctionSlot` | `AmmAuctionSlot \| null?` | Current auction slot holder |
| `voteSlots` | `AmmVoteSlot[]?` | Fee voting state |

### AmmAuctionSlot / AmmVoteSlot
**File**: `lib/types.ts`

**AmmAuctionSlot**:
| Field | Type | Description |
|-------|------|-------------|
| `account` | `string` | Slot holder address |
| `discountedFee` | `number` | Reduced fee for slot holder |
| `expiration` | `string` | Slot expiration (ISO string) |
| `price` | `{currency, issuer, value}` | Price paid for the slot |
| `timeInterval` | `number` | Auction time interval |

**AmmVoteSlot**:
| Field | Type | Description |
|-------|------|-------------|
| `account` | `string` | Voter address |
| `tradingFee` | `number` | Voted fee level |
| `voteWeight` | `number` | Vote weight |

### AmmPoolParams
**File**: `lib/xrpl/amm-math.ts`
**Purpose**: Internal math representation for AMM constant-product calculations.

| Field | Type | Description |
|-------|------|-------------|
| `baseReserves` | `BigNumber` | Base asset reserve amount |
| `quoteReserves` | `BigNumber` | Quote asset reserve amount |
| `feeRate` | `BigNumber` | tradingFee / 100,000 |

### CreateAmmRequest / DepositAmmRequest / WithdrawAmmRequest
**File**: `lib/xrpl/types.ts`

**CreateAmmRequest**:
| Field | Type | Description |
|-------|------|-------------|
| `seed` | `string` | Creator's wallet secret |
| `amount` | `DexAmount` | First asset deposit |
| `amount2` | `DexAmount` | Second asset deposit |
| `tradingFee` | `number` | 0-1000 (0%-1%) |
| `network` | `string?` | Network |

**DepositAmmRequest**:
| Field | Type | Description |
|-------|------|-------------|
| `seed` | `string` | Depositor's wallet secret |
| `asset` / `asset2` | `{currency, issuer?}` | Pool asset identifiers |
| `amount` / `amount2` | `DexAmount?` | Deposit amounts |
| `lpTokenOut` | `DexAmount?` | Desired LP tokens |
| `mode` | `"two-asset" \| "single-asset" \| "two-asset-if-empty"` | Deposit mode |
| `network` | `string?` | Network |

**WithdrawAmmRequest**:
| Field | Type | Description |
|-------|------|-------------|
| `seed` | `string` | Withdrawer's wallet secret |
| `asset` / `asset2` | `{currency, issuer?}` | Pool asset identifiers |
| `amount` / `amount2` | `DexAmount?` | Withdrawal amounts |
| `lpTokenIn` | `DexAmount?` | LP tokens to redeem |
| `mode` | `"withdraw-all" \| "two-asset" \| "single-asset"` | Withdrawal mode |
| `network` | `string?` | Network |

### AmmInfoQuery
**File**: `lib/xrpl/types.ts`
**Purpose**: Query parameters for AMM pool info lookup.

| Field | Type | Description |
|-------|------|-------------|
| `baseCurrency` | `string` | Base currency code |
| `baseIssuer` | `string?` | Base issuer |
| `quoteCurrency` | `string` | Quote currency code |
| `quoteIssuer` | `string?` | Quote issuer |
| `network` | `string?` | Network |

### CurrencyOption
**File**: `lib/hooks/use-trading-data.ts`
**Purpose**: Selectable currency in the trading UI dropdown.

| Field | Type | Description |
|-------|------|-------------|
| `currency` | `string` | Decoded currency code |
| `issuer` | `string?` | Issuer address |
| `label` | `string` | Display label (e.g., "RLUSD (rQhWct...)") |
| `value` | `string` | Encoded key: `"currency\|issuer"` |

**Construction**: Built from 3 sources merged in priority order: XRP (always first), `WELL_KNOWN_CURRENCIES[network]`, then account balances, then custom currencies.

### MakeMarketOrder
**File**: `app/trade/components/make-market-modal.tsx`
**Purpose**: Single order in a batch market-making operation.

| Field | Type | Description |
|-------|------|-------------|
| `side` | `"Bid" \| "Ask"` | Order side |
| `level` | `number` | Ladder level index |
| `price` | `string` | Order price |
| `qty` | `string` | Order quantity |
| `wallet` | `WalletInfo` | Wallet to place from |

### TradeFormPrefill
**File**: `app/trade/components/trade-form.tsx`
**Purpose**: Pre-populated trade form values (e.g., when clicking an order book row).

| Field | Type | Description |
|-------|------|-------------|
| `tab` | `"buy" \| "sell"` | Pre-selected tab |
| `price` | `string` | Pre-filled price |
| `amount` | `string` | Pre-filled amount |
| `key` | `number` | Change key to trigger re-render |

### ApiError
**File**: `lib/xrpl/types.ts`
**Purpose**: Standard error response shape used across all API endpoints.

| Field | Type | Description |
|-------|------|-------------|
| `error` | `string` | Human-readable error message |

### CurrencyPair
**File**: `lib/api.ts`
**Purpose**: Validated currency pair from query parameters.

| Field | Type | Description |
|-------|------|-------------|
| `baseCurrency` | `string` | Base currency code |
| `baseIssuer` | `string \| undefined` | Base issuer (absent for XRP) |
| `quoteCurrency` | `string` | Quote currency code |
| `quoteIssuer` | `string \| undefined` | Quote issuer (absent for XRP) |

### NetworkId
**File**: `lib/xrpl/networks.ts`
**Definition**: `type NetworkId = keyof typeof NETWORKS` -- resolves to `"testnet" | "devnet"`.

## Entity Relationships

```
PersistedState (localStorage)
  |-- network: "testnet" | "devnet"
  |-- issuer ---------> WalletInfo
  |-- credentialIssuer -> WalletInfo
  |-- domainOwner -----> WalletInfo
  |-- currencies[] ----> string (currency codes)
  |-- recipients[] ----> WalletInfo[]

WalletInfo ---[seed]--> API Requests ---[XRPL tx]--> XRP Ledger
  |                        |
  |-- GenerateAccountResponse (superset, adds balance)
  |
  +-- used by: IssueCurrencyRequest.issuerSeed
  |            TransferRequest.senderSeed
  |            TrustLineRequest.seed
  |            CreateOfferRequest.seed
  |            CreateCredentialRequest.seed
  |            CreateDomainRequest.seed
  |            CreateAmmRequest.seed

CurrencyOption (UI)
  |-- built from: BalanceEntry[] + WELL_KNOWN_CURRENCIES + custom
  |-- encodes as: "currency|issuer" string
  |-- resolves to: DexAmount (via buildDexAmount)

DexAmount <--toXrplAmount/fromXrplAmount--> XRPL Amount (drops or object)
  |-- used in: CreateOfferRequest, CreateAmmRequest, DepositAmmRequest, WithdrawAmmRequest
  |-- structurally same as: OrderBookAmount, CurrencyBalance, BalanceEntry

OrderBookEntry ------> OrderBookAmount (taker_gets, taker_pays)
  |                     OrderBookAmount (taker_gets_funded, taker_pays_funded)
  +---> PricedLevel (via buildAsks/buildBids)
          +---> MidpriceMetrics (via computeMidpriceMetrics)
          +---> EstimateFillResult / CombinedFillResult (via estimateFill/estimateFillCombined)
          +---> DepthSummary (via aggregateDepth)

CredentialInfo --[credential lifecycle]--> accepted/pending
  |-- referenced by: DomainInfo.acceptedCredentials
  |-- managed via: CreateCredentialRequest, AcceptCredentialRequest, DeleteCredentialRequest

DomainInfo --[references]--> CredentialInfo (via acceptedCredentials[])
  |-- scopes: CreateOfferRequest.domainID, AccountOffer.domainID
  |-- managed via: CreateDomainRequest, DeleteDomainRequest

AmmPoolInfo
  |-- converted to: AmmPoolParams (via buildAmmPoolParams)
  |-- used by: CombinedFillResult (AMM fill estimation)
  |-- contains: AmmAuctionSlot, AmmVoteSlot[]
  |-- managed via: CreateAmmRequest, DepositAmmRequest, WithdrawAmmRequest
```

## State Machines

### Credential Lifecycle (XLS-70)

```
                CredentialCreate
[Not Exists] ─────────────────────> [Created / Pending]
                                         |
                                         | CredentialAccept (by subject)
                                         v
                                    [Accepted]
                                         |
                                         | expiration reached (automatic)
                                         v
                                    [Expired] (still on ledger, accepted=true)

Any state ──── CredentialDelete ──> [Not Exists]
               (by issuer or subject)
```

**Key details**:
- The `accepted` boolean on `CredentialInfo` tracks whether the subject has accepted.
- The `LSF_ACCEPTED` flag (`0x00010000`) on the ledger object indicates acceptance.
- Expiration uses Ripple epoch timestamps. An expired credential remains on-ledger but is not functionally valid.
- Either the issuer or the subject can delete a credential at any time.

### DEX Offer Lifecycle

```
                    OfferCreate
[Not Exists] ──────────────────────> [Open/Resting]
                                          |
                    +-----------+---------+----------+
                    |           |         |          |
                    | partial   | full    | cancel   | expiration
                    | fill      | fill    |          | reached
                    v           v         v          v
              [Partially   [Filled]  [Cancelled] [Expired]
               Filled]        |         |          |
                    |         +----+----+----------+
                    |              |
                    v              v
              [Open/Resting]  [Not Exists]
              (reduced qty)
```

**Offer flags** affect lifecycle:
- `passive`: Does not immediately match crossing offers; rests on the book.
- `immediateOrCancel`: Fills what it can immediately, cancels the rest. Never rests.
- `fillOrKill`: Must fill entirely or not at all. Never rests.
- `sell`: Sells the exact TakerGets amount even if the price improved.
- `hybrid`: Combination behavior (devnet-only, XLS amendment).

**Domain-scoped offers**: When `domainID` is set, the offer only matches against other offers in the same permissioned domain. Requires the account to hold an accepted credential matching the domain's `acceptedCredentials`.

**Expiration timers**: The `useOfferExpirationTimers` hook schedules client-side timers for offers expiring within 5 minutes, triggering a refresh 1 second after expiration.

### Permissioned Domain Lifecycle (XLS-80)

```
                PermissionedDomainSet (no domainID)
[Not Exists] ─────────────────────────────────────> [Active]
                                                       |
                   PermissionedDomainSet (with domainID)
                   (update acceptedCredentials)        |
                          <────────────────────────────+
                                                       |
                   PermissionedDomainDelete             |
[Not Exists] <──────────────────────────────────────────+
```

**Key details**:
- Creating without `domainID` creates a new domain; the ledger assigns the 64-char hex ID.
- Creating with an existing `domainID` updates the domain's accepted credentials.
- A domain requires 1-10 accepted credential specs.

### AMM Pool Lifecycle

```
                    AMMCreate
[Not Exists] ──────────────────> [Active Pool]
                                      |
                 AMMDeposit           | AMMWithdraw
                 (3 modes)            | (3 modes)
                     |                |
                     +------>  <------+
                     |                |
                     v                v
               [Active Pool]   [Active Pool]
                                      |
                     full withdraw    |
                     (all LP tokens)  |
                          +-----------+
                          v
                   [Empty Pool] ──── two-asset-if-empty deposit ──> [Active Pool]
```

**Deposit modes**: `two-asset` (proportional), `single-asset` (one-sided), `two-asset-if-empty` (refund empty pool).
**Withdraw modes**: `withdraw-all` (redeem all LP tokens), `two-asset` (proportional), `single-asset` (one-sided).

### Trust Line + Rippling Prerequisite Flow

```
Issuer account:
  [No DefaultRipple] ── POST /api/.../rippling ──> [DefaultRipple enabled]
                                                    + NoRipple cleared on
                                                      existing trust lines

Recipient account:
  [No Trust Line] ── POST /api/.../trustlines ──> [Trust Line exists]
                                                        |
  Then: POST /api/currencies/issue                      |
        (requires trust line)                           v
                                                   [Balance > 0]
```

## Data Patterns

### Currency Encoding/Decoding

**Encoding** (server-only, `lib/xrpl/currency.ts`):
- 3-char alphanumeric: pass through as-is (e.g., `"USD"`, `"XRP"`)
- 40-char hex: pass through as-is (already encoded)
- 4-20 char ASCII: hex-encode + right-pad to 40 chars (e.g., `"RLUSD"` -> `"524C555344..."`)
- Rejects codes < 3 chars or 21-39 chars

**Decoding** (browser-safe, `lib/xrpl/decode-currency-client.ts`):
- Non-40-char strings: return as-is
- `03`-prefixed 40-char hex: return `"LP Token"` (AMM LP token detection)
- Other 40-char hex: strip trailing zeros, decode hex pairs to ASCII, return only if all printable (0x20-0x7E)

**Credential type encoding** (server-only, `lib/xrpl/credentials.ts`):
- UTF-8 to uppercase hex, variable length (no padding)
- Distinct from currency encoding

### Client/Server Type Splits

| Concern | Server (Node.js) | Client (Browser) |
|---------|-------------------|-------------------|
| Currency encode | `encodeXrplCurrency()` (uses `Buffer`) | N/A |
| Currency decode | `decodeCurrency()` (re-exported) | `decodeCurrency()` (pure string ops) |
| Credential encode | `encodeCredentialType()` (uses `Buffer`) | N/A |
| Credential decode | `decodeCredentialType()` (uses `Buffer`) | N/A |
| Amount conversion | `toXrplAmount()` / `fromXrplAmount()` (uses `xrpToDrops`) | N/A |
| XRPL client | `getClient()` singleton WebSocket | N/A (all via API routes) |
| State persistence | None (stateless) | `localStorage` via `useLocalStorage` |

### Persisted State Architecture

**Storage keys**:
- `xrpl-manager-network` -> `"testnet"` or `"devnet"`
- `xrpl-manager-state-testnet` -> JSON-serialized `NetworkData`
- `xrpl-manager-state-devnet` -> JSON-serialized `NetworkData`
- `xrpl-manager-state` -> Legacy key (migrated automatically, then deleted)

**Hydration**: `useLocalStorage` sets `hydrated=false` initially, reads from localStorage in a `useEffect`, then sets `hydrated=true`. Components should check `hydrated` before rendering state-dependent content to avoid SSR/client mismatch.

**Context provider**: `AppStateProvider` wraps the app, exposing `useAppState()` with:
- Read: `state` (full `PersistedState`)
- Write: `setIssuer`, `addCurrency`, `removeCurrency`, `addRecipient`, `setCredentialIssuer`, `setDomainOwner`, `setNetwork`, `importState`, `clearAll`

### Constants and Validation Bounds

**Ledger flags** (`lib/xrpl/constants.ts`):
| Constant | Value | Purpose |
|----------|-------|---------|
| `LSF_DEFAULT_RIPPLE` | `0x00800000` | Account has DefaultRipple enabled |
| `LSF_ACCEPTED` | `0x00010000` | Credential has been accepted |
| `TF_CLEAR_NO_RIPPLE` | `0x00040000` | Clear NoRipple flag on trust line |

**API limits**:
| Constant | Value | Purpose |
|----------|-------|---------|
| `MAX_API_LIMIT` | 400 | Max user-supplied `limit` query param |
| `DEFAULT_ORDERBOOK_LIMIT` | 20 | Default orderbook/trades results |
| `DEFAULT_ACCOUNT_OFFERS_LIMIT` | 200 | Default account offers results |
| `DEFAULT_TRANSACTION_LIMIT` | 20 | Default transaction history results |
| `TRADES_FETCH_MULTIPLIER` | 5 | Over-fetch multiplier for trade discovery |

**Validation**:
| Constant | Value | Purpose |
|----------|-------|---------|
| `MIN_CURRENCY_CODE_LENGTH` | 3 | Minimum currency code chars |
| `MAX_CURRENCY_CODE_LENGTH` | 40 | Maximum (hex-encoded length) |
| `HEX_CURRENCY_CODE_LENGTH` | 40 | Exact length of hex currency codes |
| `MAX_CREDENTIAL_TYPE_LENGTH` | 128 | Max credential type string length |
| `MIN_DOMAIN_CREDENTIALS` | 1 | Min credentials per domain |
| `MAX_DOMAIN_CREDENTIALS` | 10 | Max credentials per domain |
| `AMM_MAX_TRADING_FEE` | 1000 | Max AMM fee (= 1%) |
| `AMM_DEFAULT_TRADING_FEE` | 300 | Default AMM fee (= 0.3%) |
| `DEFAULT_TRUST_LINE_LIMIT` | "1000000" | Default trust line limit |
| `DOMAIN_ID_REGEX` | `/^[0-9A-F]{64}$/` | Domain ID format validation |

**Epoch**:
| Constant | Value | Purpose |
|----------|-------|---------|
| `RIPPLE_EPOCH_OFFSET` | 946684800 | Seconds between Unix and Ripple epoch |

### Well-Known Currencies

**File**: `lib/assets.ts`

```typescript
Assets = { XRP: "XRP", RLUSD: "RLUSD" }

WELL_KNOWN_CURRENCIES = {
  testnet: { RLUSD: "rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV" },
  devnet: {},
}
```

These are used to pre-populate currency dropdowns in the trading UI even before the user's account has balances.

### Network Configuration

**File**: `lib/xrpl/networks.ts`

Two networks supported, each with WebSocket URL and faucet URL:
- `testnet`: `wss://s.altnet.rippletest.net:51233`
- `devnet`: `wss://s.devnet.rippletest.net:51233`

Default network: `testnet`. The `resolveNetwork()` function falls back to testnet for unknown values.

### XRPL Client Singleton

**File**: `lib/xrpl/client.ts`

A module-level singleton pattern: one `Client` instance persists across requests. When the network changes, the old client is disconnected and a new one created. If the connection drops, it attempts reconnection before creating a new client.

### Rate Limiting

**File**: `lib/rate-limit.ts`

Token-bucket algorithm with in-memory `Map` storage. Buckets are evicted after 10 minutes of inactivity, with cleanup running every 5 minutes.

### Data Fetching Patterns

Two generic hooks drive all data fetching:
- `useApiFetch<T>` -- GET requests with auto-refresh via `refreshKey` and manual `refresh()`
- `useApiMutation<T>` -- POST requests returning `T | null`

The mutation-refresh cycle: after a successful mutation, the caller increments `refreshKey` to trigger re-fetching of related data.

Polling: `usePollInterval` fires a silent (no loading spinner) refresh every 3 seconds on the trade page when a currency pair is selected and the tab is visible.

## Gotchas

1. **Four structurally-identical amount types**: `DexAmount`, `OrderBookAmount`, `CurrencyBalance`, and `BalanceEntry` all have the same `{currency, value, issuer?}` shape but are separate interfaces. You cannot directly assign one to another in TypeScript (nominal-ish), though structural typing means they are compatible in practice. Be aware which one a function expects.

2. **`dropsToXrp()` returns `number`, not `string`**: The XRPL library's `dropsToXrp()` returns a number. The codebase wraps it with `String()` in `fromXrplAmount()` to maintain string typing. Forgetting this wrap causes type errors with string-typed amount fields.

3. **Currency codes may arrive hex-encoded**: Trust line currencies and order book currencies from the ledger may be 40-char hex strings for non-standard codes. Always run through `decodeCurrency()` before display or comparison. The `matchesCurrency()` utility handles this by comparing both raw and decoded forms.

4. **LP token detection relies on the `03` prefix**: The `decodeCurrency` function returns "LP Token" for any 40-char hex string starting with `03`. This is not a general decode -- it's a special case for AMM LP tokens. The `isLpTokenCurrency()` function provides the same check.

5. **Credential type encoding differs from currency encoding**: Credentials use raw UTF-8-to-hex without padding. Currencies use ASCII-to-hex with padding to 40 chars. Using the wrong encoder will produce invalid ledger objects.

6. **`OfferFlag` type includes `hybrid` but OpenAPI spec does not**: The TypeScript `OfferFlag` union type includes `"hybrid"` (5 values), but the OpenAPI `OfferFlag` schema enum only lists 4 values (no `hybrid`). This flag is likely devnet-only.

7. **Offer expiration is in Ripple epoch, not Unix epoch**: Passing a Unix timestamp to `expiration` fields will set an expiration ~30 years in the future. Use `toRippleEpoch()` to convert.

8. **AMM fill estimation caps at 99% of reserves**: The `AMM_RESERVE_CAP` constant prevents trying to buy the entire reserve (which would approach infinity on the constant-product curve).

9. **`DeleteCredentialRequest` uses optional fields for role detection**: Either `subject` or `issuer` must be provided (but not both) to determine which party is deleting the credential. The API route uses the seed-derived address + these fields to construct the correct transaction.

10. **Trust line validation is async and multi-step**: The `useTrustLineValidation` hook first checks for a matching trust line, then if found and the sender is not the issuer, makes a second API call to check the issuer's DefaultRipple flag. Both checks are needed before a peer-to-peer transfer.

## Cross-references

- API endpoints that consume these types: `docs/learnings/api-surface.md` (endpoint tables, validation rules)
- Workflow orchestration and state transitions: `docs/learnings/processing-flows.md` (credential/offer/domain lifecycles in action)
- XRPL client and amount conversions: `docs/learnings/integrations.md` (how DexAmount flows to the ledger)
- Currency encoding details: `docs/learnings/processing-flows.md` § Business Rules > Currency Code Encoding

## Scan Limitations

1. **API route handler implementations not read**: Only the type definitions and request/response shapes were analyzed. The actual route handler logic in `app/api/` directories was not examined for additional implicit data shapes or transformations.

2. **Frontend page components not fully scanned**: Only exported type definitions in `app/` component files were read. Local state shapes, prop interfaces, and intermediate data transformations within page components were not exhaustively cataloged.

3. **OpenAPI spec response schemas for some endpoints use `type: object` without detailed properties** (e.g., `TransactionsResponse`, `TrustLinesResponse`), indicating the API passes through raw XRPL ledger objects whose shapes are not fully typed in the application layer.

4. **Test scripts not analyzed**: The `scripts/` directory test scripts may reveal additional implicit API contract expectations not captured in the TypeScript types.

5. **`proxy.ts` not examined**: The Next.js 16 proxy file (replacing middleware) may contain additional request/response shaping logic.
