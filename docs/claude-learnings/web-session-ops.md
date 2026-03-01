# Web Session Operational Notes

Gotchas and workarounds for Claude Code web sessions in this project.

## Build Verification

`pnpm build` fails in sandboxed web environments because Next.js tries to fetch Google Fonts at build time and the network request is blocked. Use `pnpm typecheck` instead to verify compilation:

```bash
pnpm typecheck   # works in sandbox — runs tsc --noEmit
pnpm build       # fails — Google Fonts fetch blocked
```

## PR Creation

The web session environment has a local git proxy (`http://local_proxy@127.0.0.1:PORT/git/...`) that handles `git push`/`fetch`/`pull` but does **not** expose GitHub REST API endpoints. There are no GitHub API credentials (no `GITHUB_TOKEN`, no `gh auth`) available.

**What works:**
- `git push` / `git fetch` / `git pull` via the local proxy
- The `/web-create-pr` skill's rebase step (dropping the `[web-session] sync skills` commit)
- `apt-get install gh` (the package is available)

**What doesn't work:**
- `gh pr create` — no GitHub token to authenticate
- Direct GitHub API calls via `curl` — rate limited (unauthenticated) or 401
- The egress proxy JWT is for Anthropic's egress control, not GitHub auth

**Workaround:** After pushing, output the manual PR creation URL:
```
https://github.com/OWNER/REPO/pull/new/BRANCH_NAME
```

## Context Window Management

For large refactoring sessions that touch 10+ files:
- Commit frequently (every logical unit of work) so progress isn't lost if the session hits context limits
- If the session is compacted mid-edit, the continuation summary preserves enough detail to resume, but partially-edited files are the main risk
- Use `pnpm typecheck && pnpm test` after each commit to catch issues early rather than batching verification

## Available Tools

| Tool | Available | Notes |
|---|---|---|
| `git` | Yes | Via local proxy, push/pull work |
| `gh` | Installable | `apt-get install gh`, but no auth token |
| `pnpm` | Yes | All commands except `build` (font fetch) |
| `node` / `npx` | Yes | npm registry access may be limited |
| `curl` | Yes | Outbound via egress proxy, rate-limited for GitHub API |
| `apt-get` | Yes | Can install system packages |
