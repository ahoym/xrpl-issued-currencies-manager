#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

echo "=== End-to-End: Transfer Issued Currency ==="

# Step 1: Generate issuer account (with DefaultRipple enabled)
echo ""
echo "--- Step 1: Generate issuer account ---"
ISSUER=$(generate_account "$NETWORK" ',"isIssuer":true')
ISSUER_ADDRESS=$(echo "$ISSUER" | jq -r '.address')
ISSUER_SEED=$(echo "$ISSUER" | jq -r '.seed')
echo "Issuer: ${ISSUER_ADDRESS}"

if [ "$ISSUER_ADDRESS" = "null" ] || [ -z "$ISSUER_ADDRESS" ]; then
  echo "FAIL: Could not generate issuer account"
  exit 1
fi

# Step 2: Generate sender (Alice) account
echo ""
echo "--- Step 2: Generate sender (Alice) account ---"
ALICE=$(generate_account)
ALICE_ADDRESS=$(echo "$ALICE" | jq -r '.address')
ALICE_SEED=$(echo "$ALICE" | jq -r '.seed')
echo "Alice: ${ALICE_ADDRESS}"

if [ "$ALICE_ADDRESS" = "null" ] || [ -z "$ALICE_ADDRESS" ]; then
  echo "FAIL: Could not generate Alice account"
  exit 1
fi

# Step 3: Generate recipient (Bob) account
echo ""
echo "--- Step 3: Generate recipient (Bob) account ---"
BOB=$(generate_account)
BOB_ADDRESS=$(echo "$BOB" | jq -r '.address')
BOB_SEED=$(echo "$BOB" | jq -r '.seed')
echo "Bob: ${BOB_ADDRESS}"

if [ "$BOB_ADDRESS" = "null" ] || [ -z "$BOB_ADDRESS" ]; then
  echo "FAIL: Could not generate Bob account"
  exit 1
fi

# Step 4: Create trust lines from Alice and Bob to issuer
echo ""
echo "--- Step 4a: Create trust line (Alice -> issuer for USD) ---"
create_trustline "$ALICE_SEED" "$ISSUER_ADDRESS" "USD" "1000000" "$NETWORK" "$ALICE_ADDRESS" > /dev/null

echo ""
echo "--- Step 4b: Create trust line (Bob -> issuer for USD) ---"
create_trustline "$BOB_SEED" "$ISSUER_ADDRESS" "USD" "1000000" "$NETWORK" "$BOB_ADDRESS" > /dev/null

# Step 5: Issue 100 USD to Alice
echo ""
echo "--- Step 5: Issue 100 USD to Alice ---"
issue_currency "$ISSUER_SEED" "$ALICE_ADDRESS" "USD" "100" "$NETWORK" > /dev/null

# Step 6: Transfer 40 USD from Alice to Bob
echo ""
echo "--- Step 6: Transfer 40 USD from Alice to Bob ---"
api_post "/api/transfers" "{
  \"senderSeed\": \"${ALICE_SEED}\",
  \"recipientAddress\": \"${BOB_ADDRESS}\",
  \"issuerAddress\": \"${ISSUER_ADDRESS}\",
  \"currencyCode\": \"USD\",
  \"amount\": \"40\",
  \"network\": \"${NETWORK}\"
}" > /dev/null

# Step 7: Verify balances
echo ""
echo "--- Step 7: Verify balances ---"
ALICE_BAL=$(api_get "/api/accounts/${ALICE_ADDRESS}/balances?network=${NETWORK}")
BOB_BAL=$(api_get "/api/accounts/${BOB_ADDRESS}/balances?network=${NETWORK}")

ALICE_USD=$(echo "$ALICE_BAL" | jq -r '.balances[] | select(.currency == "USD") | .value')
BOB_USD=$(echo "$BOB_BAL" | jq -r '.balances[] | select(.currency == "USD") | .value')

echo "Alice USD: ${ALICE_USD}"
echo "Bob USD: ${BOB_USD}"

if [ "$ALICE_USD" = "60" ] && [ "$BOB_USD" = "40" ]; then
  echo "PASS: Balances correct (Alice=60, Bob=40)"
else
  echo "FAIL: Expected Alice=60, Bob=40 but got Alice=${ALICE_USD}, Bob=${BOB_USD}"
  exit 1
fi

echo ""
echo "=== All transfer tests passed ==="
