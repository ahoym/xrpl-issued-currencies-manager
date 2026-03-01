# Explore-Repo Patterns

Learnings from running the `/explore-repo` skill on this codebase.

## Two-Phase Execution

The explore-repo skill must run in two separate invocations:

1. **Scan phase**: Launches 7 parallel agents to write domain files to `docs/learnings/`. Each agent writes a single file with a metadata header containing the commit hash.
2. **Synthesis phase**: Reads all 7 domain files in a fresh context and produces cross-domain outputs (SYSTEM_OVERVIEW.md, inconsistencies.md, CLAUDE.md updates).

**Why separate**: Synthesis needs a clean context window to cross-reference all 7 files effectively. If scan and synthesis share a context, the scan agents' outputs consume too much context for quality synthesis.

## Scan Metadata Format

Every scan file starts with a multi-line HTML comment:
```
<!-- scan-metadata
agent: structure
commit: abc1234
branch: feature-branch
date: 2026-03-01
-->
```

Staleness is detected by comparing the `commit` field against current HEAD. When only the scan files themselves changed between commits (e.g., they were just committed), the scans are considered current.

## Smart Staleness

When scan files exist but are stale:
1. Run `git diff --stat <stale-commit>..HEAD` to see which files changed
2. Map changed files to affected domains using path-pattern heuristics
3. Only re-scan affected domains (saves time on large codebases)
4. If CLAUDE.md or README.md changed, re-scan ALL domains (project-level docs affect all agents)

## Auto-Fix Strategy

For doc-vs-code inconsistencies:
- **Critical** (actively misleading): Always auto-fix. Example: wrong package version.
- **Medium** (partially wrong): Auto-fix. Example: missing commands, incomplete module lists.
- **Low** (minor): Auto-fix if simple text replacement; skip if requires judgment. Example: cosmetic version pinning.
- **Judgment calls**: Mark as `[UNFIXED]` with reason. Example: README may intentionally show simplified API table.

## Subdirectory CLAUDE.md Evaluation

The skill requires evaluating candidate directories and reporting create/skip decisions. Best candidates have:
- Complex state machines or encoding logic
- Node-only vs browser-safe module splits
- Many non-obvious gotchas that trip up new developers
- Standalone conventions different from the rest of the codebase

For this project, `lib/xrpl/` was the clear winner (encoding asymmetry, client singleton, 20 files with many gotchas).

## Cross-References

Adding `## Cross-references` sections to domain files creates a navigable documentation graph. Only add genuine relationships — don't cross-reference everything to everything. Place the section before `## Scan Limitations`.
