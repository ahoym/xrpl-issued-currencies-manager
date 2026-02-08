# CLI Patterns

## git -C Is Unnecessary When CWD Is the Repo Root

The instruction to "maintain your current working directory by using absolute paths and avoiding cd" does **not** mean you should use `git -C <path>` for every git command.

### When `git -C` is NOT needed

When the current working directory is already the repository root (which it almost always is in a Claude Code session), plain `git` commands work perfectly:

```bash
# Good — CWD is already the repo
git status
git add file.txt
git commit -m "message"

# Unnecessary — adds noise for no benefit
git -C /Users/me/WORKSPACE/my-repo status
git -C /Users/me/WORKSPACE/my-repo add file.txt
```

### When `git -C` IS needed

Only use `git -C` when you actually need to operate on a **different repository** than your current working directory:

```bash
# Operating on a different repo than CWD
git -C /Users/me/WORKSPACE/other-repo status

# Operating on a worktree in a different location
git -C /Users/me/WORKSPACE/my-worktree add .
```

### Key Insight

The "avoid cd" instruction is about not changing the shell's CWD (which resets between bash calls anyway). It is not about qualifying every command with an absolute path. Tools that already operate on CWD by default (like `git` when you are in the repo) should just be used directly.
