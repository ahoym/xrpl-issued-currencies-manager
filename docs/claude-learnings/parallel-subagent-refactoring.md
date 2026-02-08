# Parallel Subagent Orchestration for Large Refactors

When a code review identifies 10+ changes across many files, distributing work across parallel subagents can dramatically speed up execution. The key constraint is **non-overlapping file sets** — each agent must own a distinct set of files to avoid edit conflicts.

## Pattern

1. **Group changes by file domain** (not by change type):
   - API routes agent
   - Frontend components agent
   - Library/shared code agent
   - Test scripts agent

2. **Assign each agent a complete, non-overlapping set of files** with detailed instructions for what to change in each file.

3. **Each agent runs `pnpm build` (or equivalent)** at the end to verify its changes compile.

4. **Run a final build in the parent** after all agents complete to verify cross-agent compatibility.

## Why group by file domain, not change type?

Grouping by change type (e.g., "one agent does all `validateRequired` replacements, another does all `getNetworkParam` replacements") creates conflicts when both agents need to edit the same file's imports. Grouping by file domain ensures each file is only touched by one agent.

## Example from session

A codebase-wide refactor touching 52 files was split across 4 agents:

| Agent | Files | Changes |
|-------|-------|---------|
| API routes | 14 route files | `validateRequired`, `getNetworkParam`, `NextRequest`, named constants, comments |
| Frontend | 12 component files | Epoch utility, magic numbers, accessibility attributes |
| Lib | 3 lib files | Silent error handling fixes |
| Scripts | 13 test scripts + 1 new file | Shared `lib.sh`, grep fixes, `test-all.sh` update |

All 4 agents ran in parallel and completed without conflicts. Total: 52 files changed, 310 insertions, 171 deletions.

## Gotchas

- **Don't add more agents than file groups** — splitting a 14-file domain across 2 agents risks conflicts on shared imports or types
- **Each agent needs full context** — include the helper signatures, constant names, and import paths so agents don't have to discover them
- **Intermediate builds may pass even if cross-agent changes conflict** — always run a final build after all agents complete
