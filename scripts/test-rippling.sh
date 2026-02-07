#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "=== End-to-End: Rippling & NoRipple Repair ==="

# -----------------------------------------------------------
# Part A: Verify that trust lines created BEFORE enabling
# DefaultRipple get no_ripple:true, and that the rippling
# endpoint clears it so peer-to-peer transfers work.
# -----------------------------------------------------------

echo ""
echo "--- Part A: Repair existing trust lines ---"

echo ""
echo "--- A1: Generate issuer WITHOUT isIssuer (no DefaultRipple) ---"
ISSUER=$(curl -s -X POST "${BASE_URL}/api/accounts/generate" \
  -H "Content-Type: application/json" \
  -d '{"network":"testnet"}')

ISSUER_ADDRESS=$(echo "$ISSUER" | jq -r '.address')
ISSUER_SEED=$(echo "$ISSUER" | jq -r '.seed')
echo "Issuer: ${ISSUER_ADDRESS}"

if [ "$ISSUER_ADDRESS" = "null" ] || [ -z "$ISSUER_ADDRESS" ]; then
  echo "FAIL: Could not generate issuer account"
  exit 1
fi

echo ""
echo "--- A2: Generate Alice and Bob ---"
ALICE=$(curl -s -X POST "${BASE_URL}/api/accounts/generate" \
  -H "Content-Type: application/json" \
  -d '{"network":"testnet"}')
ALICE_ADDRESS=$(echo "$ALICE" | jq -r '.address')
ALICE_SEED=$(echo "$ALICE" | jq -r '.seed')
echo "Alice: ${ALICE_ADDRESS}"

BOB=$(curl -s -X POST "${BASE_URL}/api/accounts/generate" \
  -H "Content-Type: application/json" \
  -d '{"network":"testnet"}')
BOB_ADDRESS=$(echo "$BOB" | jq -r '.address')
BOB_SEED=$(echo "$BOB" | jq -r '.seed')
echo "Bob: ${BOB_ADDRESS}"

echo ""
echo "--- A3: Create trust lines BEFORE rippling is enabled ---"
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
if [ "$TL1_CODE" -ne 201 ]; then
  echo "FAIL: Alice trust line creation failed (HTTP ${TL1_CODE})"
  exit 1
fi

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
if [ "$TL2_CODE" -ne 201 ]; then
  echo "FAIL: Bob trust line creation failed (HTTP ${TL2_CODE})"
  exit 1
fi
echo "PASS: Trust lines created"

echo ""
echo "--- A4: Verify trust lines have no_ripple: true ---"
ISSUER_LINES=$(curl -s "${BASE_URL}/api/accounts/${ISSUER_ADDRESS}/trustlines?network=testnet")
NO_RIPPLE_COUNT=$(echo "$ISSUER_LINES" | jq '[.trustLines[] | select(.no_ripple == true)] | length')
if [ "$NO_RIPPLE_COUNT" -ne 2 ]; then
  echo "FAIL: Expected 2 trust lines with no_ripple:true, got ${NO_RIPPLE_COUNT}"
  exit 1
fi
echo "PASS: Both trust lines have no_ripple: true (as expected before rippling)"

echo ""
echo "--- A5: Issue 100 USD to Alice ---"
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
if [ "$ISSUE_CODE" -ne 201 ]; then
  echo "FAIL: Issue failed (HTTP ${ISSUE_CODE})"
  exit 1
fi
echo "PASS: Issued 100 USD to Alice"

echo ""
echo "--- A6: Transfer SHOULD fail (no_ripple blocks it) ---"
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
if [ "$TRANSFER_CODE" -eq 400 ]; then
  echo "PASS: Transfer correctly rejected (tecPATH_DRY due to no_ripple)"
else
  echo "FAIL: Expected HTTP 400 but got ${TRANSFER_CODE}"
  exit 1
fi

echo ""
echo "--- A7: Enable rippling (should also clear NoRipple on existing lines) ---"
RIPPLE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/accounts/${ISSUER_ADDRESS}/rippling" \
  -H "Content-Type: application/json" \
  -d "{\"seed\": \"${ISSUER_SEED}\", \"network\": \"testnet\"}")
RIPPLE_CODE=$(echo "$RIPPLE" | tail -1)
RIPPLE_BODY=$(echo "$RIPPLE" | sed '$d')
if [ "$RIPPLE_CODE" -ne 200 ]; then
  echo "FAIL: Enable rippling failed (HTTP ${RIPPLE_CODE})"
  echo "$RIPPLE_BODY" | jq . 2>/dev/null || echo "$RIPPLE_BODY"
  exit 1
fi

UPDATED=$(echo "$RIPPLE_BODY" | jq -r '.result.trustLinesUpdated')
if [ "$UPDATED" -ne 2 ]; then
  echo "FAIL: Expected 2 trust lines updated, got ${UPDATED}"
  exit 1
fi
echo "PASS: Rippling enabled, ${UPDATED} trust lines repaired"

echo ""
echo "--- A8: Verify trust lines no longer have no_ripple ---"
ISSUER_LINES=$(curl -s "${BASE_URL}/api/accounts/${ISSUER_ADDRESS}/trustlines?network=testnet")
NO_RIPPLE_COUNT=$(echo "$ISSUER_LINES" | jq '[.trustLines[] | select(.no_ripple == true)] | length')
if [ "$NO_RIPPLE_COUNT" -ne 0 ]; then
  echo "FAIL: Expected 0 trust lines with no_ripple:true, got ${NO_RIPPLE_COUNT}"
  exit 1
fi
echo "PASS: NoRipple cleared on all trust lines"

echo ""
echo "--- A9: Transfer SHOULD succeed now ---"
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
if [ "$TRANSFER_CODE" -ne 201 ]; then
  TRANSFER_BODY=$(echo "$TRANSFER" | sed '$d')
  echo "FAIL: Transfer failed after rippling repair (HTTP ${TRANSFER_CODE})"
  echo "$TRANSFER_BODY" | jq . 2>/dev/null || echo "$TRANSFER_BODY"
  exit 1
fi
echo "PASS: Transfer succeeded after rippling repair"

echo ""
echo "--- A10: Verify balances ---"
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
echo "=== All rippling tests passed ==="
