#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "=== End-to-End: Transfer Issued Currency ==="

# Step 1: Generate issuer account (with DefaultRipple enabled)
echo ""
echo "--- Step 1: Generate issuer account ---"
ISSUER=$(curl -s -X POST "${BASE_URL}/api/accounts/generate" \
  -H "Content-Type: application/json" \
  -d '{"network":"testnet","isIssuer":true}')

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
ALICE=$(curl -s -X POST "${BASE_URL}/api/accounts/generate" \
  -H "Content-Type: application/json" \
  -d '{"network":"testnet"}')

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
BOB=$(curl -s -X POST "${BASE_URL}/api/accounts/generate" \
  -H "Content-Type: application/json" \
  -d '{"network":"testnet"}')

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
TL1=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/accounts/${ALICE_ADDRESS}/trustlines" \
  -H "Content-Type: application/json" \
  -d "{
    \"seed\": \"${ALICE_SEED}\",
    \"currency\": \"USD\",
    \"issuer\": \"${ISSUER_ADDRESS}\",
    \"limit\": \"1000000\",
    \"network\": \"testnet\"
  }")

TL1_CODE=$(echo "$TL1" | tail -1)
if [ "$TL1_CODE" -eq 201 ]; then
  echo "PASS: Alice trust line created"
else
  echo "FAIL: Alice trust line failed (HTTP ${TL1_CODE})"
  exit 1
fi

echo ""
echo "--- Step 4b: Create trust line (Bob -> issuer for USD) ---"
TL2=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/accounts/${BOB_ADDRESS}/trustlines" \
  -H "Content-Type: application/json" \
  -d "{
    \"seed\": \"${BOB_SEED}\",
    \"currency\": \"USD\",
    \"issuer\": \"${ISSUER_ADDRESS}\",
    \"limit\": \"1000000\",
    \"network\": \"testnet\"
  }")

TL2_CODE=$(echo "$TL2" | tail -1)
if [ "$TL2_CODE" -eq 201 ]; then
  echo "PASS: Bob trust line created"
else
  echo "FAIL: Bob trust line failed (HTTP ${TL2_CODE})"
  exit 1
fi

# Step 5: Issue 100 USD to Alice
echo ""
echo "--- Step 5: Issue 100 USD to Alice ---"
ISSUE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/currencies/issue" \
  -H "Content-Type: application/json" \
  -d "{
    \"issuerSeed\": \"${ISSUER_SEED}\",
    \"recipientAddress\": \"${ALICE_ADDRESS}\",
    \"currencyCode\": \"USD\",
    \"amount\": \"100\",
    \"network\": \"testnet\"
  }")

ISSUE_CODE=$(echo "$ISSUE" | tail -1)
if [ "$ISSUE_CODE" -eq 201 ]; then
  echo "PASS: Issued 100 USD to Alice"
else
  echo "FAIL: Issue failed (HTTP ${ISSUE_CODE})"
  exit 1
fi

# Step 6: Transfer 40 USD from Alice to Bob
echo ""
echo "--- Step 6: Transfer 40 USD from Alice to Bob ---"
TRANSFER=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/transfers" \
  -H "Content-Type: application/json" \
  -d "{
    \"senderSeed\": \"${ALICE_SEED}\",
    \"recipientAddress\": \"${BOB_ADDRESS}\",
    \"issuerAddress\": \"${ISSUER_ADDRESS}\",
    \"currencyCode\": \"USD\",
    \"amount\": \"40\",
    \"network\": \"testnet\"
  }")

TRANSFER_CODE=$(echo "$TRANSFER" | tail -1)
if [ "$TRANSFER_CODE" -eq 201 ]; then
  echo "PASS: Transferred 40 USD from Alice to Bob"
else
  TRANSFER_BODY=$(echo "$TRANSFER" | sed '$d')
  echo "FAIL: Transfer failed (HTTP ${TRANSFER_CODE})"
  echo "$TRANSFER_BODY" | jq . 2>/dev/null || echo "$TRANSFER_BODY"
  exit 1
fi

# Step 7: Verify balances
echo ""
echo "--- Step 7: Verify balances ---"
ALICE_BAL=$(curl -s "${BASE_URL}/api/accounts/${ALICE_ADDRESS}/balances?network=testnet")
BOB_BAL=$(curl -s "${BASE_URL}/api/accounts/${BOB_ADDRESS}/balances?network=testnet")

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
