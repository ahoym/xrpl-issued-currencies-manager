#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

echo "=== End-to-End: DEX Offers ==="

# Step 1: Generate issuer account
echo ""
echo "--- Step 1: Generate issuer account ---"
ISSUER=$(generate_account "$NETWORK")
ISSUER_ADDRESS=$(echo "$ISSUER" | jq -r '.address')
ISSUER_SEED=$(echo "$ISSUER" | jq -r '.seed')
echo "Issuer: ${ISSUER_ADDRESS}"

# Step 2: Generate trader account
echo ""
echo "--- Step 2: Generate trader account ---"
TRADER=$(generate_account "$NETWORK")
TRADER_ADDRESS=$(echo "$TRADER" | jq -r '.address')
TRADER_SEED=$(echo "$TRADER" | jq -r '.seed')
echo "Trader: ${TRADER_ADDRESS}"

# Step 3: Create trust line (trader -> issuer for USD)
echo ""
echo "--- Step 3: Create trust line (trader -> issuer for USD) ---"
create_trustline "$TRADER_SEED" "$ISSUER_ADDRESS" "USD" "1000000" "$NETWORK" "$TRADER_ADDRESS" > /dev/null

# Step 4: Issue 1000 USD to trader
echo ""
echo "--- Step 4: Issue 1000 USD to trader ---"
issue_currency "$ISSUER_SEED" "$TRADER_ADDRESS" "USD" "1000" "$NETWORK" > /dev/null

# Step 5: Place DEX offer — trader sells 100 USD for 50 XRP
echo ""
echo "--- Step 5: Place DEX offer (sell 100 USD for 50 XRP) ---"
OFFER_BODY=$(place_offer "$TRADER_SEED" \
  "{\"currency\":\"USD\",\"issuer\":\"${ISSUER_ADDRESS}\",\"value\":\"100\"}" \
  "{\"currency\":\"XRP\",\"value\":\"50\"}" \
  "$NETWORK")

# Extract the offer sequence from the transaction result
OFFER_SEQ=$(echo "$OFFER_BODY" | jq -r '.result.Sequence // .result.tx_json.Sequence')
echo "Offer sequence: ${OFFER_SEQ}"

# Step 6: Verify offer appears in account offers
echo ""
echo "--- Step 6: Get account offers ---"
ACCT_OFFERS=$(api_get "/api/accounts/${TRADER_ADDRESS}/offers?network=${NETWORK}")
OFFER_COUNT=$(echo "$ACCT_OFFERS" | jq '.offers | length')
echo "Offer count: ${OFFER_COUNT}"

if [ "$OFFER_COUNT" -ge 1 ]; then
  echo "PASS: Offer found in account offers"
else
  echo "FAIL: Expected at least 1 offer, got ${OFFER_COUNT}"
  echo "$ACCT_OFFERS" | jq .
  exit 1
fi

# Step 7: Check order book
echo ""
echo "--- Step 7: Check order book (XRP/USD) ---"
BOOK=$(api_get "/api/dex/orderbook?base_currency=XRP&quote_currency=USD&quote_issuer=${ISSUER_ADDRESS}&network=${NETWORK}")
BUY_COUNT=$(echo "$BOOK" | jq '.buy | length')
SELL_COUNT=$(echo "$BOOK" | jq '.sell | length')
echo "Buy orders: ${BUY_COUNT}, Sell orders: ${SELL_COUNT}"

TOTAL=$((BUY_COUNT + SELL_COUNT))
if [ "$TOTAL" -ge 1 ]; then
  echo "PASS: Offer found in order book"
else
  echo "FAIL: Expected offer in order book but buy=${BUY_COUNT}, sell=${SELL_COUNT}"
  echo "$BOOK" | jq .
  exit 1
fi

# Step 8: Cancel the offer
echo ""
echo "--- Step 8: Cancel offer (sequence ${OFFER_SEQ}) ---"
api_post "/api/dex/offers/cancel" "{
  \"seed\": \"${TRADER_SEED}\",
  \"offerSequence\": ${OFFER_SEQ},
  \"network\": \"${NETWORK}\"
}" > /dev/null

# Step 9: Verify offers are empty
echo ""
echo "--- Step 9: Verify offers empty after cancel ---"
ACCT_OFFERS2=$(api_get "/api/accounts/${TRADER_ADDRESS}/offers?network=${NETWORK}")
OFFER_COUNT2=$(echo "$ACCT_OFFERS2" | jq '.offers | length')
echo "Offer count: ${OFFER_COUNT2}"

if [ "$OFFER_COUNT2" -eq 0 ]; then
  echo "PASS: No offers remaining"
else
  echo "FAIL: Expected 0 offers, got ${OFFER_COUNT2}"
  exit 1
fi

echo ""
echo "=== All DEX offer tests passed ==="
