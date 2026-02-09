# Subagent Patterns

## Sandbox Workaround: Lifecycle Scripts for Out-of-Directory Operations

### Problem

Task tool subagents are sandboxed to the project directory. They cannot:
- Create directories outside the project root (e.g., `../worktree-*`)
- Write or edit files outside the project root
- Use `Write` or `Edit` tools with paths that escape the sandbox

This is a problem when a skill needs to operate in a git worktree (which lives outside the project directory) to avoid polluting the user's working tree.

### Solution: Multi-Subcommand Lifecycle Script

Create a single shell script that handles the entire lifecycle of out-of-sandbox operations. The script lives in `~/.claude/commands/<skill-name>/` and is pre-approved via a single permission entry:

```
Bash(bash ~/.claude/commands/<skill-name>/worktree-lifecycle.sh:*)
```

The script accepts subcommands:

| Subcommand | Purpose | Example |
|---|---|---|
| `create <path> <branch>` | Create new branch + worktree from origin/main | `... create ../worktree-foo docs/my-branch` |
| `attach <path> <branch>` | Check out existing remote branch in worktree | `... attach ../worktree-foo existing-branch` |
| `write <path> <file>` | Read stdin, write to file in worktree | `bash ... write ../worktree-foo path/to/file.md <<'EOF'` |
| `commit <path> <msg>` | Stage all + commit in worktree | `... commit ../worktree-foo "Add docs"` |
| `remove <path>` | Remove the worktree | `... remove ../worktree-foo` |

### Key Design Decisions

1. **Content via stdin with heredoc redirect**: The `write` subcommand reads from stdin. Use heredoc redirect syntax (`bash ... write ... <<'DELIM'`) so the command starts with `bash` and matches the pre-approved permission pattern. Do NOT use `cat <<... | bash ...` — that starts with `cat` and will be auto-denied.

2. **Single permission entry**: Instead of needing separate permissions for `git worktree add`, `git worktree remove`, `Write(path:../worktree-*/**)`, etc., one `Bash(bash ~/.claude/commands/.../worktree-lifecycle.sh:*)` covers everything.

3. **Auto-cleanup of stale worktrees**: The `create` and `attach` subcommands auto-remove any existing worktree at the target path from a previous crashed run, then prune orphaned worktree metadata.

4. **Worktree isolation**: The main working directory stays clean — no branch switches, no uncommitted files. The user can continue working while the subagent operates in the worktree.

### Example: Writing a File from a Subagent

```bash
bash ~/.claude/commands/compound-learnings/worktree-lifecycle.sh write ../worktree-compound-learnings docs/claude-learnings/topic.md <<'FILECONTENT'
# Topic Title

Content goes here. Multiline, quotes, backticks — all safe because
we use a heredoc with single-quoted delimiter.
FILECONTENT
```

### When to Use This Pattern

- Any skill that needs to create commits on a different branch without disrupting the user's working tree
- Background agents (Task tool with `run_in_background: true`) that need filesystem access outside the project sandbox
- Skills that run concurrently with user work (worktree isolation prevents conflicts)

## Gotcha: Heredoc Redirect vs Pipe for Permission Matching

### The Problem

When a subagent needs to pass multiline content to a script via stdin, the natural approach is:

```bash
cat <<'EOF' | bash ~/.claude/commands/skill/worktree-lifecycle.sh write ../worktree path/to/file.md
Content here
EOF
```

This **fails** in subagents. The Bash permission system matches on the command prefix — `cat <<'EOF' | bash ...` starts with `cat`, so it does NOT match `Bash(bash ~/.claude/commands/...:*)`. The command is auto-denied with no way to approve it (subagents can't prompt).

### The Fix

Use heredoc redirect syntax instead:

```bash
bash ~/.claude/commands/skill/worktree-lifecycle.sh write ../worktree path/to/file.md <<'EOF'
Content here
EOF
```

This keeps `bash` as the first word, matching the permission pattern. The shell redirects the heredoc to stdin of the `bash` command, achieving the same effect.

### Why This Is Non-Obvious

- Both forms are equivalent in shell behavior (content arrives on stdin)
- The difference is purely in how Claude Code parses the command prefix for permission matching
- The error message ("Permission to use Bash has been auto-denied") doesn't hint at the cause
- Easy to write the pipe form instinctively since it reads more naturally
