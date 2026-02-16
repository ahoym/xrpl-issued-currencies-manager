# XRPL Automated Market Maker (AMM) — Research Notes

> Sourced from [xrpl.org AMM docs](https://xrpl.org/docs/concepts/tokens/decentralized-exchange/automated-market-makers), [XLS-30 specification](https://github.com/XRPLF/XRPL-Standards/blob/master/XLS-0030-automated-market-maker/README.md), [xrpl.js type definitions](https://js.xrpl.org), and related pages.

## Overview

The XRP Ledger has native AMM support via the **XLS-30 amendment**, enabled on Mainnet on **2024-03-22**. Each asset pair (token or XRP) can have at most one AMM instance. The AMM is deeply integrated with the existing Central Limit Order Book (CLOB) DEX — the protocol automatically routes trades through whichever path (AMM pool, order book, or combination) provides the best rate.

### Key Properties

- **Constant product formula**: Uses a geometric mean market maker (GM3) with equal weights (W=0.5), equivalent to the standard `x * y = k` constant product formula
- **One AMM per pair**: Each unique asset pair can have exactly one AMM
- **LP tokens**: Liquidity providers receive LP tokens proportional to their share of the pool
- **Votable trading fee**: LP holders vote on the trading fee (0–1%, in units of 1/100,000)
- **Auction slot**: 24-hour trading advantage slot that mitigates impermanent loss
- **Special AMM account**: Each AMM has a dedicated AccountRoot that holds assets and issues LP tokens; this account is not subject to the reserve requirement and cannot sign transactions

## AMM Account & LP Tokens

### AMM Account

When an AMM is created, a special `AccountRoot` ledger entry is generated with a pseudo-random address. This account:
- Holds the AMM's XRP (if applicable) and issued token balances
- Issues LP tokens
- Has its regular key set to account zero and master key disabled (cannot sign transactions)
- Is **not subject** to the XRP reserve requirement

### LP Tokens

- Use a special 160-bit hexadecimal "non-standard" currency code: first 8 bits are `0x03`, remainder is a truncated SHA-512 hash of the two asset currency codes and issuers
- Formula for initial LP token issuance: `LPTokens = sqrt(Amount1 * Amount2)` (geometric mean)
- Can be bought, sold, transferred, and used in payments like any other issued token
- To receive LP tokens via payment, a trust line to the AMM account is required
- Returning all LP tokens to the AMM triggers automatic deletion of the AMM instance

## AMM Ledger Entry

The `AMM` ledger entry contains:

| Field | Type | Description |
|---|---|---|
| `Account` | string | The AMM's special account address |
| `Asset` | Currency | One of the two pool assets |
| `Asset2` | Currency | The other pool asset |
| `AuctionSlot` | object | Current auction slot holder, authorized accounts, fee, expiration |
| `LPTokenBalance` | IssuedCurrencyAmount | Total outstanding LP tokens |
| `TradingFee` | number | Current fee (weighted mean of votes), 0–1000 (= 0–1%) |
| `VoteSlots` | VoteEntry[] | Up to 8 voting slots with account, fee vote, and weight |

## Transaction Types

### AMMCreate

Creates a new AMM instance and provides initial funding.

**Special cost**: Requires destroying at least the incremental owner reserve (currently **0.2 XRP** after the 2024 reserve reduction, previously 2 XRP), not the standard ~0.00001 XRP transaction cost. Use xrpl.js autofill for dynamic fee calculation.

**Fields** (from `xrpl` v4.5.0):
```typescript
interface AMMCreate extends BaseTransaction {
  TransactionType: 'AMMCreate';
  Amount: Amount;      // First asset to fund (positive amount)
  Amount2: Amount;     // Second asset to fund (positive amount)
  TradingFee: number;  // Initial fee, 0–1000 (units of 1/100,000; max 1% fee)
}
```

**Prerequisites**:
- At most one of Amount/Amount2 can be XRP
- Cannot use LP tokens as either asset
- Creator must hold sufficient balances of both assets
- For issued tokens, DefaultRipple must be enabled on the issuer
- For RequireAuth tokens, creator must be authorized

### AMMDeposit

Adds liquidity to an existing AMM pool.

**Flags & modes** (from `xrpl` v4.5.0):
```typescript
enum AMMDepositFlags {
  tfLPToken = 65536,         // Specify LPTokenOut
  tfSingleAsset = 524288,    // Deposit one asset only
  tfTwoAsset = 1048576,      // Deposit both assets
  tfOneAssetLPToken = 2097152, // Single asset for specific LP amount
  tfLimitLPToken = 4194304,  // Single asset with max effective price
  tfTwoAssetIfEmpty = 8388608 // Both assets to empty pool
}

interface AMMDeposit extends BaseTransaction {
  TransactionType: 'AMMDeposit';
  Asset: Currency;
  Asset2: Currency;
  Amount?: Amount;
  Amount2?: Amount;
  EPrice?: Amount;                  // Max effective price per LP token
  LPTokenOut?: IssuedCurrencyAmount;
}
```

**Two categories**:
1. **Double-asset deposits** (proportional, no fee): `tfTwoAsset`, `tfTwoAssetIfEmpty`
2. **Single-asset deposits** (subject to trading fee): `tfSingleAsset`, `tfOneAssetLPToken`, `tfLimitLPToken`, `tfLPToken` (when only one Amount specified)

### AMMWithdraw

Returns LP tokens to redeem a share of pool assets.

**Flags & modes** (from `xrpl` v4.5.0):
```typescript
enum AMMWithdrawFlags {
  tfLPToken = 65536,              // Redeem specific LP amount for both assets
  tfWithdrawAll = 131072,         // Redeem ALL LP tokens for both assets
  tfOneAssetWithdrawAll = 262144, // Redeem ALL LP tokens for single asset
  tfSingleAsset = 524288,         // Withdraw specific amount of one asset
  tfTwoAsset = 1048576,           // Withdraw specific amounts of both assets
  tfOneAssetLPToken = 2097152,    // Redeem LP for specific amount of one asset
  tfLimitLPToken = 4194304        // Withdraw asset with min effective price
}

interface AMMWithdraw extends BaseTransaction {
  TransactionType: 'AMMWithdraw';
  Asset: Currency;
  Asset2: Currency;
  Amount?: Amount;
  Amount2?: Amount;
  EPrice?: Amount;                 // Min effective price (LP per unit withdrawn)
  LPTokenIn?: IssuedCurrencyAmount;
}
```

**Auto-deletion**: If the last LP tokens are returned, the AMM and up to 512 associated trust lines are automatically deleted. If more trust lines remain, `AMMDelete` must be called.

### AMMVote

Votes on the AMM's trading fee. Up to 8 LP holders can have active votes; only the top 8 by LP token balance count. The effective fee is a weighted average.

```typescript
interface AMMVote extends BaseTransaction {
  TransactionType: 'AMMVote';
  Asset: Currency;
  Asset2: Currency;
  TradingFee: number;  // Proposed fee, 0–1000
}
```

### AMMBid

Bids on the AMM's 24-hour auction slot for discounted trading (1/10 of normal fee).

```typescript
interface AMMBid extends BaseTransaction {
  TransactionType: 'AMMBid';
  Asset: Currency;
  Asset2: Currency;
  BidMin?: IssuedCurrencyAmount;   // Min LP tokens to bid
  BidMax?: IssuedCurrencyAmount;   // Max LP tokens to bid
  AuthAccounts?: AuthAccount[];    // Up to 4 additional accounts for discounted fee
}
```

**Minimum bid** (empty/expired slot): `LPTokenBalance * TradingFee / 25`

**Auction proceeds**: Partially refunded to prior slot holder; partially burned (reducing total LP supply, increasing remaining holders' share).

### AMMDelete

Removes an empty AMM that couldn't be auto-deleted due to too many trust lines.

```typescript
interface AMMDelete extends BaseTransaction {
  TransactionType: 'AMMDelete';
  Asset: Currency;
  Asset2: Currency;
}
```

## API: `amm_info`

Queries AMM state by pool account or asset pair.

**Request**:
```json
{
  "command": "amm_info",
  "asset": { "currency": "XRP" },
  "asset2": { "currency": "USD", "issuer": "rIssuerAddress..." }
}
```
Or use `amm_account` instead of `asset`/`asset2`.

**Response** (`amm` object):

| Field | Type | Description |
|---|---|---|
| `account` | string | AMM account address |
| `amount` | Amount | Total of first asset in pool |
| `amount2` | Amount | Total of second asset in pool |
| `lp_token` | IssuedCurrencyAmount | Total outstanding LP tokens |
| `trading_fee` | number | Current fee (0–1000) |
| `asset_frozen` | boolean? | Whether first asset is frozen |
| `asset2_frozen` | boolean? | Whether second asset is frozen |
| `auction_slot` | object? | Current auction slot info |
| `vote_slots` | object[]? | Current fee votes |

### Auction Slot Object

| Field | Type | Description |
|---|---|---|
| `account` | string | Slot holder address |
| `auth_accounts` | array | Up to 4 authorized accounts |
| `discounted_fee` | number | Fee for slot holder (normally 0) |
| `expiration` | string | ISO 8601 expiration |
| `price` | IssuedCurrencyAmount | LP tokens paid |
| `time_interval` | number | Current 72-minute interval (0–19) |

## Integration with the CLOB DEX

This is the most unique aspect of XRPL's AMM design:

1. **Transparent injection**: The AMM's offer is injected into the liquidity stream alongside order book offers during payment/trade execution
2. **Automatic routing**: The payment engine determines whether the AMM pool, order book, or a combination provides the best rate
3. **Pathfinding awareness**: `ripple_path_find` and `path_find` consider both AMM pools and order books
4. **Auto-bridging**: Token-to-token trades can bridge through XRP using both AMM and order book liquidity
5. **No separate synthetic offers**: The AMM quote is computed on-the-fly from pool balances and fee, not as explicit ledger offers

**Impact on existing trade UI**: The order book already reflects AMM liquidity through synthetic offers. Users trading via `OfferCreate` automatically benefit from AMM pools without needing explicit AMM interaction.

## Impermanent Loss Mitigation

XRPL's AMM mitigates impermanent loss through two mechanisms:

1. **Auction slot**: By enabling near-zero-fee arbitrage for the slot holder, the pool rebalances immediately when prices diverge (instead of waiting for fee-exceeding arbitrage opportunities). This narrows the window of loss exposure.
2. **Fee accumulation**: Trading fees accumulate in the pool reserves, distributed proportionally to LP holders on withdrawal. Higher volume = more fee income to offset IL.
3. **Auction proceeds burned**: Burned LP tokens from auctions increase remaining holders' proportional share.

## xrpl.js v4.5.0 Availability

All AMM transaction types are available as TypeScript interfaces in the `xrpl` package (v4.5.0):
- `AMMCreate`, `AMMDeposit`, `AMMWithdraw`, `AMMVote`, `AMMBid`, `AMMDelete`
- `AMMDepositFlags`, `AMMWithdrawFlags` enums
- `AMMInfoRequest`, `AMMInfoResponse` for the `amm_info` API method
- `AMM_MAX_TRADING_FEE = 1000` constant

## Areas for Deeper Investigation

1. ~~**Existing trade UI integration points**~~ → Resolved: AMM panel stacks below OrderBook in center column; deposit/withdraw as modals. See [implementation-plan.md](./implementation-plan.md) Phase 3.
2. ~~**Trust line requirements for LP tokens**~~ → Resolved: AMMDeposit auto-creates LP token trust line (limit 0). See [assumptions-and-questions.md](./assumptions-and-questions.md) §A2.
3. ~~**AMM + permissioned DEX interaction**~~ → Resolved: No `domainID` on AMM transactions. AMM domain-scoping is flagged as future work. See [assumptions-and-questions.md](./assumptions-and-questions.md) §A3.
4. ~~**Error handling & edge cases**~~ → See [amm-error-handling.md](./amm-error-handling.md). Covers 7 AMM-specific tec codes, per-transaction error maps, frozen asset behavior, empty pool handling, rounding edge cases, and recommended error handling patterns.
5. ~~**AMM discovery**~~ → See [amm-discovery.md](./amm-discovery.md). Covers 5 discovery mechanisms (`amm_info` by pair, `account_lines` LP detection, combinatorial queries, `ledger_data` type filter, `ledger_entry`). Key findings: AMM liquidity NOT in `book_offers`; LP token codes are not reversible; `account_lines` + `amm_info` fan-out is the practical approach for user position discovery.
6. ~~**Testnet/devnet AMM support**~~ → Resolved: XLS-30 enabled on mainnet (2024-03-22), testnet, and devnet. See [assumptions-and-questions.md](./assumptions-and-questions.md) §A1.
7. ~~**AMMClawback (XLS-73)**~~ → Resolved: Devnet-only draft amendment for issuers with clawback enabled. Out of scope. See [assumptions-and-questions.md](./assumptions-and-questions.md) §A4.
8. ~~**Fee calculation UX**~~ → Resolved: 0–1000 = 0%–1%. Display as percentage. Typical: 100 (0.1%) stable, 300 (0.3%) normal, 500–1000 (0.5%–1%) volatile. See [assumptions-and-questions.md](./assumptions-and-questions.md) §A10.

## Sources

- [Automated Market Makers (AMMs) — xrpl.org](https://xrpl.org/docs/concepts/tokens/decentralized-exchange/automated-market-makers)
- [XLS-30 Specification — GitHub](https://github.com/XRPLF/XRPL-Standards/blob/master/XLS-0030-automated-market-maker/README.md)
- [XLS-30 Discussion #78 — GitHub](https://github.com/XRPLF/XRPL-Standards/discussions/78)
- [Deep Dive into AMM Integration — xrpl.org blog](https://xrpl.org/blog/2024/deep-dive-into-amm-integration)
- [AMMCreate Transaction](https://xrpl.org/docs/references/protocol/transactions/types/ammcreate)
- [AMMDeposit Transaction](https://xrpl.org/docs/references/protocol/transactions/types/ammdeposit)
- [AMMWithdraw Transaction](https://xrpl.org/docs/references/protocol/transactions/types/ammwithdraw)
- [AMMVote Transaction](https://xrpl.org/docs/references/protocol/transactions/types/ammvote)
- [AMMBid Transaction](https://xrpl.org/docs/references/protocol/transactions/types/ammbid)
- [AMMDelete Transaction](https://xrpl.org/docs/references/protocol/transactions/types/ammdelete)
- [AMM Ledger Entry](https://xrpl.org/docs/references/protocol/ledger-data/ledger-entry-types/amm)
- [amm_info API Method](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/path-and-order-book-methods/amm_info)
- [Create an AMM Tutorial (JavaScript)](https://xrpl.org/docs/tutorials/javascript/amm/create-an-amm)
- [Add Assets to an AMM Tutorial (JavaScript)](https://xrpl.org/docs/tutorials/javascript/amm/add-assets-to-amm)
- [Trade with an AMM Auction Slot Tutorial](https://xrpl.org/docs/tutorials/javascript/amm/trade-with-auction-slot)
- [xrpl.js AMMCreate interface](https://js.xrpl.org/interfaces/AMMCreate.html)
- [xrpl.js AMMInfoRequest interface](https://js.xrpl.org/interfaces/AMMInfoRequest.html)
- [xrpl.js AMMInfoResponse interface](https://js.xrpl.org/interfaces/AMMInfoResponse.html)
