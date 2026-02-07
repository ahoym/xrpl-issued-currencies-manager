#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "=== End-to-End: DEX Offers ==="

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
  exit 1
fi

# Step 2: Generate trader account
echo ""
echo "--- Step 2: Generate trader account ---"
TRADER=$(curl -s -X POST "${BASE_URL}/api/accounts/generate" \
  -H "Content-Type: application/json" \
  -d '{"network":"testnet"}')

TRADER_ADDRESS=$(echo "$TRADER" | jq -r '.address')
TRADER_SEED=$(echo "$TRADER" | jq -r '.seed')
echo "Trader: ${TRADER_ADDRESS}"

if [ "$TRADER_ADDRESS" = "null" ] || [ -z "$TRADER_ADDRESS" ]; then
  echo "FAIL: Could not generate trader account"
  exit 1
fi

# Step 3: Create trust line (trader -> issuer for USD)
echo ""
echo "--- Step 3: Create trust line (trader -> issuer for USD) ---"
TL=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/accounts/${TRADER_ADDRESS}/trustlines" \
  -H "Content-Type: application/json" \
  -d "{
    \"seed\": \"${TRADER_SEED}\",
    \"currency\": \"USD\",
    \"issuer\": \"${ISSUER_ADDRESS}\",
    \"limit\": \"1000000\",
    \"network\": \"testnet\"
  }")

TL_CODE=$(echo "$TL" | tail -1)
if [ "$TL_CODE" -eq 201 ]; then
  echo "PASS: Trust line created"
else
  echo "FAIL: Trust line failed (HTTP ${TL_CODE})"
  exit 1
fi

# Step 4: Issue 1000 USD to trader
echo ""
echo "--- Step 4: Issue 1000 USD to trader ---"
ISSUE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/currencies/issue" \
  -H "Content-Type: application/json" \
  -d "{
    \"issuerSeed\": \"${ISSUER_SEED}\",
    \"recipientAddress\": \"${TRADER_ADDRESS}\",
    \"currencyCode\": \"USD\",
    \"amount\": \"1000\",
    \"network\": \"testnet\"
  }")

ISSUE_CODE=$(echo "$ISSUE" | tail -1)
if [ "$ISSUE_CODE" -eq 201 ]; then
  echo "PASS: Issued 1000 USD to trader"
else
  echo "FAIL: Issue failed (HTTP ${ISSUE_CODE})"
  exit 1
fi

# Step 5: Place DEX offer — trader sells 100 USD for 50 XRP
echo ""
echo "--- Step 5: Place DEX offer (sell 100 USD for 50 XRP) ---"
OFFER=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/dex/offers" \
  -H "Content-Type: application/json" \
  -d "{
    \"seed\": \"${TRADER_SEED}\",
    \"takerGets\": {
      \"currency\": \"USD\",
      \"issuer\": \"${ISSUER_ADDRESS}\",
      \"value\": \"100\"
    },
    \"takerPays\": {
      \"currency\": \"XRP\",
      \"value\": \"50\"
    },
    \"network\": \"testnet\"
  }")

OFFER_CODE=$(echo "$OFFER" | tail -1)
OFFER_BODY=$(echo "$OFFER" | sed '$d')
if [ "$OFFER_CODE" -eq 201 ]; then
  echo "PASS: Offer created"
else
  echo "FAIL: Offer creation failed (HTTP ${OFFER_CODE})"
  echo "$OFFER_BODY" | jq . 2>/dev/null || echo "$OFFER_BODY"
  exit 1
fi

# Extract the offer sequence from the transaction result
OFFER_SEQ=$(echo "$OFFER_BODY" | jq -r '.result.Sequence // .result.tx_json.Sequence')
echo "Offer sequence: ${OFFER_SEQ}"

# Step 6: Verify offer appears in account offers
echo ""
echo "--- Step 6: Get account offers ---"
ACCT_OFFERS=$(curl -s "${BASE_URL}/api/accounts/${TRADER_ADDRESS}/offers?network=testnet")
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
BOOK=$(curl -s "${BASE_URL}/api/dex/orderbook?base_currency=XRP&quote_currency=USD&quote_issuer=${ISSUER_ADDRESS}&network=testnet")
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
CANCEL=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/dex/offers/cancel" \
  -H "Content-Type: application/json" \
  -d "{
    \"seed\": \"${TRADER_SEED}\",
    \"offerSequence\": ${OFFER_SEQ},
    \"network\": \"testnet\"
  }")

CANCEL_CODE=$(echo "$CANCEL" | tail -1)
if [ "$CANCEL_CODE" -eq 201 ]; then
  echo "PASS: Offer cancelled"
else
  CANCEL_BODY=$(echo "$CANCEL" | sed '$d')
  echo "FAIL: Cancel failed (HTTP ${CANCEL_CODE})"
  echo "$CANCEL_BODY" | jq . 2>/dev/null || echo "$CANCEL_BODY"
  exit 1
fi

# Step 9: Verify offers are empty
echo ""
echo "--- Step 9: Verify offers empty after cancel ---"
ACCT_OFFERS2=$(curl -s "${BASE_URL}/api/accounts/${TRADER_ADDRESS}/offers?network=testnet")
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
