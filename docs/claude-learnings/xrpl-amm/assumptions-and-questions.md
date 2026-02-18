# Assumptions & Questions — XRPL AMM Integration

> Accumulated from research (info.md) and codebase analysis (codebase-summary.md). Questions marked **[BLOCKING]** require user input before implementation can proceed; others are noted for awareness.

---

## Assumptions

### A1. AMM is available on both testnet and devnet

The XLS-30 AMM amendment was enabled on **mainnet on 2024-03-22** and is included in the official xrpl.org JavaScript tutorials that target testnet. Since the app already supports testnet and devnet, we assume AMM is available on both. Unlike the permissioned DEX (XLS-80), AMM does **not** need to be limited to devnet.

### A2. LP token trust lines are auto-created on deposit

The xrpl.js `AMMDeposit` source comments explicitly state: *"If successful, this transaction creates a trust line to the AMM Account (limit 0) to hold the LP Tokens."* We do **not** need to create an LP token trust line before depositing. This differs from normal issued currencies where a trust line is a prerequisite.

### A3. AMM pools cannot be domain-scoped (permissioned DEX)

No AMM transaction type (`AMMCreate`, `AMMDeposit`, `AMMWithdraw`, `AMMVote`, `AMMBid`, `AMMDelete`) includes a `domainID` field in xrpl.js v4.5.0. The project's own XLS-80 research notes confirm: *"AMMs in permissioned domains (noted as future work)."* We will **not** implement domain-scoped AMM support.

### A4. AMMClawback (XLS-73) is out of scope for initial implementation

`AMMClawback` exists in xrpl.js v4.5.0 but is **not yet an enabled amendment on mainnet**. It is a devnet-only feature for issuers who have enabled the clawback account flag. Since this app does not currently support clawback, and the amendment is still in draft, we will exclude it from the initial AMM implementation.

### A5. The existing CLOB DEX trading continues to work alongside AMM

XRPL's AMM injects synthetic liquidity into the order book. Existing `OfferCreate`-based trades automatically benefit from AMM pools without code changes. The AMM feature is **additive** — it does not replace or break any existing DEX functionality.

### A6. AMMCreate requires special transaction cost handling

`AMMCreate` destroys at least the incremental owner reserve (**0.2 XRP** after the 2024 reserve reduction, previously 2 XRP) rather than the standard ~0.00001 XRP fee. The UI must clearly communicate this higher cost. We assume the `xrpl.js` autofill mechanism handles setting the correct `Fee` field, but we will verify this during implementation.

### A7. One AMM per asset pair

The XRPL enforces exactly one AMM instance per unique asset pair. If an AMM already exists for a pair, `AMMCreate` will fail. The UI should check for existing AMMs (via `amm_info`) before offering the create flow, and show pool info if one already exists.

### A8. DefaultRipple is a prerequisite for AMMCreate with issued tokens

The issuer must have `DefaultRipple` enabled. The app already handles this via `/api/accounts/[address]/rippling`, so this is not a new requirement — but the AMM create flow should validate it and guide users to enable it if missing.

### A9. AMM UI will live within the existing `/trade` page as a new tab/section

Rather than creating a separate `/amm` page, AMM functionality will be integrated into the existing trade page. The trade page already has wallet selection, currency pair selection, and order book display. AMM operations (pool info, deposit, withdraw, vote, bid) will be accessible via a new panel or tab alongside the existing order-based trading.

### A10. Fee units: 0–1000 maps to 0%–1%

The `TradingFee` field uses units of 1/100,000 (i.e., 1 = 0.001%). A value of 1000 = 1%. The UI should present this as a percentage with appropriate precision (e.g., "0.30%" for a fee of 300). The constant `AMM_MAX_TRADING_FEE = 1000` is available from xrpl.js.

### A11. LP token currency codes need special display handling

LP tokens use a non-standard 160-bit currency code starting with `0x03` followed by a SHA-512 hash. The existing `decodeCurrency()` function will produce garbled text for these. We need a helper that detects the `0x03` prefix and displays them as "LP Token" or similar human-readable label, possibly with the pool's asset pair names.

---

## Questions

### Q1. **[BLOCKING]** What AMM operations should the UI support?

The full set of AMM transactions is: **Create**, **Deposit**, **Withdraw**, **Vote**, **Bid**, **Delete**. Which should we implement?

- **Minimum viable**: Create + Deposit + Withdraw (core liquidity management)
- **Extended**: + Vote (fee governance) + pool info display
- **Full**: + Bid (auction slot) + Delete (cleanup empty pools)

