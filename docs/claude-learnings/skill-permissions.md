# Skill Permission Patterns

Patterns for making Claude Code skills run autonomously without per-step permission prompts.

## Helper script pattern for scoped Bash permissions

When a skill needs Bash commands that don't match existing pre-approved permission patterns (e.g., `git -C <path> add`), wrap them in a small helper script and pre-approve just that script. This avoids overly broad patterns like `Bash(git -C:*)` while enabling fully autonomous background execution.

**Example**: A `worktree-commit.sh` script wraps `git -C <path> add` and `git -C <path> commit`:

```bash
#!/usr/bin/env bash
# ~/.claude/commands/compound-learnings/worktree-commit.sh
WORKTREE_PATH="$1"
COMMIT_MSG="$2"

git -C "$WORKTREE_PATH" add -A
git -C "$WORKTREE_PATH" commit -m "$COMMIT_MSG"
```

The corresponding permission entry is a single, tightly scoped pattern:

```
Bash(bash ~/.claude/commands/compound-learnings/worktree-commit.sh:*)
```

This grants permission for the script to run with any arguments, without exposing broad `git -C` permissions.

## `cd` prefix breaks pre-approved permission pattern matching

Commands like `cd /path && git add .` do **not** match `Bash(git add:*)` because the command string starts with `cd`, not `git`. This causes skills to prompt for permission on every chained command, breaking autonomous execution.

**Broken pattern**:

```bash
# This command string starts with "cd", not "git"
# It will NOT match Bash(git add:*) or Bash(git commit:*)
cd /some/worktree && git add -A && git commit -m "msg"
```

**Fixes**:

1. Use `git -C <path>` instead of `cd <path> && git ...`:

   ```bash
   git -C /some/worktree add -A
   git -C /some/worktree commit -m "msg"
   ```

2. Wrap the commands in a helper script (see pattern above) so only the script invocation needs permission.
