# Security Assessment

Perform a comprehensive security assessment of the codebase's API routes and library code.

## Usage

Run this skill when you want a full security audit of the project. It uses parallel agents for both the audit phase and the fix phase.

## Steps

### Phase 1: Parallel Security Audit

Launch parallel Explore agents, one per code area. Each agent should perform a full security audit analyzing:

- **Input validation**: Are all user inputs validated and sanitized?
- **Secret handling**: Are wallet secrets, seeds, and keys handled securely?
- **Injection risks**: Are there any code/command/query injection vectors?
- **Error info disclosure**: Do error responses leak internal details (stack traces, file paths, config)?
- **Authorization**: Are there missing or bypassable auth checks?
- **Rate limiting**: Are endpoints protected against abuse?
- **Domain-specific risks**: XRPL-specific issues (e.g., unchecked transaction results, missing fee validation)

Suggested agent groupings (adjust based on project structure):

1. **Account routes agent**: `app/api/accounts/` — all account-related endpoints
2. **DEX routes agent**: `app/api/dex/` — offer placement, cancellation, orderbook
3. **Credentials & domains agent**: `app/api/credentials/`, `app/api/domains/` — XLS-70/XLS-80 endpoints
4. **Currency & transfer agent**: `app/api/currencies/`, `app/api/transfers/` — issuance and transfer endpoints
5. **Shared library agent**: `lib/` — client singleton, network config, types, utilities

### Phase 2: Compile Findings

Consolidate all agent findings into a single report organized by severity:

- **Critical**: Exploitable vulnerabilities with immediate impact
- **High**: Serious issues that should be fixed before production
- **Medium**: Issues that reduce security posture
- **Low**: Minor improvements and hardening opportunities
- **Info**: Best practice suggestions

Deduplicate findings that appear across multiple areas (e.g., if the same validation pattern is missing in several routes, report it once with all affected locations).

### Phase 3: Parallel Fix Implementation

Launch parallel general-purpose agents to implement fixes. **Group fixes by file area** to avoid edit conflicts:

- One agent for account route fixes
- One agent for DEX route fixes
- One agent for credentials/domains route fixes
- One agent for lib/ shared code fixes

Each agent should:
1. Apply the fixes for its area
2. Ensure no regressions in the code logic

### Phase 4: Verification

After all fix agents complete:

1. Run `pnpm build` to verify compilation succeeds
2. Run `pnpm lint` to check for any linting issues
3. Optionally run relevant test scripts from `scripts/` against a running dev server

## Notes

- Always group fix agents by file area to prevent concurrent edit conflicts on the same file
- This pattern works for any multi-area codebase audit, not just security — adapt the checklist for performance, accessibility, etc.
