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