**Recommendation**: Start with Create + Deposit + Withdraw + pool info display. Vote and Bid add complexity (auction mechanics, weighted voting) with lower user value for an educational/management tool. Delete is only needed for edge cases.

### Q2. **[BLOCKING]** Where should AMM UI live?

Options:
1. **New tab within `/trade` page** — e.g., "Order Book" | "AMM Pools" tabs. Shares wallet/pair selection.
2. **Separate `/amm` page** — Dedicated page with its own navigation entry. Cleaner separation.
3. **Integrated panel on `/trade`** — AMM pool info shown alongside order book; deposit/withdraw in modals.

**Recommendation**: Option 3 (integrated panel) — shows AMM and CLOB side by side, which reflects how XRPL actually works (unified liquidity). Deposit/withdraw forms open as modals (using existing `ModalShell`).

### Q3. **[BLOCKING]** Should the API routes be under `/api/amm/` or `/api/dex/amm/`?

The existing DEX routes are under `/api/dex/`. Options:
1. **`/api/amm/*`** — Parallel to `/api/dex/` (create, deposit, withdraw, vote, bid, delete, info)
2. **`/api/dex/amm/*`** — Nested under DEX (reflects AMM as part of the DEX)

**Recommendation**: Option 1 (`/api/amm/*`) — AMM is conceptually a peer of the order book, not a sub-feature. Cleaner URLs and easier to document.

### Q4. **[BLOCKING]** Which deposit/withdraw modes should the UI expose?

`AMMDeposit` has 6 flag modes, `AMMWithdraw` has 7. Exposing all is overwhelming. Suggested subset:
- **Deposit**: Two-asset proportional (`tfTwoAsset`) + Single-asset (`tfSingleAsset`)
- **Withdraw**: Withdraw all (`tfWithdrawAll`) + Two-asset (`tfTwoAsset`) + Single-asset (`tfSingleAsset`)

Should we start with this subset or expose more modes?

### Q5. What should happen when a user selects a currency pair that has an existing AMM?

Options:
1. **Auto-show pool info**: Fetch `amm_info` whenever a pair is selected and display pool stats (reserves, fee, LP token supply) if an AMM exists
2. **Manual discovery**: User clicks an "AMM Pool" button to check if an AMM exists
3. **Always show**: Always display an AMM panel (showing "No pool exists — Create one?" if empty)

**Recommendation**: Option 1 — automatically query `amm_info` when a pair changes, display pool info if found, show a "Create Pool" CTA if not.

### Q6. How should LP token balances be displayed?

LP tokens show up in `account_lines` / balances with a hex currency code. Options:
1. **Decode to "LP (XRP/USD)"** — Parse the 0x03 prefix, look up the AMM's asset pair, display as human-readable
2. **Show as "LP Token"** — Simple label without decoding which pair it belongs to
3. **Hide from main balances** — Filter LP tokens out of the balances panel; show only in the AMM section

**Recommendation**: Option 3 for the balances panel (avoids clutter), with a dedicated LP positions display in the AMM section that shows the pair name, LP balance, and pool share percentage.

### Q7. Should we add AMM-specific test scripts?

Following the existing pattern (`scripts/test-*.sh`), should we create:
- `test-amm-create.sh` — Create an AMM pool
- `test-amm-deposit.sh` — Deposit liquidity
- `test-amm-withdraw.sh` — Withdraw liquidity
- `test-amm-full.sh` — Full lifecycle (create → deposit → trade → withdraw → check)

**Recommendation**: Yes, at minimum `test-amm-full.sh` covering the complete lifecycle, similar to how `test-permissioned-dex.sh` covers the full permissioned flow.

---

## Resolved Questions (from research)

### ~~Does depositing to an AMM auto-create the LP token trust line?~~
**Yes.** Confirmed from xrpl.js source: `AMMDeposit` creates a trust line (limit 0) to the AMM account automatically.

### ~~Does the permissioned DEX (XLS-80) apply to AMM pools?~~
**No.** No `domainID` field exists on any AMM transaction type. AMM + permissioned domains is flagged as future work.

### ~~Is AMMClawback relevant to our implementation?~~
**Not now.** XLS-73 is devnet-only draft. Skip unless the user's app enables clawback on issuers.

### ~~Is AMM available on testnet?~~
**Yes.** XLS-30 has been enabled on mainnet since 2024-03-22 and is available on both testnet and devnet. Tutorials target testnet.

### ~~What fee range is typical?~~
Fee range is 0–1000 (0%–1%). Common values: 100 (0.1%) for stable pairs, 300 (0.3%) for typical pairs, 500–1000 (0.5%–1%) for volatile pairs. Present as percentage in UI.

