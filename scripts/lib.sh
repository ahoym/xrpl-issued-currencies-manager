#!/usr/bin/env bash
# Shared test helpers for XRPL API test scripts.

export BASE_URL="${BASE_URL:-http://localhost:3000}"

# Parse an HTTP response captured with `curl -s -w "\n%{http_code}"`.
# Sets BODY and HTTP_CODE variables in the caller's scope.
parse_response() {
  local response="$1"
  HTTP_CODE=$(echo "$response" | tail -1)
  BODY=$(echo "$response" | sed '$d')
}

# Assert the HTTP status code matches the expected value.
# Usage: assert_status <expected_code> <description>
# Reads HTTP_CODE and BODY from the caller's scope (set by parse_response).
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

# Generate a funded test account and return the response body.
# Usage: generate_account [network]
generate_account() {
  local network="${1:-testnet}"
  local response
  response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/accounts/generate" \
    -H "Content-Type: application/json" \
    -d "{\"network\": \"${network}\"}")
  parse_response "$response"
  assert_status 201 "Generate account (${network})"
  echo "$BODY"
}
