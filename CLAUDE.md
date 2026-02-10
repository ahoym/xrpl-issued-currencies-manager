# CLAUDE.md — XRPL Issued Currencies Manager

## Project Overview

Next.js 16 app for managing XRPL issued currencies. No database — all state comes from the XRP Ledger. Wallet secrets stay client-side and are only sent to API routes when signing is needed.

**Stack**: Next.js 16.1.6, React 19, TypeScript 5, Tailwind v4, pnpm, xrpl v4.5.0

## Commands

- `pnpm dev` — start dev server
- `pnpm build` — production build (use to verify compilation)
- `pnpm lint` — run ESLint
- `scripts/test-all.sh` — run all API test scripts against a running dev server
- Individual test scripts accept `BASE_URL` env var (defaults to `http://localhost:3000`)

## Architecture

- **API routes**: `app/api/` — Next.js App Router route handlers
- **Shared lib**: `lib/xrpl/` — client singleton (`client.ts`), network config (`networks.ts`), TypeScript types (`types.ts`)
- **Test scripts**: `scripts/` — bash scripts using curl + jq for each endpoint
- **OpenAPI spec**: `openapi.yaml` at project root
- **Frontend architecture**: `docs/claude-learnings/frontend-architecture.md` — state management, hooks, page responsibilities, data transformations
- **Development patterns**: `docs/claude-learnings/development-patterns.md` — API route skeleton, test script skeleton, naming conventions

### API Routes

| Route | Methods | Purpose | Test Script |
|---|---|---|---|
| `/api/accounts/generate` | POST | Generate & fund wallet via faucet | `test-generate-account.sh` |
| `/api/accounts/[address]` | GET | Account info from ledger | `test-account-info.sh` |
| `/api/accounts/[address]/balances` | GET | XRP + issued currency balances | `test-balances.sh` |
| `/api/accounts/[address]/trustlines` | GET, POST | View/create trust lines | `test-trustlines.sh` |
| `/api/accounts/[address]/transactions` | GET | Transaction history | `test-transactions.sh` |
| `/api/accounts/[address]/offers` | GET | List account's open DEX offers | `test-dex-offers.sh` |
| `/api/accounts/[address]/credentials` | GET | List account's credentials (XLS-70) | `test-credentials.sh` |
| `/api/accounts/[address]/domains` | GET | List account's permissioned domains (XLS-80) | `test-domains.sh` |
| `/api/accounts/[address]/rippling` | POST | Enable DefaultRipple flag & repair NoRipple trust lines | `test-rippling.sh` |
| `/api/currencies/issue` | POST | Issue currency (Payment from issuer) | `test-issue-currency.sh` |
| `/api/transfers` | POST | Transfer issued currency | `test-transfer.sh` |
| `/api/credentials/create` | POST | Issue a credential (CredentialCreate) | `test-credentials.sh` |
| `/api/credentials/accept` | POST | Accept a credential (CredentialAccept) | `test-credentials.sh` |
| `/api/credentials/delete` | POST | Delete a credential (CredentialDelete) | `test-credentials.sh` |
| `/api/domains/create` | POST | Create/update a permissioned domain (PermissionedDomainSet) | `test-domains.sh` |
| `/api/domains/delete` | POST | Delete a permissioned domain (PermissionedDomainDelete) | `test-domains.sh` |
| `/api/dex/offers` | POST | Place a DEX offer (OfferCreate), optional `domainID` for permissioned DEX | `test-dex-offers.sh`, `test-permissioned-dex.sh` |
| `/api/dex/offers/cancel` | POST | Cancel a DEX offer (OfferCancel) | `test-dex-offers.sh` |
| `/api/dex/orderbook` | GET | View order book for a currency pair, optional `domain` query param | `test-dex-offers.sh` |
| `/api/dex/trades` | GET | Recent trades for a currency pair | — |

### `lib/` Module Map

**XRPL Core** (`lib/xrpl/`)

| Module | Key Exports |
|---|---|
| `client.ts` | `getClient(network)` — singleton XRPL WebSocket client |
| `networks.ts` | `NETWORKS`, `NetworkId`, `resolveNetwork()`, `DEFAULT_NETWORK`, `EXPLORER_URLS` |
| `types.ts` | Request/response interfaces: `GenerateAccountResponse`, `IssueCurrencyRequest`, `TransferRequest`, `TrustLineRequest`, `CreateOfferRequest`, `CancelOfferRequest`, `CreateCredentialRequest`, `AcceptCredentialRequest`, `DeleteCredentialRequest`, `CreateDomainRequest`, `DeleteDomainRequest`, `DexAmount`, `OfferFlag`, `CurrencyBalance`, `ApiError` |
| `constants.ts` | Ledger flags (`LSF_DEFAULT_RIPPLE`, `LSF_ACCEPTED`, `TF_CLEAR_NO_RIPPLE`), limits (`MAX_API_LIMIT`, `DEFAULT_ORDERBOOK_LIMIT`, etc.), epoch helpers (`toRippleEpoch()`, `fromRippleEpoch()`) |
| `currency.ts` | `encodeXrplCurrency()`, `toXrplAmount()`, `fromXrplAmount()` — Node-only; re-exports `decodeCurrency` |
| `decode-currency-client.ts` | `decodeCurrency()` — browser-safe hex-to-ASCII decoder |
| `match-currency.ts` | `matchesCurrency()` — compare orderbook amounts against currency+issuer |
| `offers.ts` | `VALID_OFFER_FLAGS`, `resolveOfferFlags()` — flag strings to bitwise flags |
| `credentials.ts` | `encodeCredentialType()`, `decodeCredentialType()` — hex encoding for credential types (Node-only) |
| `build-dex-amount.ts` | `buildDexAmount()` — construct `DexAmount` objects for XRP or issued currencies |

