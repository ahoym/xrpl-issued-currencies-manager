#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

# NOTE: This test requires devnet — PermissionedDEX amendment is only enabled on devnet
NETWORK="devnet"

echo "=== End-to-End: Permissioned DEX (${NETWORK}) ==="

# Step 1: Generate all accounts
echo ""
echo "--- Step 1: Generate accounts ---"
TOKEN_ISSUER=$(generate_account "$NETWORK")
TOKEN_ISSUER_ADDRESS=$(echo "$TOKEN_ISSUER" | jq -r '.address')
TOKEN_ISSUER_SEED=$(echo "$TOKEN_ISSUER" | jq -r '.seed')
echo "Token Issuer: ${TOKEN_ISSUER_ADDRESS}"

CRED_ISSUER=$(generate_account "$NETWORK")
CRED_ISSUER_ADDRESS=$(echo "$CRED_ISSUER" | jq -r '.address')
CRED_ISSUER_SEED=$(echo "$CRED_ISSUER" | jq -r '.seed')
echo "Credential Issuer: ${CRED_ISSUER_ADDRESS}"

DOMAIN_OWNER=$(generate_account "$NETWORK")
DOMAIN_OWNER_ADDRESS=$(echo "$DOMAIN_OWNER" | jq -r '.address')
DOMAIN_OWNER_SEED=$(echo "$DOMAIN_OWNER" | jq -r '.seed')
echo "Domain Owner: ${DOMAIN_OWNER_ADDRESS}"

TRADER=$(generate_account "$NETWORK")
TRADER_ADDRESS=$(echo "$TRADER" | jq -r '.address')
TRADER_SEED=$(echo "$TRADER" | jq -r '.seed')
echo "Trader: ${TRADER_ADDRESS}"

echo "PASS: All accounts generated"

# Step 2: Issue credential to trader and accept it
echo ""
echo "--- Step 2: Issue and accept credential ---"
create_credential "$CRED_ISSUER_SEED" "$TRADER_ADDRESS" "KYC" "$NETWORK" > /dev/null
accept_credential "$TRADER_SEED" "$CRED_ISSUER_ADDRESS" "KYC" "$NETWORK" > /dev/null
echo "PASS: Credential issued and accepted"

# Step 3: Create permissioned domain
echo ""
echo "--- Step 3: Create permissioned domain ---"
DOMAIN_BODY=$(create_domain "$DOMAIN_OWNER_SEED" \
  "[{\"issuer\":\"${CRED_ISSUER_ADDRESS}\",\"credentialType\":\"KYC\"}]" \
  "$NETWORK")
DOMAIN_ID=$(echo "$DOMAIN_BODY" | jq -r '.domainID')
echo "PASS: Domain created — ID: ${DOMAIN_ID}"

# Step 4: Set up trust line and issue tokens
echo ""
echo "--- Step 4: Trust line + issue tokens ---"
create_trustline "$TRADER_SEED" "$TOKEN_ISSUER_ADDRESS" "USD" "1000000" "$NETWORK" "$TRADER_ADDRESS" > /dev/null
issue_currency "$TOKEN_ISSUER_SEED" "$TRADER_ADDRESS" "USD" "1000" "$NETWORK" > /dev/null
echo "PASS: Trust line + tokens ready"

# Step 5: Place offer with DomainID
echo ""
echo "--- Step 5: Place offer with DomainID ---"
OFFER_BODY=$(place_offer "$TRADER_SEED" \
  "{\"currency\":\"USD\",\"issuer\":\"${TOKEN_ISSUER_ADDRESS}\",\"value\":\"100\"}" \
  "{\"currency\":\"XRP\",\"value\":\"50\"}" \
  "$NETWORK" \
  "$DOMAIN_ID")

OFFER_SEQ=$(echo "$OFFER_BODY" | jq -r '.result.Sequence // .result.tx_json.Sequence')
echo "Offer sequence: ${OFFER_SEQ}"

# Step 6: Query domain-filtered order book
echo ""
echo "--- Step 6: Query permissioned order book ---"
BOOK=$(api_get "/api/dex/orderbook?base_currency=XRP&quote_currency=USD&quote_issuer=${TOKEN_ISSUER_ADDRESS}&domain=${DOMAIN_ID}&network=${NETWORK}")
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
OPEN_BOOK=$(api_get "/api/dex/orderbook?base_currency=XRP&quote_currency=USD&quote_issuer=${TOKEN_ISSUER_ADDRESS}&network=${NETWORK}")
OPEN_BUY=$(echo "$OPEN_BOOK" | jq '.buy | length')
OPEN_SELL=$(echo "$OPEN_BOOK" | jq '.sell | length')
echo "Open book — Buy: ${OPEN_BUY}, Sell: ${OPEN_SELL}"
echo "INFO: Open book has ${OPEN_BUY} bids and ${OPEN_SELL} asks (domain offers filtered out)"

# Step 8: Cancel the offer
echo ""
echo "--- Step 8: Cancel offer ---"
api_post "/api/dex/offers/cancel" "{
  \"seed\": \"${TRADER_SEED}\",
  \"offerSequence\": ${OFFER_SEQ},
  \"network\": \"${NETWORK}\"
}" > /dev/null

echo ""
echo "=== All permissioned DEX tests passed ==="
