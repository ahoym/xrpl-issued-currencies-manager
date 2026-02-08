# Bash `set -e` and `pipefail` Traps

Patterns that cause silent script death under `set -euo pipefail`.

## `$()` assignments propagate exit codes under `set -e`

When a command substitution fails inside a variable assignment, `set -e` kills the script immediately — before any subsequent error-handling code runs.

```bash
set -euo pipefail

# This silently exits the script if the command fails:
RESULT=$(some_command_that_might_fail)

# This error message never prints:
if [ -z "$RESULT" ]; then
  echo "Command failed, here's a helpful message"
fi
```

**Fix:** Append `|| true` to let the assignment succeed with an empty value, then handle it explicitly:

```bash
RESULT=$(some_command_that_might_fail) || true
if [ -z "$RESULT" ]; then
  echo "Command failed, here's a helpful message"
fi
```

## `ls` + glob + `pipefail` = silent death

`ls` with a non-matching glob exits non-zero. Combined with `pipefail`, this propagates through pipes and kills `$()` assignments silently — even when stderr is redirected.

```bash
set -euo pipefail

# Silent death when no files match the glob:
LATEST=$(ls -t /some/dir/*.json 2>/dev/null | head -1)
#        ^-- ls fails (exit 1)     ^-- suppressed  ^-- pipefail propagates
#  set -e kills the script here, no output at all
```

**Fix:**

```bash
LATEST=$(ls -t /some/dir/*.json 2>/dev/null | head -1) || true
if [ -z "$LATEST" ]; then
  echo "No matching files found"
  exit 1
fi
```

## Related: `((x++))` returns exit 1 when x is 0

Already documented in MEMORY.md. Arithmetic `((expr))` returns exit code 1 when the expression evaluates to 0, which `set -e` treats as failure. Use `x=$((x + 1))` instead.

## General principle

Under `set -euo pipefail`, any command that *might legitimately fail* in a `$()` assignment needs `|| true` to allow fallthrough to explicit error handling. The pattern is:

```bash
RESULT=$(risky_command) || true
[ -z "$RESULT" ] && { echo "error message"; exit 1; }
```
