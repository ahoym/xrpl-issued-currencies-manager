---
description: Create a PR from a web session, stripping the skills commit so the PR is clean against main
---

# Web Create PR

Create a pull request from a web session branch, automatically removing the
skills commit so the PR targets main cleanly.

## Usage

- `/web-create-pr` - Create PR to main
- `/web-create-pr <base-branch>` - Create PR to specified base branch

## Instructions

1. **Gather context** (run in parallel):
   - `git status` - Check for uncommitted changes
   - `git branch --show-current` - Get current branch name
   - `git log --oneline --all --graph -20` - See branch topology
   - `git fetch origin main` - Ensure main is up to date

2. **Check for uncommitted changes**:
   - If there are uncommitted changes, ask user if they want to commit first
   - Do not proceed until the working tree is clean

3. **Identify the skills commit** by its known commit message:
   ```bash
   MERGE_BASE=$(git merge-base HEAD origin/main)
   SKILLS_COMMIT=$(git log --format="%H %s" "$MERGE_BASE"..HEAD | grep "\[web-session\] sync skills" | awk '{print $1}')
   ```
   - If no skills commit is found, warn the user and fall back to `/git-create-pr` behavior (no rebase needed)

4. **Rebase to drop the skills commit**:
   ```bash
   git rebase --onto origin/main "$SKILLS_COMMIT"
   ```
   - If the rebase encounters conflicts:
     1. Run `git diff --name-only --diff-filter=U` to list conflicting files
     2. **Stop and tell the user** which files have conflicts
     3. Show the conflict markers with `git diff` on the conflicting files
     4. Ask the user how they want to resolve each conflict
     5. After the user provides resolution instructions, apply them, then `git add <file>` and `git rebase --continue`
     6. Repeat if more conflicts arise
   - Do NOT auto-resolve or `git rebase --abort` without user consent

5. **Determine base branch**:
   - If `$ARGUMENTS` provided, use that as base
   - Default to `main`

6. **Check for existing PR**:
   ```bash
   CURRENT_BRANCH=$(git branch --show-current)
   gh pr list --head "$CURRENT_BRANCH"
   ```
   - If a PR already exists, ask user: "PR #N already exists. Update its description?"
   - If yes, use `gh pr edit` instead of `gh pr create`

7. **Push the rebased branch**:
   ```bash
   git push --force-with-lease -u origin "$(git branch --show-current)"
   ```

8. **Create or update PR**:
   - Analyze all commits between base and HEAD
   - Draft title (under 70 chars) and body using this template:

   ```
   ## Summary
   - <bullet points summarizing changes>

   ## Changes
   **Key changes:**
   - <list of significant changes with file references>

   ## Test plan
   - [ ] <checklist items for testing>

   ---
   Generated with [Claude Code](https://claude.ai/code)
   ```

   For new PR:
   ```bash
   gh pr create --base <base-branch> --title "<title>" --body "$(cat <<'EOF'
   <body content>
   EOF
   )"
   ```

   For existing PR:
   ```bash
   gh pr edit <number> --body "$(cat <<'EOF'
   <body content>
   EOF
   )"
   ```

9. **Return the PR URL** to the user.
