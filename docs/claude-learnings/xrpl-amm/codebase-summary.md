# Codebase Summary — XRPL AMM Integration Context

> Concise reference for agents working on AMM feature implementation. Covers the existing architecture, components, and patterns that the AMM feature will integrate with.

## Project Stack

- **Next.js 16.1.6** (App Router, Turbopack dev), **React 19**, **TypeScript 5**, **Tailwind v4**, **pnpm**
- **xrpl.js v4.5.0** — all AMM types (`AMMCreate`, `AMMDeposit`, `AMMWithdraw`, `AMMVote`, `AMMBid`, `AMMDelete`, flags enums, `AMMInfoRequest/Response`) are available
- No database — all state from XRP Ledger; wallet secrets stay client-side, sent to API routes only for signing

## Directory Structure

```
app/
├── api/                         # Next.js API routes (server-side)
│   ├── accounts/                # Account CRUD, balances, trustlines, offers, etc.
│   ├── credentials/             # XLS-70 credential management
│   ├── currencies/              # Issue currencies
│   ├── dex/                     # DEX: offers, cancel, orderbook, trades
│   ├── domains/                 # XLS-80 permissioned domains
│   └── transfers/               # Currency transfers
├── trade/                       # Trade page + 11 components
│   ├── page.tsx                 # Main trade page (271 lines)
│   └── components/              # 11 trade-specific components (~1,800 lines total)
├── setup/                       # Wallet + currency setup
├── transact/                    # Transfer currencies
├── compliance/                  # Credentials + domains
└── components/                  # Shared: NavBar, LoadingScreen, EmptyWallets, ModalShell, etc.
lib/
├── api.ts                       # Validation helpers (validateRequired, walletFromSeed, etc.)
├── assets.ts                    # Asset constants (XRP, RLUSD), well-known currencies per network
├── types.ts                     # Frontend types (WalletInfo, PersistedState, OrderBookEntry, etc.)
├── hooks/                       # 17 React hooks
│   ├── use-app-state.tsx        # Global state context (network, issuer, recipients)
│   ├── use-trading-data.ts      # Aggregates balances, orderbook, offers, trades
│   ├── use-domain-mode.ts       # Permissioned DEX domain selection
│   ├── use-make-market-execution.ts  # Batch order placement
│   └── ... (useBalances, useTrustLines, useApiFetch, useApiMutation, etc.)
├── ui/                          # Tailwind class constants
└── xrpl/                        # XRPL utilities
    ├── client.ts                # Singleton WebSocket client (persists across requests)
    ├── networks.ts              # testnet/devnet URLs, resolver, explorer URLs
    ├── types.ts                 # API request/response interfaces
    ├── constants.ts             # Ledger flags, limits, epoch helpers
    ├── currency.ts              # encodeXrplCurrency, toXrplAmount, fromXrplAmount (Node-only)
    ├── decode-currency-client.ts # decodeCurrency (browser-safe)
    ├── build-dex-amount.ts      # buildDexAmount helper
    ├── match-currency.ts        # matchesCurrency comparator
    ├── offers.ts                # resolveOfferFlags
    ├── filled-orders.ts         # parseFilledOrders from account_tx
    └── credentials.ts           # encodeCredentialType, decodeCredentialType
```

## Global State (`useAppState`)

```typescript
interface PersistedState {
  network: "testnet" | "devnet";
  issuer: WalletInfo | null;           // Token issuer wallet
  credentialIssuer: WalletInfo | null; // XLS-70 credential issuer
  domainOwner: WalletInfo | null;      // XLS-80 domain owner
  currencies: string[];                // Issued currency codes
  recipients: WalletInfo[];            // Trading/recipient wallets
}
```

Stored per-network in localStorage. Actions: `setNetwork`, `setIssuer`, `addCurrency`, `addRecipient`, `setCredentialIssuer`, `setDomainOwner`, `importState`, `clearAll`.

## Trade Page Architecture (Primary Integration Target)

### Component Hierarchy

```
TradePage (page.tsx)
├── WalletSelector              # Select trading wallet from recipients
├── DomainSelector              # Open DEX vs permissioned (domain scoped)
├── CurrencyPairSelector        # Base/quote dropdowns + "Custom Currency" button
├── CustomCurrencyForm          # Add arbitrary currency+issuer
├── TradeGrid                   # 7-column responsive grid
│   ├── RecentTrades            # Left: recent trades table
│   ├── OrderBook               # Center: depth-aware bid/ask display
│   ├── BalancesPanel           # Right top: wallet balances
│   └── TradeForm               # Right bottom: buy/sell with flags
├── OrdersSection (mobile)      # Open + Filled orders (inline)
├── OrdersSheet (desktop)       # Collapsible bottom sheet for orders
└── MakeMarketModal             # 3-level bid/ask ladder builder
```

