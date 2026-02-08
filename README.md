# XRPL Issued Currencies Manager

A Next.js app for managing issued currencies, credentials, permissioned domains, and DEX offers on the XRP Ledger. No database — all state comes from the ledger. Wallet secrets stay client-side and are only sent to API routes when signing is needed.

**Stack**: Next.js 16, React 19, TypeScript, Tailwind v4, xrpl.js v4.5.0

## Getting Started

```bash
pnpm install
pnpm dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

## Usage

### Full State Setup

`scripts/setup-full-state.sh` provisions a complete test environment in a single run. It creates five funded wallets, establishes trust lines and token balances, issues and accepts credentials, and creates a permissioned domain.

**What it creates:**

| Wallet | Role |
|---|---|
| Issuer | Issues XCAD and XTHB tokens |
| Recipient 1 | Holds XCAD, XTHB; has KYC credential |
| Recipient 2 | Holds XCAD, XTHB; has KYC credential |
| Credential Issuer | Issues KYC credentials to both recipients |
| Domain Owner | Owns a permissioned domain requiring KYC |

Both recipients also get trust lines to the well-known RLUSD issuer (`rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV`).

```bash
# Interactive — prompts for testnet or devnet
./scripts/setup-full-state.sh

# Non-interactive
NETWORK=devnet ./scripts/setup-full-state.sh
```

The script saves all wallet keys and metadata to a JSON state file at `scripts/setup-state-<network>-<date>.json`. This file is used as input for the market-making script.

### Market Making

`scripts/make-market.sh` reads a state file produced by `setup-full-state.sh` and places ladder orders on the DEX to populate order books for testing.

It creates a 3-level bid/ask ladder (2%, 5%, and 10% spread from mid-price) for six currency pairs:

| Pair | Sides | Mid Price | Notes |
|---|---|---|---|
| XCAD/XRP | Bids + Asks | 10 | Full two-sided book |
| XTHB/XRP | Bids + Asks | 0.5 | Full two-sided book |
| XCAD/XTHB | Bids + Asks | 20 | Full two-sided book |
| RLUSD/XRP | Bids only | 2 | Recipients hold no RLUSD to sell |
| XCAD/RLUSD | Asks only | 5 | No RLUSD balance to bid with |
| XTHB/RLUSD | Asks only | 0.25 | No RLUSD balance to bid with |

Recipient 1 places all bid orders; Recipient 2 places all ask orders.

```bash
# Basic usage
./scripts/make-market.sh scripts/setup-state-testnet-2025-01-01.json

# With permissioned offers (duplicates each order with a domain ID)
PERMISSIONED=true ./scripts/make-market.sh scripts/setup-state-testnet-2025-01-01.json

# Override defaults
NETWORK=devnet BASE_URL=http://localhost:3001 ./scripts/make-market.sh state.json
```

| Variable | Default | Description |
|---|---|---|
| `BASE_URL` | `http://localhost:3000` | API base URL |
| `NETWORK` | `testnet` | XRPL network |
| `PERMISSIONED` | `false` | Also place permissioned offers using the domain from the state file |

### Test Scripts

Individual test scripts in `scripts/` exercise each API endpoint. Run them all with:

```bash
./scripts/test-all.sh
```

Or run individually:

```bash
BASE_URL=http://localhost:3000 ./scripts/test-generate-account.sh
```

## Concepts

### Issued Currencies

Issued currencies (also called tokens or IOUs) are fungible tokens on the XRP Ledger. The lifecycle is:

1. **Generate wallets** — create funded wallets for an issuer and one or more recipients
2. **Create trust lines** — each recipient sets a trust line to the issuer for a specific currency code, declaring willingness to hold that token up to a limit
3. **Issue currency** — the issuer sends a Payment transaction to a recipient, creating the token balance

### Credentials (XLS-70)

Credentials are on-ledger attestations (e.g. KYC status) that one account issues to another:

1. **Create credential** — a credential issuer submits a `CredentialCreate` transaction specifying the subject account and a credential type string
2. **Accept credential** — the subject account accepts the credential with `CredentialAccept`, making it active on-ledger
3. **Delete credential** — either party can remove the credential with `CredentialDelete`

### Permissioned Domains (XLS-80)

Permissioned domains define access-control rules based on credentials:

1. **Create domain** — an account creates a `PermissionedDomainSet` transaction specifying which credential(s) grant access (by issuer + type)
2. **Use domain** — the domain ID can be referenced when placing DEX offers, restricting who can trade against them
3. **Delete domain** — the owner removes it with `PermissionedDomainDelete`

### DEX Offers

The XRPL has a built-in decentralized exchange. Offers express intent to trade one currency for another:

1. **Place offer** — submit an `OfferCreate` with `TakerGets` (what you're selling) and `TakerPays` (what you want). Optionally include a `domainID` for permissioned trading
2. **Cancel offer** — remove an open offer with `OfferCancel`
3. **View order book** — query the order book for any currency pair, optionally filtered by permissioned domain

## API Routes

| Route | Methods | Purpose |
|---|---|---|
| `/api/accounts/generate` | POST | Generate and fund a wallet via faucet |
| `/api/accounts/[address]` | GET | Account info from ledger |
| `/api/accounts/[address]/balances` | GET | XRP + issued currency balances |
| `/api/accounts/[address]/trustlines` | GET, POST | View or create trust lines |
| `/api/accounts/[address]/transactions` | GET | Transaction history |
| `/api/accounts/[address]/offers` | GET | List open DEX offers |
| `/api/accounts/[address]/credentials` | GET | List credentials (XLS-70) |
| `/api/accounts/[address]/domains` | GET | List permissioned domains (XLS-80) |
| `/api/currencies/issue` | POST | Issue currency (Payment from issuer) |
| `/api/transfers` | POST | Transfer issued currency between accounts |
| `/api/credentials/create` | POST | Issue a credential |
| `/api/credentials/accept` | POST | Accept a credential |
| `/api/credentials/delete` | POST | Delete a credential |
| `/api/domains/create` | POST | Create/update a permissioned domain |
| `/api/domains/delete` | POST | Delete a permissioned domain |
| `/api/dex/offers` | POST | Place a DEX offer, optional `domainID` for permissioned DEX |
| `/api/dex/offers/cancel` | POST | Cancel a DEX offer |
| `/api/dex/orderbook` | GET | View order book for a currency pair |

All routes accept a `network` parameter (`testnet` or `devnet`).
