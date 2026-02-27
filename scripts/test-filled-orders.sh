#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

echo "=== End-to-End: Filled Orders ==="

# Step 1: Generate issuer account
echo ""
echo "--- Step 1: Generate issuer account ---"
ISSUER=$(generate_account "$NETWORK" ',"isIssuer":true')
ISSUER_ADDRESS=$(echo "$ISSUER" | jq -r '.address')
ISSUER_SEED=$(echo "$ISSUER" | jq -r '.seed')
echo "Issuer: ${ISSUER_ADDRESS}"

# Step 2: Generate two trader accounts
echo ""
echo "--- Step 2: Generate trader accounts ---"
TRADER_A=$(generate_account "$NETWORK")
TRADER_A_ADDRESS=$(echo "$TRADER_A" | jq -r '.address')
TRADER_A_SEED=$(echo "$TRADER_A" | jq -r '.seed')
echo "Trader A: ${TRADER_A_ADDRESS}"

TRADER_B=$(generate_account "$NETWORK")
TRADER_B_ADDRESS=$(echo "$TRADER_B" | jq -r '.address')
TRADER_B_SEED=$(echo "$TRADER_B" | jq -r '.seed')
echo "Trader B: ${TRADER_B_ADDRESS}"

# Step 3: Create trust lines for both traders
echo ""
echo "--- Step 3: Create trust lines ---"
create_trustline "$TRADER_A_SEED" "$ISSUER_ADDRESS" "USD" "1000000" "$NETWORK" "$TRADER_A_ADDRESS" > /dev/null
create_trustline "$TRADER_B_SEED" "$ISSUER_ADDRESS" "USD" "1000000" "$NETWORK" "$TRADER_B_ADDRESS" > /dev/null

# Step 4: Issue USD to Trader A (seller)
echo ""
echo "--- Step 4: Issue 1000 USD to Trader A ---"
issue_currency "$ISSUER_SEED" "$TRADER_A_ADDRESS" "USD" "1000" "$NETWORK" > /dev/null

# Step 5: Trader A places a sell offer — sells 100 USD for 50 XRP
echo ""
echo "--- Step 5: Trader A places sell offer (100 USD for 50 XRP) ---"
place_offer "$TRADER_A_SEED" \
  "{\"currency\":\"USD\",\"issuer\":\"${ISSUER_ADDRESS}\",\"value\":\"100\"}" \
  "{\"currency\":\"XRP\",\"value\":\"50\"}" \
  "$NETWORK" > /dev/null

# Step 6: Trader B places a crossing buy offer — gives 50 XRP for 100 USD
echo ""
echo "--- Step 6: Trader B places crossing buy offer (50 XRP for 100 USD) ---"
place_offer "$TRADER_B_SEED" \
  "{\"currency\":\"XRP\",\"value\":\"50\"}" \
  "{\"currency\":\"USD\",\"issuer\":\"${ISSUER_ADDRESS}\",\"value\":\"100\"}" \
  "$NETWORK" > /dev/null

# Step 7: Query filled orders for Trader A
echo ""
echo "--- Step 7: Query filled orders for Trader A ---"
FILLED=$(api_get "/api/accounts/${TRADER_A_ADDRESS}/filled-orders?base_currency=USD&base_issuer=${ISSUER_ADDRESS}&quote_currency=XRP&network=${NETWORK}")
ORDER_COUNT=$(echo "$FILLED" | jq '.filledOrders | length')
echo "Filled orders: ${ORDER_COUNT}"

if [ "$ORDER_COUNT" -ge 1 ]; then
  echo "PASS: Filled orders found for Trader A"
else
  echo "FAIL: Expected at least 1 filled order, got ${ORDER_COUNT}"
  echo "$FILLED" | jq .
  exit 1
fi

# Step 8: Query filled orders for Trader B too
echo ""
echo "--- Step 8: Query filled orders for Trader B ---"
FILLED_B=$(api_get "/api/accounts/${TRADER_B_ADDRESS}/filled-orders?base_currency=USD&base_issuer=${ISSUER_ADDRESS}&quote_currency=XRP&network=${NETWORK}")
ORDER_COUNT_B=$(echo "$FILLED_B" | jq '.filledOrders | length')
echo "Filled orders: ${ORDER_COUNT_B}"

if [ "$ORDER_COUNT_B" -ge 1 ]; then
  echo "PASS: Filled orders found for Trader B"
else
  echo "FAIL: Expected at least 1 filled order, got ${ORDER_COUNT_B}"
  echo "$FILLED_B" | jq .
  exit 1
fi

echo ""
echo "=== All filled orders tests passed ==="