### Key Data Flow

1. **Currency options** built from: XRP (always) + `WELL_KNOWN_CURRENCIES[network]` + wallet balances + custom currencies. Encoded as `"currency|issuer"` strings.
2. **Order book** fetched from `/api/dex/orderbook`. Frontend re-categorizes by `taker_gets`/`taker_pays` match against base currency (xrpl.js splits by `lsfSell` flag, not book side).
3. **3-second polling** via `usePollInterval` when a pair is selected (silent refresh, no loading spinners).
4. **Offer expiration timers** auto-refresh when offers expire within 5 minutes.
5. **Reactive fill detection** refreshes offers when new trades appear for the user.

### Trade Form

- Buy/Sell tabs, amount/price/total fields
- Execution types: Default (Limit), Passive, IoC, FoK
- Flags: Sell Mode, Hybrid (permissioned DEX only)
- Optional expiration datetime
- Submits `POST /api/dex/offers` with `seed`, `takerGets`, `takerPays`, `flags`, `domainID`, `network`

## API Route Patterns

### Transaction Route (POST)
```
1. Parse body → 2. validateRequired → 3. walletFromSeed → 4. field validation
→ 5. getClient(resolveNetwork(body.network)) → 6. Business logic checks
→ 7. Build tx → 8. client.submitAndWait(tx, { wallet })
→ 9. txFailureResponse check → 10. Return { result } (201)
```

### Query Route (GET)
```
1. await params → 2. validateAddress → 3. getNetworkParam
→ 4. getClient(resolveNetwork(network)) → 5. client.request(...)
→ 6. Transform response → 7. Return JSON (200)
```

### DEX API Routes (Existing)

| Route | Method | Purpose |
|---|---|---|
| `/api/dex/offers` | POST | Place offer (OfferCreate) with optional domainID |
| `/api/dex/offers/cancel` | POST | Cancel offer (OfferCancel) |
| `/api/dex/orderbook` | GET | Fetch order book via `getOrderbook` or raw `book_offers` (domain) |
| `/api/dex/trades` | GET | Recent trades from issuer's `account_tx` |
| `/api/accounts/[address]/offers` | GET | User's open offers via `account_offers` |
| `/api/accounts/[address]/filled-orders` | GET | User's filled orders from `account_tx` |

## Key Utility Functions

| Function | File | Purpose |
|---|---|---|
| `toXrplAmount(dexAmount)` | `lib/xrpl/currency.ts` | Convert API `DexAmount` to XRPL `Amount` (drops for XRP) |
| `fromXrplAmount(amount)` | `lib/xrpl/currency.ts` | Convert XRPL `Amount` to API `DexAmount` |
| `encodeXrplCurrency(code)` | `lib/xrpl/currency.ts` | Encode currency code for XRPL tx (3-char, hex, or 4-20 char) |
| `decodeCurrency(code)` | `lib/xrpl/decode-currency-client.ts` | Browser-safe hex-to-ASCII decode |
| `buildDexAmount(cur, issuer, val)` | `lib/xrpl/build-dex-amount.ts` | Construct `DexAmount` object |
| `matchesCurrency(amt, cur, issuer)` | `lib/xrpl/match-currency.ts` | Compare orderbook amount against currency+issuer |
| `validateCurrencyPair(request)` | `lib/api.ts` | Extract+validate base/quote from query params |
| `toRippleEpoch(date)` / `fromRippleEpoch(ts)` | `lib/xrpl/constants.ts` | Epoch conversion |

## Key Types

```typescript
// API layer
interface DexAmount { currency: string; issuer?: string; value: string; }
type OfferFlag = "passive" | "immediateOrCancel" | "fillOrKill" | "sell" | "hybrid";

// Frontend
interface OrderBookEntry { account: string; taker_gets: OrderBookAmount; taker_pays: OrderBookAmount; quality: string; sequence: number; }
interface AccountOffer { seq: number; flags: number; taker_gets: OrderBookAmount; taker_pays: OrderBookAmount; quality: string; expiration?: number; domainID?: string; }
interface FilledOrder { side: "buy" | "sell"; price: string; baseAmount: string; quoteAmount: string; time: string; hash: string; }
interface BalanceEntry { currency: string; value: string; issuer?: string; }

// Hook-level
interface CurrencyOption { currency: string; issuer?: string; label: string; value: string; }
interface OrderBookData { buy: OrderBookEntry[]; sell: OrderBookEntry[]; }
```

