# XRPL Decentralized Exchange (DEX) — Research Notes

> Sourced from [xrpl.org DEX docs](https://xrpl.org/docs/concepts/tokens/decentralized-exchange) and related pages.

## Overview

- The XRP Ledger has had a built-in DEX since 2012 — one of the oldest decentralized exchanges.
- Uses a **Central Limit Order Book (CLOB)**, not an AMM-only model. A hybrid CLOB + AMM mode is also available — the protocol picks whichever gives the best rate.
- Trades execute when ledgers close (every 3–5 seconds). Transaction execution order is intentionally unpredictable to discourage front-running.
- No native market orders, stop orders, or leverage.

## Offers (Limit Orders)

An **Offer** is a limit order created via an `OfferCreate` transaction.

### Key fields

| Field | Description |
|---|---|
| `TakerPays` | Amount the offer creator wants to receive |
| `TakerGets` | Amount the offer creator will give up |
| `Expiration` | (Optional) Time after which the offer is inactive (seconds since Ripple Epoch) |
| `OfferSequence` | (Optional) Sequence of a previous offer to cancel when placing this one |

### OfferCreate flags

| Flag | Hex | Effect |
|---|---|---|
| `tfPassive` | 0x00010000 | Don't consume offers at the exact same rate — only crossing offers. Useful for pegging exchange rates. |
| `tfImmediateOrCancel` | 0x00020000 | Execute as much as possible immediately; never place a resting order. |
| `tfFillOrKill` | 0x00040000 | Cancel entirely if the full amount can't be filled immediately. |
| `tfSell` | 0x00080000 | Spend the entire `TakerGets` amount even if it means receiving more than `TakerPays`. |

### Offer lifecycle

1. **Created** — `OfferCreate` tx is submitted.
2. **Immediate matching** — The engine consumes matching offers from the opposite order book, best rate first.
3. **Resting** — Any unfilled remainder becomes an Offer ledger entry (unless IoC/FoK).
4. **Removed** — Consumed by a matching offer, cancelled via `OfferCancel`, expired, or found unfunded during tx processing.

### Funding rules

- Placing an offer does **not** lock up funds. You can place multiple offers against the same balance.
- An offer becomes **unfunded** if the seller's balance drops, trust lines are frozen, XRP reserves are insufficient, or the offer expires.
- Unfunded offers stay in the ledger until a transaction encounters and removes them (lazy cleanup).

### Trust lines and offers

- Offers can exceed trust line limits (explicit trade intent overrides limits).
- Executing an offer auto-creates a trust line (with limit 0) if needed — requires XRP reserve.

## Auto-Bridging

- Any token-to-token trade can automatically use **XRP as an intermediary** when it produces a better rate.
- Creates a **synthetic order book** by composing two order books: `TokenA:XRP` and `XRP:TokenB`.
- Quality (exchange rate) of bridged offers is the product of the two legs' rates.
- Direct and bridged offers are sorted into a **combined order book** from best to worst rate.
- Happens automatically at the protocol level — no trader action required.

### Example

Trading GBP for BRL with thin direct liquidity: the DEX automatically buys XRP with GBP, then sells XRP for BRL, if that composite rate beats the direct GBP/BRL rate.

## Tick Size

- Issuers can set a `TickSize` (3–15, or 0 to disable) via `AccountSet`.
- Truncates exchange rates to that many **significant digits** when an offer is placed in the order book.
- Lower TickSize = larger minimum price increment between resting offers.
- Does **not** affect the immediately-executed portion of an offer.
- `tfImmediateOrCancel` offers are unaffected by TickSize.
- Rounding applies to the "less important" side: `TakerPays` for buys, `TakerGets` for sells.

## Cross-Currency Payments

- A `Payment` transaction can consume DEX offers to convert currencies along the way.
- The protocol finds **payment paths** through intermediary accounts and order books.
- **Rippling** allows tokens with the same currency code but different issuers to flow through intermediary trust lines.
- Pathfinding APIs: `ripple_path_find` (one-shot) and `path_find` (WebSocket streaming).
- Payments can use **multiple paths** simultaneously, combining liquidity from different sources.
- Auto-bridging through XRP also applies to cross-currency payments.

## Relevance to This Project

Our app currently supports:
- Issuing currencies (Payment from issuer to recipient)
- Setting up trust lines
- Transferring issued currencies

Potential DEX integration points:
- **Place offers** — Let users trade their issued currencies on the DEX via `OfferCreate`.
- **View order book** — Use `book_offers` API to show current market depth.
- **Cancel offers** — `OfferCancel` to manage open orders.
- **Cross-currency payments** — Allow payments that auto-convert via the DEX.
- **Tick size configuration** — Issuers could set `TickSize` via `AccountSet` to control price granularity.

## Sources

- [Decentralized Exchange](https://xrpl.org/docs/concepts/tokens/decentralized-exchange)
- [Offers](https://xrpl.org/docs/concepts/tokens/decentralized-exchange/offers)
- [Auto-Bridging](https://xrpl.org/docs/concepts/tokens/decentralized-exchange/autobridging)
- [Tick Size](https://xrpl.org/docs/concepts/tokens/decentralized-exchange/ticksize)
- [Cross-Currency Payments](https://xrpl.org/docs/concepts/payment-types/cross-currency-payments)
- [Paths](https://xrpl.org/docs/concepts/tokens/fungible-tokens/paths)
- [OfferCreate Transaction](https://xrpl.org/docs/references/protocol/transactions/types/offercreate)
- [OfferCancel Transaction](https://xrpl.org/docs/references/protocol/transactions/types/offercancel)
- [Offer Ledger Entry](https://xrpl.org/docs/references/protocol/ledger-data/ledger-entry-types/offer)
- [Trade in the DEX Tutorial](https://xrpl.org/docs/tutorials/how-tos/use-tokens/trade-in-the-decentralized-exchange)

## `book_offers` Funded Amount Behavior

> Learned from implementation experience building the order book UI.

### Unfunded offer handling at the protocol level

The XRPL `book_offers` response **already omits completely unfunded offers** — they are lazily cleaned up when encountered during transaction processing and never appear in API results. However, **partially funded offers** where `taker_gets_funded` or `taker_pays_funded` round down to `"0"` **can still appear**. These must be filtered client-side.

### Funded amount fields

| Field | When present | Meaning |
|---|---|---|
| `taker_gets_funded` | Offer is NOT fully funded | Actual fillable amount the taker would receive |
| `taker_pays_funded` | Offer is NOT fully funded | Actual amount the taker would need to pay |
| `owner_funds` | Highest-ranked offer per trader | Creator's available balance of `TakerGets` currency |

Key behaviors:
- **Fully funded offers**: `taker_gets_funded` / `taker_pays_funded` are **absent** — use `taker_gets` / `taker_pays` as-is
- **Partially funded offers**: these fields show the actual fillable amounts (no extra API calls needed — same `book_offers` response)
- **Effectively unfunded** (funded value rounds to 0): fields are present with `"0"` — **must filter these out**
- `owner_funds` only appears on the **highest-ranked offer** when a trader has multiple offers in the same book

### Accurate order book display pattern

When displaying order book data, use `taker_gets_funded ?? taker_gets` (and same for pays) to show actual fillable size instead of the stated offer size. This affects:

1. **Order book rows**: Use funded amounts for size/total columns so users see real available liquidity
2. **Depth aggregation**: Sum funded amounts (not raw amounts) for accurate bid/ask volume totals and level counts
3. **Filtering**: Must filter where BOTH `amount > 0` AND `price > 0` — filtering only on amount misses the case where `taker_pays_funded` is `"0"` (producing a 0-price row that still has positive amount)

### Implementation pattern

```typescript
// In normalizeOffer (API layer):
...(offer.taker_gets_funded && {
  taker_gets_funded: fromXrplAmount(offer.taker_gets_funded),
}),
...(offer.taker_pays_funded && {
  taker_pays_funded: fromXrplAmount(offer.taker_pays_funded),
}),

// In order book component (UI layer):
const amount = new BigNumber(
  (o.taker_gets_funded ?? o.taker_gets).value
);
const total = new BigNumber(
  (o.taker_pays_funded ?? o.taker_pays).value
);
const price = total.div(amount);

// Filter out effectively-unfunded offers:
.filter((o) => o.amount.gt(0) && o.price.gt(0));
```
