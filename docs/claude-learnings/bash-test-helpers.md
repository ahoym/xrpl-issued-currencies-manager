# Bash Test Script Shared Helpers

## Pattern: scripts/lib.sh

When multiple bash test scripts share the same boilerplate (BASE_URL, response parsing, status assertion), extract a shared library:

```bash
#!/usr/bin/env bash
# scripts/lib.sh — Shared test helpers

export BASE_URL="${BASE_URL:-http://localhost:3000}"

# Parse an HTTP response captured with `curl -s -w "\n%{http_code}"`.
# Sets BODY and HTTP_CODE variables in the caller's scope.
parse_response() {
  local response="$1"
  HTTP_CODE=$(echo "$response" | tail -1)
  BODY=$(echo "$response" | sed '$d')
}

# Assert the HTTP status code matches the expected value.
assert_status() {
  local expected="$1"
  local description="$2"
  if [ "$HTTP_CODE" -eq "$expected" ]; then
    echo "PASS: ${description}"
  else
    echo "FAIL: ${description} — expected HTTP ${expected}, got ${HTTP_CODE}"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
    exit 1
  fi
}
```

Source it at the top of each test script:

```bash
#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"
```

## Why not grep -q for status checks?

The `| tail -1 | grep -q "201"` pattern does string matching, not numeric comparison. It would match `2012` or `1201`. Using `parse_response` + `assert_status` gives:
- Proper numeric comparison
- Clear PASS/FAIL output with the actual status code
- Automatic response body display on failure

## Portable source line

The `source "$(cd "$(dirname "$0")" && pwd)/lib.sh"` pattern works regardless of which directory the script is invoked from, because it resolves the absolute path of the script's own directory first.
