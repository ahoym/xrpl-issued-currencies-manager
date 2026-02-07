#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ACCOUNT_FILE="${SCRIPT_DIR}/.test-account.json"

echo "=== Generate Account ==="
echo "POST ${BASE_URL}/api/accounts/generate"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/accounts/generate" \
  -H "Content-Type: application/json" \
  -d '{"network":"testnet"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 201 ]; then
  echo "PASS: Account generated (HTTP ${HTTP_CODE})"
  echo "$BODY" | jq .
  # Save for other scripts
  echo "$BODY" > "$ACCOUNT_FILE"
  echo "Account saved to ${ACCOUNT_FILE}"
else
  echo "FAIL: HTTP ${HTTP_CODE}"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
  exit 1
fi
