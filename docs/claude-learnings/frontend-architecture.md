# Frontend Architecture

Functional architecture reference for the Next.js frontend. Focused on logic, data flow, and integration points — not visual layout.

## State Management

### AppStateContext

Global state lives in `AppStateContext`, provided by `AppStateProvider` in `app/components/providers.tsx` (mounted in `app/layout.tsx`).

**Source:** `lib/hooks/use-app-state.tsx`

### PersistedState Shape

```typescript
interface PersistedState {
  network: "testnet" | "devnet";
  issuer: WalletInfo | null;
  credentialIssuer: WalletInfo | null;
  domainOwner: WalletInfo | null;
  currencies: string[];
  recipients: WalletInfo[];
}
```

### Per-Network localStorage Persistence

- Network selection: key `xrpl-manager-network`
- Network-specific data: key `xrpl-manager-state-${network}` (stores `NetworkData`, which is `PersistedState` minus the `network` field)
- Legacy key `xrpl-manager-state` is auto-migrated on first load

### Hydration Pattern

`useLocalStorage` exposes a `hydrated` boolean that flips to `true` after the initial `useEffect` reads from localStorage. Until `hydrated` is true, the layout renders `<LoadingScreen />` to avoid SSR/client mismatch flicker.

### State Mutation Functions

| Function | Effect |
|---|---|
| `setNetwork(network)` | Switch between testnet/devnet; triggers re-read of network-keyed localStorage |
| `setIssuer(wallet)` | Replace issuer wallet |
| `addCurrency(code)` | Append currency code (idempotent) |
| `removeCurrency(code)` | Remove currency code |
| `addRecipient(wallet)` | Append wallet to recipients |
| `setCredentialIssuer(wallet)` | Replace credential issuer wallet |
| `setDomainOwner(wallet)` | Replace domain owner wallet |
| `importState(state)` | Bulk-import PersistedState; handles network switching + localStorage sync |
| `clearAll()` | Wipe current network's data from localStorage |

## Data Fetching Patterns

### useApiFetch\<T\>

**Source:** `lib/hooks/use-api-fetch.ts`

Generic GET hook. Signature:

```typescript
useApiFetch<T>(
  buildUrl: () => string | null,       // null skips fetch and clears data
  extractData: (json) => T[],          // pull array from response JSON
  externalRefreshKey?: number,          // parent-controlled re-fetch trigger
) => { data: T[]; loading; error; refresh(); refetch() }
```

- `refresh()` increments internal `refreshKey` to trigger `useEffect` re-fetch
- `refetch()` directly calls the fetch function (immediate, no key change)

### useApiMutation\<T\>

**Source:** `lib/hooks/use-api-mutation.ts`

Generic POST hook. Signature:

```typescript
useApiMutation<T>() => {
  loading; error; clearError();
  mutate(url, body, errorFallback?) => Promise<T | null>;
}
```

### Mutation-Refresh Cycle

Pages follow a consistent pattern:

1. User action triggers `mutate(url, body)` via `useApiMutation`
2. On success, page increments a `refreshKey` state variable
3. Dependent `useApiFetch` hooks receive `refreshKey` as `externalRefreshKey` and re-fetch

### Specialized Hooks

All built on `useApiFetch` or `useApiMutation`. Several thin wrappers use the `createAccountFetchHook` factory (see below).

| Hook | Source | Wraps | Purpose |
|---|---|---|---|
| `useBalances` | `lib/hooks/use-balances.ts` | `createAccountFetchHook` | Fetch XRP + issued currency balances |
| `useFetchTrustLines` | `lib/hooks/use-trust-lines.ts` | `createAccountFetchHook` | Fetch trust lines for an address |
| `useIssuerCurrencies` | `lib/hooks/use-issuer-currencies.ts` | `useFetchTrustLines` | Decode trust line currencies into a `Set<string>` |
| `useAccountCredentials` | `lib/hooks/use-account-credentials.ts` | `useApiFetch` | Fetch credentials by role (issuer/subject) |
| `useAccountDomains` | `lib/hooks/use-account-domains.ts` | `createAccountFetchHook` | Fetch permissioned domains |
| `useTrustLineValidation` | `lib/hooks/use-trust-line-validation.ts` | direct fetch | Async trust line + DefaultRipple checks |
| `useTradingData` | `lib/hooks/use-trading-data.ts` | `useBalances` + `useApiFetch` | Aggregates balances, orderbook, offers, trades, currency options |
| `useDomainMode` | `lib/hooks/use-domain-mode.ts` | `useAccountDomains` | Domain selector state for permissioned DEX |
| `useWalletGeneration` | `lib/hooks/use-wallet-generation.ts` | `useApiMutation` | Call `/api/accounts/generate`, invoke callback with `WalletInfo` |
| `useMakeMarketExecution` | `lib/hooks/use-make-market-execution.ts` | `useApiMutation` | Batch offer placement with progress tracking |
| `useFormSubmit<T>` | `lib/hooks/use-form-submit.ts` | — | Form submission state machine: `{ submitting, error, success, submit, clearError }` with auto-clearing success timer |
| `useLocalStorage<T>` | `lib/hooks/use-local-storage.ts` | — | Generic localStorage sync with hydration flag |

