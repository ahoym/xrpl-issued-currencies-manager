#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "=== End-to-End: Issue Currency ==="

# Step 1: Generate issuer account
echo ""
echo "--- Step 1: Generate issuer account ---"
ISSUER=$(curl -s -X POST "${BASE_URL}/api/accounts/generate" \
  -H "Content-Type: application/json" \
  -d '{"network":"testnet"}')

ISSUER_ADDRESS=$(echo "$ISSUER" | jq -r '.address')
ISSUER_SEED=$(echo "$ISSUER" | jq -r '.seed')
echo "Issuer: ${ISSUER_ADDRESS}"

if [ "$ISSUER_ADDRESS" = "null" ] || [ -z "$ISSUER_ADDRESS" ]; then
  echo "FAIL: Could not generate issuer account"
  echo "$ISSUER" | jq . 2>/dev/null || echo "$ISSUER"
  exit 1
fi

# Step 2: Generate recipient account
echo ""
echo "--- Step 2: Generate recipient account ---"
RECIPIENT=$(curl -s -X POST "${BASE_URL}/api/accounts/generate" \
  -H "Content-Type: application/json" \
  -d '{"network":"testnet"}')

RECIPIENT_ADDRESS=$(echo "$RECIPIENT" | jq -r '.address')
RECIPIENT_SEED=$(echo "$RECIPIENT" | jq -r '.seed')
echo "Recipient: ${RECIPIENT_ADDRESS}"

if [ "$RECIPIENT_ADDRESS" = "null" ] || [ -z "$RECIPIENT_ADDRESS" ]; then
  echo "FAIL: Could not generate recipient account"
  echo "$RECIPIENT" | jq . 2>/dev/null || echo "$RECIPIENT"
  exit 1
fi

# Step 3: Create trust line from recipient to issuer
echo ""
echo "--- Step 3: Create trust line (recipient -> issuer for USD) ---"
TRUSTLINE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/accounts/${RECIPIENT_ADDRESS}/trustlines" \
  -H "Content-Type: application/json" \
  -d "{
    \"seed\": \"${RECIPIENT_SEED}\",
    \"currency\": \"USD\",
    \"issuer\": \"${ISSUER_ADDRESS}\",
    \"limit\": \"1000000\",
    \"network\": \"testnet\"
  }")

TL_CODE=$(echo "$TRUSTLINE" | tail -1)
TL_BODY=$(echo "$TRUSTLINE" | sed '$d')

if [ "$TL_CODE" -eq 201 ]; then
  echo "PASS: Trust line created (HTTP ${TL_CODE})"
else
  echo "FAIL: Trust line creation failed (HTTP ${TL_CODE})"
  echo "$TL_BODY" | jq . 2>/dev/null || echo "$TL_BODY"
  exit 1
fi

# Step 4: Issue currency
echo ""
echo "--- Step 4: Issue 100 USD from issuer to recipient ---"
ISSUE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/currencies/issue" \
  -H "Content-Type: application/json" \
  -d "{
    \"issuerSeed\": \"${ISSUER_SEED}\",
    \"recipientAddress\": \"${RECIPIENT_ADDRESS}\",
    \"currencyCode\": \"USD\",
    \"amount\": \"100\",
    \"network\": \"testnet\"
  }")

ISSUE_CODE=$(echo "$ISSUE" | tail -1)
ISSUE_BODY=$(echo "$ISSUE" | sed '$d')

if [ "$ISSUE_CODE" -eq 201 ]; then
  echo "PASS: Currency issued (HTTP ${ISSUE_CODE})"
else
  echo "FAIL: Currency issuance failed (HTTP ${ISSUE_CODE})"
  echo "$ISSUE_BODY" | jq . 2>/dev/null || echo "$ISSUE_BODY"
  exit 1
fi

# Step 5: Verify balances
echo ""
echo "--- Step 5: Verify recipient balances ---"
BALANCES=$(curl -s "${BASE_URL}/api/accounts/${RECIPIENT_ADDRESS}/balances?network=testnet")
echo "$BALANCES" | jq .

USD_BALANCE=$(echo "$BALANCES" | jq -r '.balances[] | select(.currency == "USD") | .value')
if [ "$USD_BALANCE" = "100" ]; then
  echo "PASS: Recipient has 100 USD"
else
  echo "FAIL: Expected 100 USD, got ${USD_BALANCE}"
  exit 1
fi

echo ""
echo "=== All issue currency tests passed ==="