**Shared Types** (`lib/`)

| Module | Key Exports |
|---|---|
| `types.ts` | `WalletInfo`, `PersistedState`, `NetworkData`, `TrustLine`, `BalanceEntry`, `OrderBookAmount`, `OrderBookEntry`, `CredentialInfo`, `DomainInfo` |
| `assets.ts` | `Assets` (`XRP`, `RLUSD`), `WELL_KNOWN_CURRENCIES` — per-network map of known issuers |

**API Utilities** (`lib/`)

| Module | Key Exports |
|---|---|
| `api.ts` | `validateRequired()`, `walletFromSeed()`, `validateAddress()`, `validateSeedMatchesAddress()`, `validatePositiveAmount()`, `validateCredentialType()`, `validateCurrencyPair()`, `getNetworkParam()`, `getTransactionResult()`, `txFailureResponse()`, `apiErrorResponse()` |
| `rate-limit.ts` | `rateLimit()` — in-memory token-bucket rate limiter |

**UI & Hooks** (`lib/ui/`, `lib/hooks/`)

| Module | Key Exports |
|---|---|
| `ui/ui.ts` | Tailwind class constants (`inputClass`, `labelClass`, `primaryButtonClass`, `errorTextClass`, `successBannerClass`), `SUCCESS_MESSAGE_DURATION_MS` |
| `hooks/use-app-state.tsx` | `AppStateProvider`, `useAppState()` — global state context |
| `hooks/use-api-fetch.ts` | `useApiFetch<T>()` — generic GET hook with refreshKey |
| `hooks/use-api-mutation.ts` | `useApiMutation<T>()` — generic POST hook |
| `hooks/use-local-storage.ts` | `useLocalStorage<T>()` — localStorage sync with hydration |
| `hooks/use-balances.ts` | `useBalances()` |
| `hooks/use-trust-lines.ts` | `useFetchTrustLines()` |
| `hooks/use-issuer-currencies.ts` | `useIssuerCurrencies()` — decoded currency Set from trust lines |
| `hooks/use-account-credentials.ts` | `useAccountCredentials()` |
| `hooks/use-account-domains.ts` | `useAccountDomains()` |
| `hooks/use-trading-data.ts` | `useTradingData()` — aggregates balances, orderbook, offers, trades, currency options |
| `hooks/use-trust-line-validation.ts` | `useTrustLineValidation()` — async trust line + rippling checks |
| `hooks/use-domain-mode.ts` | `useDomainMode()` — domain selector state for permissioned DEX |
| `hooks/use-wallet-generation.ts` | `useWalletGeneration()` |
| `hooks/use-make-market-execution.ts` | `useMakeMarketExecution()` — batch offer placement with progress |

### Frontend Pages

| Route | File | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Redirects to `/setup` |
| `/setup` | `app/setup/page.tsx` | Setup — manage issuer wallets, currencies, recipients |
| `/transact` | `app/transact/page.tsx` | Transfer issued currencies between wallets |
| `/trade` | `app/trade/page.tsx` | DEX trading (orders, orderbook, trades) |
| `/compliance` | `app/compliance/page.tsx` | Manage XLS-70 credentials and XLS-80 domains |

### Utility & Cross-Cutting Scripts

| Script | Purpose |
|---|---|
| `test-all.sh` | Runs all individual test scripts and reports pass/fail summary |
| `setup-full-state.sh` | Bootstraps a full demo environment (wallets, trust lines, currencies, credentials, domain) and saves state to `examples/` |
| `make-market.sh` | Places 3-level bid/ask ladders across 6 currency pairs on the DEX; auto-reads latest state from `examples/` |
| `test-rippling.sh` | Tests DefaultRipple flag behavior and verifies peer-to-peer transfers work after enabling rippling |
| `test-permissioned-dex.sh` | Tests full permissioned DEX flow (credential, domain, domain-scoped offers) — requires devnet |

## Gotchas

- **`xrpl.dropsToXrp()` returns `number`**, not `string` — always wrap with `String()` when assigning to string-typed fields
- **Next.js 16 dynamic route params are `Promise<{...}>`** — must `await params` before accessing values
- **pnpm lockfile warning** about workspace root is cosmetic — parent directory has a `package-lock.json`; safe to ignore
- **XRPL client singleton** — don't disconnect after each request; the module-level client in `lib/xrpl/client.ts` persists across requests for reuse
- **Trust line prerequisite** — before issuing currency, the recipient must have a trust line to the issuer for that currency (validated server-side in `/api/currencies/issue`)
- **Devnet-only amendments** — some XRPL amendments (e.g., PermissionedDEX) are only enabled on devnet. `test-permissioned-dex.sh` hard-codes devnet for this reason
- **`openapi.yaml` is programmatically consumed** — must be updated when API routes change (add/modify endpoints, add fields)
