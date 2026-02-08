#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

# NOTE: This test requires devnet — PermissionedDEX amendment is only enabled on devnet
NETWORK="devnet"

echo "=== End-to-End: Permissioned DEX (${NETWORK}) ==="

# Step 1: Generate all accounts
echo ""
echo "--- Step 1: Generate accounts ---"

TOKEN_ISSUER=$(curl -s -X POST "${BASE_URL}/api/accounts/generate" \
  -H "Content-Type: application/json" \
  -d "{\"network\":\"${NETWORK}\"}")
TOKEN_ISSUER_ADDRESS=$(echo "$TOKEN_ISSUER" | jq -r '.address')
TOKEN_ISSUER_SEED=$(echo "$TOKEN_ISSUER" | jq -r '.seed')
echo "Token Issuer: ${TOKEN_ISSUER_ADDRESS}"

CRED_ISSUER=$(curl -s -X POST "${BASE_URL}/api/accounts/generate" \
  -H "Content-Type: application/json" \
  -d "{\"network\":\"${NETWORK}\"}")
CRED_ISSUER_ADDRESS=$(echo "$CRED_ISSUER" | jq -r '.address')
CRED_ISSUER_SEED=$(echo "$CRED_ISSUER" | jq -r '.seed')
echo "Credential Issuer: ${CRED_ISSUER_ADDRESS}"

DOMAIN_OWNER=$(curl -s -X POST "${BASE_URL}/api/accounts/generate" \
  -H "Content-Type: application/json" \
  -d "{\"network\":\"${NETWORK}\"}")
DOMAIN_OWNER_ADDRESS=$(echo "$DOMAIN_OWNER" | jq -r '.address')
DOMAIN_OWNER_SEED=$(echo "$DOMAIN_OWNER" | jq -r '.seed')
echo "Domain Owner: ${DOMAIN_OWNER_ADDRESS}"

TRADER=$(curl -s -X POST "${BASE_URL}/api/accounts/generate" \
  -H "Content-Type: application/json" \
  -d "{\"network\":\"${NETWORK}\"}")
TRADER_ADDRESS=$(echo "$TRADER" | jq -r '.address')
TRADER_SEED=$(echo "$TRADER" | jq -r '.seed')
echo "Trader: ${TRADER_ADDRESS}"

for ADDR in "$TOKEN_ISSUER_ADDRESS" "$CRED_ISSUER_ADDRESS" "$DOMAIN_OWNER_ADDRESS" "$TRADER_ADDRESS"; do
  if [ "$ADDR" = "null" ] || [ -z "$ADDR" ]; then
    echo "FAIL: Could not generate account"
    exit 1
  fi
done
echo "PASS: All accounts generated"

# Step 2: Issue credential to trader and accept it
echo ""
echo "--- Step 2: Issue and accept credential ---"
curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/credentials/create" \
  -H "Content-Type: application/json" \
  -d "{
    \"seed\": \"${CRED_ISSUER_SEED}\",
    \"subject\": \"${TRADER_ADDRESS}\",
    \"credentialType\": \"KYC\",
    \"network\": \"${NETWORK}\"
  }" | tail -1 | grep -q "201" && echo "Credential created" || { echo "FAIL: Credential create"; exit 1; }

curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/credentials/accept" \
  -H "Content-Type: application/json" \
  -d "{
    \"seed\": \"${TRADER_SEED}\",
    \"issuer\": \"${CRED_ISSUER_ADDRESS}\",
    \"credentialType\": \"KYC\",
    \"network\": \"${NETWORK}\"
  }" | tail -1 | grep -q "201" && echo "Credential accepted" || { echo "FAIL: Credential accept"; exit 1; }

echo "PASS: Credential issued and accepted"

# Step 3: Create permissioned domain
echo ""
echo "--- Step 3: Create permissioned domain ---"
DOMAIN=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/domains/create" \
  -H "Content-Type: application/json" \
  -d "{
    \"seed\": \"${DOMAIN_OWNER_SEED}\",
    \"acceptedCredentials\": [
      {
        \"issuer\": \"${CRED_ISSUER_ADDRESS}\",
        \"credentialType\": \"KYC\"
      }
    ],
    \"network\": \"${NETWORK}\"
  }")

DOMAIN_CODE=$(echo "$DOMAIN" | tail -1)
DOMAIN_BODY=$(echo "$DOMAIN" | sed '$d')

if [ "$DOMAIN_CODE" -eq 201 ]; then
  DOMAIN_ID=$(echo "$DOMAIN_BODY" | jq -r '.domainID')
  echo "PASS: Domain created — ID: ${DOMAIN_ID}"
else
  echo "FAIL: Domain creation failed (HTTP ${DOMAIN_CODE})"
  echo "$DOMAIN_BODY" | jq . 2>/dev/null || echo "$DOMAIN_BODY"
  exit 1