### createAccountFetchHook Factory

**Source:** `lib/hooks/create-account-fetch-hook.ts`

Factory for thin wrapper hooks that fetch a single resource scoped to an account address. Reduces boilerplate — each wrapper is a one-liner:

```typescript
export const useBalances = createAccountFetchHook<BalanceEntry>("balances", "balances");
export const useFetchTrustLines = createAccountFetchHook<TrustLine>("trustlines", "trustLines");
export const useAccountDomains = createAccountFetchHook<DomainInfo>("domains", "domains");
```

Signature: `createAccountFetchHook<T>(path: string, jsonField: string)` returns a hook `(address, network, refreshKey?) => { data: T[]; loading; error; refresh; refetch }`.

**Exception:** `useAccountCredentials` is NOT a factory hook because it needs an extra `role` query parameter.

### useFormSubmit

**Source:** `lib/hooks/use-form-submit.ts`

Encapsulates the form submission state machine pattern used by 7+ form components:

```typescript
const { submitting, error, success, submit, clearError } = useFormSubmit<ResponseType>();

// submit(url, body, options?) — handles fetch, JSON parse, error/success state, auto-clear timer
await submit("/api/some-endpoint", { ...formData }, {
  onSuccess: (data) => { /* refresh, close modal, etc. */ },
});
```

- Auto-clears success after `SUCCESS_MESSAGE_DURATION_MS` (from `lib/ui/ui.ts`)
- Cleans up pending timers on unmount
- Replaces the repeated `useState(false) + useState<string|null>(null) + try/catch/finally + setTimeout` pattern

## Page Responsibilities

### /setup (`app/setup/page.tsx`)

**State:** `refreshKey`, `showJson`
**Hooks:** `useAppState()`, `useIssuerCurrencies()`
**APIs:** `/api/accounts/{issuer}/trustlines` (via `useIssuerCurrencies`)
**Key logic:**
- Auto-merges on-ledger currencies into localStorage (useEffect watches `onLedgerCurrencies`)
- JSON import/export with validation for `PersistedState` shape
- Delegates to child components: `IssuerSetup`, `RecipientWallets`, `SecurityWarning`

### /transact (`app/transact/page.tsx`)

**State:** `refreshKey`, `sendingFrom`, `allWallets` (memoized issuer + recipients)
**Hooks:** `useAppState()`
**APIs (via children):** `/api/accounts/{address}/balances`, `/api/currencies/issue`, `/api/transfers`, `/api/accounts/{address}/trustlines` (POST)
**Key logic:**
- Trust line validation via `useTrustLineValidation` (in `TransferModal`)
- Burn detection: sending to issuer address
- Rippling check before peer-to-peer transfers
- On transfer complete, increments `refreshKey` to refresh all balances

### /trade (`app/trade/page.tsx`)

**State:** `focusedWallet`, `sellingValue`/`buyingValue` (encoded as `"currency|issuer"`), `customCurrencies`, `refreshKey`, domain state via `useDomainMode()`
**Hooks:** `useAppState()`, `useTradingData()`, `useMakeMarketExecution()`, `useDomainMode()`
**APIs:**
- `/api/accounts/{address}/balances`
- `/api/dex/orderbook?...&domain=...` (optional domain param)
- `/api/accounts/{address}/offers`
- `/api/dex/trades?...&domain=...`
- `/api/dex/offers` (POST, for placing orders)
**Key logic:**
- Currency option building (XRP + well-known + balances + custom)
- Orderbook re-categorization by base/quote match
- Domain-scoped filtering for permissioned DEX
- "Make Market" batches multiple orders with progress tracking

