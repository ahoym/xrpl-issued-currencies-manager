#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

echo "=== End-to-End: Issue Currency ==="

# Step 1: Generate issuer account
echo ""
echo "--- Step 1: Generate issuer account ---"
ISSUER=$(generate_account)
ISSUER_ADDRESS=$(echo "$ISSUER" | jq -r '.address')
ISSUER_SEED=$(echo "$ISSUER" | jq -r '.seed')
echo "Issuer: ${ISSUER_ADDRESS}"

if [ "$ISSUER_ADDRESS" = "null" ] || [ -z "$ISSUER_ADDRESS" ]; then
  echo "FAIL: Could not generate issuer account"
  exit 1
fi

# Step 2: Generate recipient account
echo ""
echo "--- Step 2: Generate recipient account ---"
RECIPIENT=$(generate_account)
RECIPIENT_ADDRESS=$(echo "$RECIPIENT" | jq -r '.address')
RECIPIENT_SEED=$(echo "$RECIPIENT" | jq -r '.seed')
echo "Recipient: ${RECIPIENT_ADDRESS}"

if [ "$RECIPIENT_ADDRESS" = "null" ] || [ -z "$RECIPIENT_ADDRESS" ]; then
  echo "FAIL: Could not generate recipient account"
  exit 1
fi

# Step 3: Create trust line from recipient to issuer
echo ""
echo "--- Step 3: Create trust line (recipient -> issuer for USD) ---"
create_trustline "$RECIPIENT_SEED" "$ISSUER_ADDRESS" "USD" "1000000" "$NETWORK" "$RECIPIENT_ADDRESS" > /dev/null

# Step 4: Issue currency
echo ""
echo "--- Step 4: Issue 100 USD from issuer to recipient ---"
issue_currency "$ISSUER_SEED" "$RECIPIENT_ADDRESS" "USD" "100" "$NETWORK" > /dev/null

# Step 5: Verify balances
echo ""
echo "--- Step 5: Verify recipient balances ---"
BALANCES=$(api_get "/api/accounts/${RECIPIENT_ADDRESS}/balances?network=${NETWORK}")
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
