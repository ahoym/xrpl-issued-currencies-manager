# CLAUDE.md — lib/xrpl/

XRPL core library: 20 files providing client management, currency/credential encoding, DEX utilities, AMM math, and order book computation.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    lib/xrpl/                              │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ client.ts   │  │ networks.ts  │  │ constants.ts   │  │
│  │ (singleton) │  │ (URLs,       │  │ (flags, limits,│  │
│  │             │  │  faucets)    │  │  epoch)        │  │
│  └──────┬──────┘  └──────────────┘  └────────────────┘  │
│         │                                                │
│  ┌──────┴──────────────────────────────────────────────┐ │
│  │           Encoding (Node-only)                      │ │
│  │  currency.ts ──── encodeXrplCurrency (40-char hex)  │ │
│  │                    toXrplAmount / fromXrplAmount     │ │
│  │  credentials.ts ─ encodeCredentialType (var hex)    │ │
│  └─────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────┐ │
│  │           Decoding (Browser-safe)                   │ │
│  │  decode-currency-client.ts ── decodeCurrency()      │ │
│  └─────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────┐ │
│  │           DEX / AMM                                 │ │
│  │  order-book-levels.ts ── buildAsks, buildBids       │ │
│  │  midprice.ts ──────────── computeMidpriceMetrics    │ │
│  │  aggregate-depth.ts ───── aggregateDepth            │ │
│  │  estimate-fill.ts ─────── estimateFill (CLOB)       │ │
│  │  estimate-fill-combined ─ estimateFillCombined      │ │
│  │  amm-math.ts ──────────── constant-product math     │ │
│  │  amm-fee.ts / amm-helpers.ts ── fee + spec builders │ │
│  └─────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────┐ │
│  │           Utilities                                 │ │
│  │  offers.ts ──── resolveOfferFlags (flag → bitmask)  │ │
│  │  match-currency.ts ── matchesCurrency (comparison)  │ │
│  │  build-dex-amount.ts ── buildDexAmount              │ │
│  │  filled-orders.ts ──── parseFilledOrders            │ │
│  │  lp-token.ts ── isLpTokenCurrency, formatLpToken    │ │
│  └─────────────────────────────────────────────────────┘ │
│  types.ts ── all request/response interfaces             │
└──────────────────────────────────────────────────────────┘
```

## Critical: Node-only vs Browser-safe Split

| Concern | Node-only (server) | Browser-safe (client) |
|---|---|---|
| Currency encode | `currency.ts` → `encodeXrplCurrency()` (uses `Buffer`) | N/A |
| Currency decode | `currency.ts` re-exports `decodeCurrency` | `decode-currency-client.ts` → `decodeCurrency()` |
| Credential encode | `credentials.ts` → `encodeCredentialType()` (uses `Buffer`) | N/A |
| Amount conversion | `currency.ts` → `toXrplAmount()` / `fromXrplAmount()` | N/A |

**Importing `currency.ts` or `credentials.ts` in a client component will crash** due to Node `Buffer` usage. Use `decode-currency-client.ts` for browser decoding.

## Encoding Gotchas

- **Currency codes**: 3-char pass through; 4-20 char hex-encode + pad to 40 chars; 40-char pass through. Rejects < 3 or 21-39 chars.
- **Credential types**: UTF-8 → uppercase hex, **variable length** (no padding). Completely different from currency encoding.
- **LP tokens**: 40-char hex starting with `03` prefix → decoded as "LP Token" (special case in `decodeCurrency`).
- **Currencies from the ledger may arrive hex-encoded**: Always run through `decodeCurrency()` before display. Use `matchesCurrency()` for comparison (handles both raw and decoded forms).

## Client Singleton

`client.ts` exports `getClient(network)` — a module-level singleton. Key behaviors:
- Same network + connected → reuse existing connection
- Same network + disconnected → attempt reconnect; if that fails, create new client
- Different network → disconnect old client, create new one

**Gotcha**: Concurrent requests for different networks cause connection thrashing. Only one WebSocket connection exists at a time.

## Unit Tests

4 test files with ~80 test cases (run via `pnpm test`):
- `amm-math.test.ts` — AMM constant-product calculations
- `estimate-fill.test.ts` — CLOB-only fill estimation
- `estimate-fill-combined.test.ts` — interleaved CLOB + AMM fill
- `midprice.test.ts` — midprice metric computation

All use `BigNumber` for precise decimal assertions.

## Cross-references

- Full type definitions: `docs/learnings/data-model.md`
- API endpoints consuming these modules: `docs/learnings/api-surface.md`
- Processing workflows: `docs/learnings/processing-flows.md`