## Patterns That AMM Must Follow

1. **API routes**: Use the POST route skeleton (validate → walletFromSeed → getClient → build tx → submitAndWait → txFailureResponse). Import from `@/lib/api` and `@/lib/xrpl/*`.
2. **GET routes**: Use `getNetworkParam`, `validateAddress`, `apiErrorResponse`. Currency pair validation via `validateCurrencyPair`.
3. **Frontend hooks**: Build on `useApiFetch`/`useApiMutation` or follow the `useTradingData` pattern for aggregated data hooks.
4. **Currency handling**: Use `encodeXrplCurrency` for tx submissions, `decodeCurrency` for display, `buildDexAmount` for constructing amounts.
5. **Amount conversion**: Always use `toXrplAmount`/`fromXrplAmount` when going to/from XRPL wire format.
6. **XRPL client**: Use `getClient(resolveNetwork(network))` — singleton, don't disconnect.
7. **Types**: Define request interfaces in `lib/xrpl/types.ts`, frontend interfaces in `lib/types.ts`.
8. **Components**: Trade page components go in `app/trade/components/`. Use `ModalShell` for modals. Follow Tailwind dark mode pattern (`dark:bg-zinc-*`).
9. **Test scripts**: Bash scripts in `scripts/` using `lib.sh` helpers. Follow existing naming: `test-<feature>.sh`.
10. **OpenAPI spec**: Update `openapi.yaml` when adding new API routes.

## Existing Infrastructure to Reuse

| Need | Existing Solution |
|---|---|
| Place AMM transactions | Same pattern as `/api/dex/offers` POST route |
| Query AMM info | Same pattern as `/api/dex/orderbook` GET route (use `client.request({ command: "amm_info", ... })`) |
| Currency pair selection | `CurrencyPairSelector` component + `useTradingData` currency options |
| Wallet selection | `WalletSelector` component |
| Balance display | `BalancesPanel` component + `useBalances` hook |
| Modal forms | `ModalShell` component |
| Amount construction | `buildDexAmount`, `toXrplAmount` |
| Validation | All `lib/api.ts` helpers |
| Polling/refresh | `usePollInterval`, `refreshKey` pattern |

## What Doesn't Exist Yet (AMM Greenfield)

- No AMM API routes (no `/api/amm/*` or `/api/dex/amm/*`)
- No AMM types in `lib/xrpl/types.ts` (need request interfaces for create, deposit, withdraw, vote, bid, delete)
- No AMM-related hooks
- No AMM UI components (pool info, deposit/withdraw forms, fee voting, LP token display)
- No AMM constants (e.g., `AMM_MAX_TRADING_FEE = 1000`)
- No test scripts for AMM operations
- No OpenAPI spec entries for AMM routes
- LP token currency codes use a special 160-bit format — will need a decoder

## Gotchas Relevant to AMM Implementation

1. **`dropsToXrp()` returns number** — always wrap with `String()`
2. **Next.js 16 params are `Promise<{...}>`** — must `await params`
3. **Turbopack rejects JSX in `.ts`** — use `.tsx` for files with JSX
4. **Turbopack rejects `<Context value={...}>`** — use `<Context.Provider value={...}>`
5. **XRPL client singleton** — don't disconnect between requests
6. **LP tokens have non-standard currency codes** — first 8 bits are `0x03`, rest is SHA-512 hash. `decodeCurrency` will NOT produce readable text for these; need special handling.
7. **AMM amounts use XRPL `Amount` type** — same as order book; use `toXrplAmount`/`fromXrplAmount` converters
8. **AMMCreate costs ~0.2 XRP** (owner reserve destruction after 2024 reduction, previously 2 XRP), not standard tx fee — must warn user
9. **DefaultRipple required** — issuer must have DefaultRipple enabled before AMM can be created with their token. The app already handles this in `/api/accounts/[address]/rippling`.
10. **`book_offers` does NOT include AMM liquidity** — AMM synthetic offers are injected at the tx execution layer (payment engine), not the API query layer. `getOrderbook()` returns only regular DEX offers. The AMM Pool Panel must separately fetch `amm_info` to show pool depth. See [amm-discovery.md](../xrpl-amm/amm-discovery.md).
11. **LP token issuer = AMM pseudo-account** — The `account` field of an LP token trust line is the AMM's pseudo-account address. Pass it to `amm_info` as `amm_account` to identify the pool's asset pair.