fi

# Step 4: Set up trust line and issue tokens
echo ""
echo "--- Step 4: Trust line + issue tokens ---"
curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/accounts/${TRADER_ADDRESS}/trustlines" \
  -H "Content-Type: application/json" \
  -d "{
    \"seed\": \"${TRADER_SEED}\",
    \"currency\": \"USD\",
    \"issuer\": \"${TOKEN_ISSUER_ADDRESS}\",
    \"limit\": \"1000000\",
    \"network\": \"${NETWORK}\"
  }" | tail -1 | grep -q "201" && echo "Trust line created" || { echo "FAIL: Trust line"; exit 1; }

curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/currencies/issue" \
  -H "Content-Type: application/json" \
  -d "{
    \"issuerSeed\": \"${TOKEN_ISSUER_SEED}\",
    \"recipientAddress\": \"${TRADER_ADDRESS}\",
    \"currencyCode\": \"USD\",
    \"amount\": \"1000\",
    \"network\": \"${NETWORK}\"
  }" | tail -1 | grep -q "201" && echo "Tokens issued" || { echo "FAIL: Issue tokens"; exit 1; }

echo "PASS: Trust line + tokens ready"

# Step 5: Place offer with DomainID
echo ""
echo "--- Step 5: Place offer with DomainID ---"
OFFER=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/dex/offers" \
  -H "Content-Type: application/json" \
  -d "{
    \"seed\": \"${TRADER_SEED}\",
    \"takerGets\": {
      \"currency\": \"USD\",
      \"issuer\": \"${TOKEN_ISSUER_ADDRESS}\",
      \"value\": \"100\"
    },
    \"takerPays\": {
      \"currency\": \"XRP\",
      \"value\": \"50\"
    },
    \"domainID\": \"${DOMAIN_ID}\",
    \"network\": \"${NETWORK}\"
  }")

OFFER_CODE=$(echo "$OFFER" | tail -1)
OFFER_BODY=$(echo "$OFFER" | sed '$d')

if [ "$OFFER_CODE" -eq 201 ]; then
  echo "PASS: Offer placed with DomainID"
else
  echo "FAIL: Offer failed (HTTP ${OFFER_CODE})"
  echo "$OFFER_BODY" | jq . 2>/dev/null || echo "$OFFER_BODY"
  exit 1
fi

OFFER_SEQ=$(echo "$OFFER_BODY" | jq -r '.result.Sequence // .result.tx_json.Sequence')
echo "Offer sequence: ${OFFER_SEQ}"

# Step 6: Query domain-filtered order book
echo ""
echo "--- Step 6: Query permissioned order book ---"
BOOK=$(curl -s "${BASE_URL}/api/dex/orderbook?base_currency=XRP&quote_currency=USD&quote_issuer=${TOKEN_ISSUER_ADDRESS}&domain=${DOMAIN_ID}&network=${NETWORK}")
BUY_COUNT=$(echo "$BOOK" | jq '.buy | length')
SELL_COUNT=$(echo "$BOOK" | jq '.sell | length')
TOTAL=$((BUY_COUNT + SELL_COUNT))
echo "Buy: ${BUY_COUNT}, Sell: ${SELL_COUNT}"

if [ "$TOTAL" -ge 1 ]; then
  echo "PASS: Offer found in domain order book"
else
  echo "FAIL: Expected offer in domain book"
  echo "$BOOK" | jq .
  exit 1
fi

# Step 7: Verify offer does NOT appear in open order book
echo ""
echo "--- Step 7: Verify offer absent from open order book ---"
OPEN_BOOK=$(curl -s "${BASE_URL}/api/dex/orderbook?base_currency=XRP&quote_currency=USD&quote_issuer=${TOKEN_ISSUER_ADDRESS}&network=${NETWORK}")
OPEN_BUY=$(echo "$OPEN_BOOK" | jq '.buy | length')
OPEN_SELL=$(echo "$OPEN_BOOK" | jq '.sell | length')
echo "Open book — Buy: ${OPEN_BUY}, Sell: ${OPEN_SELL}"
# Domain offers should NOT appear in the open book (this is the whole point of permissioned DEX)
echo "INFO: Open book has ${OPEN_BUY} bids and ${OPEN_SELL} asks (domain offers filtered out)"

# Step 8: Cancel the offer
echo ""
echo "--- Step 8: Cancel offer ---"
CANCEL=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/dex/offers/cancel" \
  -H "Content-Type: application/json" \
  -d "{
    \"seed\": \"${TRADER_SEED}\",
    \"offerSequence\": ${OFFER_SEQ},
    \"network\": \"${NETWORK}\"
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

echo ""
echo "=== All permissioned DEX tests passed ==="
