# Compound Learnings Guidelines

## Permission patterns use literal string matching

Claude Code Bash permission patterns (e.g., `Bash(bash ~/.claude/commands/...:*)`) match against the literal command string. If the background agent expands `~` to an absolute path like `/Users/foo/.claude/...`, the command won't match the permission pattern and gets auto-denied.

**Rule**: Always pass `~` literally in lifecycle script invocations — never resolve to an absolute path. The shell expands `~` at runtime, but the permission check happens on the literal text before execution.

This applies to:
- The `LIFECYCLE` alias in compound-learnings background agents
- Any other Bash permission patterns that reference home directory paths