### /compliance (`app/compliance/page.tsx`)

**State:** `activeTab` ("credentials" | "domains"), `editingDomain`
**Hooks:** `useAppState()`, `useWalletGeneration()` (x2), `useAccountCredentials()`, `useAccountDomains()`
**APIs:**
- `/api/accounts/generate` (POST)
- `/api/accounts/{address}/credentials?role=issuer`
- `/api/accounts/{address}/domains`
- `/api/credentials/create`, `/api/credentials/accept`, `/api/credentials/delete` (POST)
- `/api/domains/create`, `/api/domains/delete` (POST)
**Key logic:**
- Two-wallet setup (credential issuer + domain owner)
- Tabbed interface (credentials | domains)
- Credential CRUD with accept/decline flow
- Domain create/edit with accepted credentials list

## Key Data Transformations

### Hex Currency Decoding

**Source:** `lib/xrpl/decode-currency-client.ts` — `decodeCurrency(code)`

Browser-safe (uses `String.fromCharCode`, not `Buffer`). Decodes 40-char hex XRPL currency codes to ASCII. Passes through short codes (e.g., "USD") unchanged. Returns original code if decoding produces non-printable characters.

### Orderbook Re-categorization

**Source:** `app/trade/components/order-book.tsx`

`xrpl.js` `getOrderbook()` splits offers by `lsfSell` ledger flag, not by book side. The frontend re-categorizes:

- **Asks** (sell base): filter where `taker_gets` matches base currency. Price = `taker_pays / taker_gets`.
- **Bids** (buy base): filter where `taker_pays` matches base currency. Price = `taker_gets / taker_pays`.

Uses `matchesCurrency()` from `lib/xrpl/match-currency.ts` for comparison.

### Currency Options

**Source:** `lib/hooks/use-trading-data.ts`

Builds dropdown options by merging (deduped by `"currency|issuer"` key):

1. XRP (always first)
2. Well-known currencies from `WELL_KNOWN_CURRENCIES[network]`
3. Account balances (decoded currencies + issuers)
4. Custom currencies (user-added)

Each option: `{ currency, issuer?, label, value }` where value is `"currency|issuer"`.

### DEX Amount Building

**Source:** `lib/xrpl/build-dex-amount.ts` — `buildDexAmount(currency, issuer, value)`

Constructs `DexAmount` objects. Returns `{ currency: "XRP", value }` for XRP, or `{ currency, issuer, value }` for issued currencies.

## Shared Components

### Layout-Level

| Component | Source | Purpose |
|---|---|---|
| `Providers` | `app/components/providers.tsx` | Wraps app in `AppStateProvider` |
| `NavBar` | `app/components/nav-bar.tsx` | Top nav with network selector and page links |
| `NetworkSelector` | `app/components/network-selector.tsx` | Testnet/devnet switcher |
| `LoadingScreen` | `app/components/loading-screen.tsx` | Full-page spinner during hydration |
| `EmptyWallets` | `app/components/empty-wallets.tsx` | Empty state when no wallets configured |

### Reusable

| Component | Source | Purpose |
|---|---|---|
| `ModalShell` | `app/components/modal-shell.tsx` | Reusable modal with backdrop-close |
| `ExplorerLink` | `app/components/explorer-link.tsx` | Address link to XRPL explorer + copy button |
| `BalanceDisplay` | `app/components/balance-display.ts` | Fetches and groups balances by currency |
| `CollapsibleSection` | `app/components/collapsible-section.tsx` | Toggle-able section with chevron indicator (▸/▾) and `aria-expanded` |
| `TabBar` | `app/components/tab-bar.tsx` | Generic tab navigation with blue active indicator; accepts `TabBar<T extends string>` for type-safe tab values |

### UI Constants

**Source:** `lib/ui/ui.ts`

Tailwind class constants for consistent styling:

| Export | Purpose |
|---|---|
| `inputClass` | Standard text input |
| `labelClass` | Form label |
| `primaryButtonClass` | Blue primary action button |
| `secondaryButtonClass` | Gray bordered secondary button |
| `successButtonClass` | Green success/confirm button |
| `dangerButtonClass` | Red destructive action button |
| `errorTextClass` | Red error message text |
| `successBannerClass` | Green success banner |
| `SUCCESS_MESSAGE_DURATION_MS` | Auto-clear timer for success messages (used by `useFormSubmit`) |
