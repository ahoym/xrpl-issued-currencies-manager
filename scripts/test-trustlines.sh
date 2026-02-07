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

echo "=== Trust Lines (GET) ==="
echo "GET ${BASE_URL}/api/accounts/${ADDRESS}/trustlines"

RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/accounts/${ADDRESS}/trustlines?network=testnet")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "PASS: Trust lines retrieved (HTTP ${HTTP_CODE})"
  echo "$BODY" | jq .
else
  echo "FAIL: HTTP ${HTTP_CODE}"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
  exit 1
fi

# To test POST, we need a second account as the issuer
echo ""
echo "=== Generate issuer account for trust line test ==="
ISSUER_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/accounts/generate" \
  -H "Content-Type: application/json" \
  -d '{"network":"testnet"}')

ISSUER_ADDRESS=$(echo "$ISSUER_RESPONSE" | jq -r '.address')
echo "Issuer address: ${ISSUER_ADDRESS}"

SEED=$(jq -r '.seed' "$ACCOUNT_FILE")

echo ""
echo "=== Trust Lines (POST) ==="
echo "POST ${BASE_URL}/api/accounts/${ADDRESS}/trustlines"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/accounts/${ADDRESS}/trustlines" \
  -H "Content-Type: application/json" \
  -d "{
    \"seed\": \"${SEED}\",
    \"currency\": \"USD\",
    \"issuer\": \"${ISSUER_ADDRESS}\",
    \"limit\": \"1000000\",
    \"network\": \"testnet\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 201 ]; then
  echo "PASS: Trust line created (HTTP ${HTTP_CODE})"
  echo "$BODY" | jq .
else
  echo "FAIL: HTTP ${HTTP_CODE}"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
  exit 1
fi
