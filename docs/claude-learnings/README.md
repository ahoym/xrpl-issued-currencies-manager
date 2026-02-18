# Deep Reference Docs

Task-specific research, patterns, and gotchas. Consult based on what you're working on — don't load everything.

**If modifying frontend components, hooks, or page layout:**
→ `frontend-architecture.md` — AppStateContext shape, data fetching patterns (useApiFetch / useApiMutation / mutation-refresh cycle), per-page hook and API usage, shared component catalog

**If rendering on-ledger data (URIs, credential fields, user-supplied strings) in the UI:**
→ `frontend-security.md` — XSS prevention for untrusted data in href/src attributes; protocol allowlist pattern

**If adding or modifying API routes or test scripts:**
→ `development-patterns.md` — Annotated POST/GET route skeletons, validation helper reference, test script structure with lib.sh helpers, naming conventions

**If working on DEX order placement, order book display, or trading logic:**
→ `xrpl-dex.md` — Offer semantics (TakerGets/TakerPays), OfferCreate flags, auto-bridging, tick size, funding rules, offer lifecycle

**If working on credentials (XLS-70), permissioned domains (XLS-80), or permissioned DEX (XLS-81):**
→ `xrpl-permissioned-domains.md` — Credential lifecycle (create/accept/delete), domain membership rules, three-role model (currency issuer vs credential issuer vs domain owner), OfferCreate DomainID field, end-to-end flow diagram

**If debugging xrpl.js type issues or transaction metadata extraction:**
→ `xrpl-implementation-gotchas.md` — v4.5.0 type definitions for credentials/domains, `getOrderbook()` vs raw `book_offers` (domain support), credential vs currency hex encoding differences, TransactionMetadata double cast pattern

**If implementing AMM (XLS-30) features** (subdirectory: `xrpl-amm/`):
→ `xrpl-amm/info.md` — AMM concepts, transaction types (Create/Deposit/Withdraw/Vote/Bid/Delete), LP tokens, CLOB integration, xrpl.js type availability
→ `xrpl-amm/codebase-summary.md` — Existing infrastructure to reuse, trade page component hierarchy, patterns AMM code must follow, what's greenfield
→ `xrpl-amm/implementation-plan.md` — 4-phase plan with dependency graph, parallelization schedule, file change summary
→ `xrpl-amm/amm-error-handling.md` — 7 AMM-specific tec codes, per-transaction error maps with user-friendly messages, edge cases (frozen assets, empty pools, rounding)
→ `xrpl-amm/amm-discovery.md` — Pool discovery via amm_info, LP position detection via account_lines, critical finding: book_offers does NOT include AMM liquidity
→ `xrpl-amm/assumptions-and-questions.md` — 17 resolved assumptions + 4 blocking design questions requiring user input
