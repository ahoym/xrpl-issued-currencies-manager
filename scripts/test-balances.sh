#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ACCOUNT_FILE="${SCRIPT_DIR}/.test-account.json"

if [ ! -f "$ACCOUNT_FILE" ]; then
  echo "No test account found. Run test-generate-account.sh first."
  exit 1
fi

ADDRESS=$(jq -r '.address' "$ACCOUNT_FILE")

echo "=== Account Balances ==="
echo "GET ${BASE_URL}/api/accounts/${ADDRESS}/balances"

RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/accounts/${ADDRESS}/balances?network=testnet")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "PASS: Balances retrieved (HTTP ${HTTP_CODE})"
  echo "$BODY" | jq .
else
  echo "FAIL: HTTP ${HTTP_CODE}"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
  exit 1
fi