### A12. AMMCreate special cost is 0.2 XRP (not 2 XRP)

AMMCreate destroys at least the incremental owner reserve. After the 2024 reserve reduction, this is **0.2 XRP** on mainnet (down from 2 XRP). The implementation plan and UI copy should reflect this. Use xrpl.js autofill to handle the correct fee dynamically rather than hardcoding.

### A13. AMM error handling uses per-route error maps

Each AMM API route will define a `Record<string, string>` mapping known tec/ter/tem codes to user-friendly messages. This follows the pattern already established in `app/api/transfers/route.ts`. See [amm-error-handling.md](./amm-error-handling.md) for the complete error maps.

### A14. Frozen asset detection uses amm_info response fields

The `amm_info` response includes `asset_frozen` and `asset2_frozen` boolean fields when assets are frozen. The AMM Pool Panel should check these and show warnings/disable actions accordingly.

### A15. AMM liquidity is NOT visible in `book_offers` / `getOrderbook()`

AMM synthetic offers are injected at the **transaction execution layer** (payment engine's `BookStep`), not at the API query layer. `book_offers` and `getOrderbook()` return only regular DEX `Offer` ledger entries. Actual trades via `OfferCreate` automatically route through AMMs, but the order book display does not reflect AMM depth. The AMM Pool Panel is essential for visibility. See [amm-discovery.md](./amm-discovery.md).

### A16. LP token currency codes cannot be reverse-decoded to asset pairs

LP token codes use SHA-256 hashing (one-way). To identify which pair an LP token belongs to, look up the LP token's issuer (= AMM pseudo-account) via `amm_info` with `amm_account` parameter. See [amm-discovery.md](./amm-discovery.md).

### A17. User LP position discovery uses `account_lines` → `amm_info` fan-out

LP tokens appear as trust lines with `0x03`-prefix currency codes. The `account` (issuer) field of the trust line is the AMM pseudo-account. Call `amm_info` with `amm_account` to get the pool's asset pair and reserves. This is the practical way to answer "which AMM pools does this user have positions in?" See [amm-discovery.md](./amm-discovery.md).

### A18. LP tokens are pair-specific, not generic across AMMs

Each AMM pool issues its own unique LP token with a distinct currency code (SHA-512 hash) and a distinct issuer (the pool's pseudo-account address). LP tokens from different pools are completely separate assets — holding LP tokens from an XRP/USD pool and a USD/EUR pool means holding two different tokens that are not interchangeable. Each one only redeems for assets from its specific pool.

### A19. AMM Pool Panel is valuable for non-LP users (not just liquidity providers)

The AMM Pool Panel serves all traders, not just LPs. For users who have no LP position, the most relevant information is:

1. **Pool composition** — the two assets and their current balances, which shows available liquidity depth
2. **Implied spot price** — the exchange rate derived from the pool's constant-product formula (`asset2_balance / asset1_balance`), useful for comparing against DEX orderbook prices
3. **Trading fee** — the pool's fee percentage, since it affects effective swap cost
4. **Pool existence** — knowing there's AMM liquidity available (in addition to DEX orderbook liquidity) helps traders decide how to trade

LP-specific information (LP token balance, pool share, vote weight, auction slot) can be de-emphasized or hidden when the user holds no LP tokens for the pair.

### A20. AMM depth can be significant even when the orderbook looks thin

A realistic scenario: few people actively placing limit orders on the DEX orderbook (making it look thin/sparse), but the AMM pool is well-funded. The AMM provides continuous liquidity at every price point along its bonding curve, so even with zero orderbook depth, a user could execute a reasonably-sized trade without massive slippage — as long as the pool is large relative to their trade size.

This reinforces why the AMM Pool Panel is essential (see also A15 — AMM liquidity is NOT visible in `book_offers`). Without it, a user might look at a thin orderbook and incorrectly conclude there's no liquidity when the AMM pool has plenty. Showing pool asset balances gives users a sense of that depth.

### A21. AMM spot price vs orderbook spread enables meaningful comparison

Displaying the AMM implied price alongside the DEX orderbook spread (best bid vs best ask) lets users:

- See whether the AMM price is inside or outside the orderbook spread
- Judge which venue offers a better rate for their trade
- Spot arbitrage gaps (AMM price diverging from orderbook mid-price)

Note: XRPL auto-routes trades through whichever path gives the best price (A5), so the comparison is primarily for **transparency** — helping users understand *why* they're getting a particular rate and where the liquidity comes from.
