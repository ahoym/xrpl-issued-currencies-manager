#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

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
ISSUER=$(generate_account "$NETWORK")
ISSUER_ADDRESS=$(echo "$ISSUER" | jq -r '.address')
ISSUER_SEED=$(echo "$ISSUER" | jq -r '.seed')
echo "Issuer: ${ISSUER_ADDRESS}"

echo ""
echo "--- A2: Generate Alice and Bob ---"
ALICE=$(generate_account "$NETWORK")
ALICE_ADDRESS=$(echo "$ALICE" | jq -r '.address')
ALICE_SEED=$(echo "$ALICE" | jq -r '.seed')
echo "Alice: ${ALICE_ADDRESS}"

BOB=$(generate_account "$NETWORK")
BOB_ADDRESS=$(echo "$BOB" | jq -r '.address')
BOB_SEED=$(echo "$BOB" | jq -r '.seed')
echo "Bob: ${BOB_ADDRESS}"

echo ""
echo "--- A3: Create trust lines BEFORE rippling is enabled ---"
create_trustline "$ALICE_SEED" "$ISSUER_ADDRESS" "USD" "1000000" "$NETWORK" "$ALICE_ADDRESS" > /dev/null
create_trustline "$BOB_SEED" "$ISSUER_ADDRESS" "USD" "1000000" "$NETWORK" "$BOB_ADDRESS" > /dev/null
echo "PASS: Trust lines created"

echo ""
echo "--- A4: Verify trust lines have no_ripple: true ---"
ISSUER_LINES=$(api_get "/api/accounts/${ISSUER_ADDRESS}/trustlines?network=${NETWORK}")
NO_RIPPLE_COUNT=$(echo "$ISSUER_LINES" | jq '[.trustLines[] | select(.no_ripple == true)] | length')
if [ "$NO_RIPPLE_COUNT" -ne 2 ]; then
  echo "FAIL: Expected 2 trust lines with no_ripple:true, got ${NO_RIPPLE_COUNT}"
  exit 1
fi
echo "PASS: Both trust lines have no_ripple: true (as expected before rippling)"

echo ""
echo "--- A5: Issue 100 USD to Alice ---"
issue_currency "$ISSUER_SEED" "$ALICE_ADDRESS" "USD" "100" "$NETWORK" > /dev/null
echo "PASS: Issued 100 USD to Alice"

echo ""
echo "--- A6: Transfer SHOULD fail (no_ripple blocks it) ---"
api_post "/api/transfers" "{
  \"senderSeed\": \"${ALICE_SEED}\",
  \"recipientAddress\": \"${BOB_ADDRESS}\",
  \"issuerAddress\": \"${ISSUER_ADDRESS}\",
  \"currencyCode\": \"USD\",
  \"amount\": \"40\",
  \"network\": \"${NETWORK}\"
}" 400 > /dev/null
echo "PASS: Transfer correctly rejected (tecPATH_DRY due to no_ripple)"

echo ""
echo "--- A7: Enable rippling (should also clear NoRipple on existing lines) ---"
RIPPLE_BODY=$(api_post "/api/accounts/${ISSUER_ADDRESS}/rippling" \
  "{\"seed\": \"${ISSUER_SEED}\", \"network\": \"${NETWORK}\"}" 200)

UPDATED=$(echo "$RIPPLE_BODY" | jq -r '.result.trustLinesUpdated')
if [ "$UPDATED" -ne 2 ]; then
  echo "FAIL: Expected 2 trust lines updated, got ${UPDATED}"
  exit 1
fi
echo "PASS: Rippling enabled, ${UPDATED} trust lines repaired"

echo ""
echo "--- A8: Verify trust lines no longer have no_ripple ---"
ISSUER_LINES=$(api_get "/api/accounts/${ISSUER_ADDRESS}/trustlines?network=${NETWORK}")
NO_RIPPLE_COUNT=$(echo "$ISSUER_LINES" | jq '[.trustLines[] | select(.no_ripple == true)] | length')
if [ "$NO_RIPPLE_COUNT" -ne 0 ]; then
  echo "FAIL: Expected 0 trust lines with no_ripple:true, got ${NO_RIPPLE_COUNT}"
  exit 1
fi
echo "PASS: NoRipple cleared on all trust lines"

echo ""
echo "--- A9: Transfer SHOULD succeed now ---"
api_post "/api/transfers" "{
  \"senderSeed\": \"${ALICE_SEED}\",
  \"recipientAddress\": \"${BOB_ADDRESS}\",
  \"issuerAddress\": \"${ISSUER_ADDRESS}\",
  \"currencyCode\": \"USD\",
  \"amount\": \"40\",
  \"network\": \"${NETWORK}\"
}" > /dev/null
echo "PASS: Transfer succeeded after rippling repair"

echo ""
echo "--- A10: Verify balances ---"
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
echo "=== All rippling tests passed ==="
