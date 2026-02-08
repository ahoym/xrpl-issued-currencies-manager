# Scripts

Bash scripts for testing API endpoints and bootstrapping demo state. All scripts default to `BASE_URL=http://localhost:3000` and require `curl` + `jq`.

## Demo Setup

Run these two scripts in order to bootstrap a fully populated demo environment:

```bash
# 1. Generate wallets, trust lines, currencies, credentials, and a domain
#    Saves state JSON to examples/
scripts/setup-full-state.sh

# 2. Place ladder orders on the DEX (auto-reads latest state from examples/)
scripts/make-market.sh
```

### setup-full-state.sh

Bootstraps a complete demo environment on testnet or devnet:

- Generates 5 funded wallets (issuer, 2 recipients, credential issuer, domain owner)
- Creates trust lines for XCAD, XTHB, and RLUSD
- Issues XCAD and XTHB to both recipients
- Issues and accepts KYC credentials
- Creates a permissioned domain

Output is saved to `examples/setup-state-<network>-<date>.json`.

**Environment variables:**

| Variable | Default | Description |
|---|---|---|
| `BASE_URL` | `http://localhost:3000` | API base URL |
| `NETWORK` | _(prompted)_ | `testnet` or `devnet` (skip prompt by setting env var) |

### make-market.sh

Places 3-level bid/ask ladder orders across 6 currency pairs on the DEX.

When run without arguments, it auto-detects the most recent state file in `examples/`. You can also pass a path explicitly:

```bash
scripts/make-market.sh                          # auto-detect
scripts/make-market.sh examples/my-state.json   # explicit
```

**Environment variables:**

| Variable | Default | Description |
|---|---|---|
| `BASE_URL` | `http://localhost:3000` | API base URL |
| `NETWORK` | `testnet` | XRPL network |
| `PERMISSIONED` | `false` | Also place permissioned (domain-scoped) offers |

## API Test Scripts

Individual test scripts for each API endpoint. See `test-all.sh` to run them all at once.

| Script | Endpoint(s) |
|---|---|
| `test-generate-account.sh` | `/api/accounts/generate` |
| `test-account-info.sh` | `/api/accounts/[address]` |
| `test-balances.sh` | `/api/accounts/[address]/balances` |
| `test-trustlines.sh` | `/api/accounts/[address]/trustlines` |
| `test-transactions.sh` | `/api/accounts/[address]/transactions` |
| `test-issue-currency.sh` | `/api/currencies/issue` |
| `test-transfer.sh` | `/api/transfers` |
| `test-dex-offers.sh` | `/api/dex/offers`, `/api/dex/orderbook` |
| `test-credentials.sh` | `/api/credentials/*` |
| `test-domains.sh` | `/api/domains/*` |
| `test-permissioned-dex.sh` | Full permissioned DEX flow (devnet only) |
| `test-rippling.sh` | DefaultRipple flag + peer-to-peer transfers |
