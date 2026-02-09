# Skill Authoring Patterns

Patterns for structuring and optimizing Claude Code skills.

## Orchestrator/Agent Separation

When a skill has a multi-step background workflow (worktree operations, file writing, committing, PR creation), split SKILL.md into two files:

1. **Orchestrator (SKILL.md)** — Handles user interaction only: identifying items, displaying for selection, gathering input via AskUserQuestion. Target ~80 lines.
2. **Background agent steps (separate .md)** — Contains the autonomous workflow executed by a Task agent after user interaction completes. Includes command templates, decision tables, file placement rules, and error recovery.

### Key design choices

- **No eager `@` references in SKILL.md** — List reference files as conditional (plain text, no `@` prefix). The orchestrator loads them via Read tool only when the relevant code path is taken. This avoids loading ~790 tokens of reference content on every invocation.
- **Pass background steps via Task prompt** — The orchestrator reads the background steps file at launch time and includes its full content in the Task tool's prompt parameter. The background agent never needs to read it separately.
- **Neither file carries the other's concerns** — The orchestrator doesn't contain commit templates or worktree commands. The background agent doesn't contain user interaction logic.

### Benefits

- Orchestrator loads fast (minimal context)
- Background agent gets exactly the instructions it needs
- Each file is independently readable and maintainable
- Adding new background steps doesn't bloat the orchestrator's context

## Background Steps File Structure

When extracting background steps into a dedicated file, use this structure:

### Aliases at top

Define shorthand for repeated values — not shell variables, just instructions for the agent:
```
- LIFECYCLE = bash ~/.claude/commands/my-skill/helper.sh
- WORKTREE = ../worktree-my-skill
```

### Decision tables for branching

Use markdown tables instead of nested if/else prose:
```
| $ARGUMENTS | Action |
|---|---|
| #<number> | Look up PR branch, then attach |
| <name> | Attach to existing branch |
| (empty) | Create new branch |
```

### Inline warnings at point of use

Place warnings where the agent will encounter the relevant situation, not in a separate notes section:
```
> WARNING: Do NOT use Write/Edit tools — subagents cannot access worktree paths.
```
This is more effective than a "Notes" section at the bottom that the agent may not re-read when executing step 2.

### Error recovery at bottom

Keep error handling rules concise (2-3 rules) at the end of the file:
- Heredoc delimiter collision → retry with a unique delimiter
- File read returns non-zero → file is new, write from scratch
