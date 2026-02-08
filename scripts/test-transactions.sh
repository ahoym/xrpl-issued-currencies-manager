#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ACCOUNT_FILE="${SCRIPT_DIR}/.test-account.json"

if [ ! -f "$ACCOUNT_FILE" ]; then
  echo "No test account found. Run test-generate-account.sh first."
  exit 1
fi

ADDRESS=$(jq -r '.address' "$ACCOUNT_FILE")

echo "=== Transactions ==="
echo "GET ${BASE_URL}/api/accounts/${ADDRESS}/transactions?limit=5"

RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/accounts/${ADDRESS}/transactions?network=testnet&limit=5")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "PASS: Transactions retrieved (HTTP ${HTTP_CODE})"
  echo "$BODY" | jq .
else
  echo "FAIL: HTTP ${HTTP_CODE}"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
  exit 1
fi
