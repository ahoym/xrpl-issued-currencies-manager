#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ACCOUNT_FILE="${SCRIPT_DIR}/.test-account.json"

if [ ! -f "$ACCOUNT_FILE" ]; then
  echo "No test account found. Run test-generate-account.sh first."
  exit 1
fi

ADDRESS=$(jq -r '.address' "$ACCOUNT_FILE")
SEED=$(jq -r '.seed' "$ACCOUNT_FILE")

echo "=== Trust Lines (GET) ==="
echo "GET ${BASE_URL}/api/accounts/${ADDRESS}/trustlines"

BODY=$(api_get "/api/accounts/${ADDRESS}/trustlines?network=${NETWORK}")
echo "$BODY" | jq .

# To test POST, we need a second account as the issuer
echo ""
echo "=== Generate issuer account for trust line test ==="
ISSUER_BODY=$(generate_account)
ISSUER_ADDRESS=$(echo "$ISSUER_BODY" | jq -r '.address')
echo "Issuer address: ${ISSUER_ADDRESS}"

echo ""
echo "=== Trust Lines (POST) ==="
echo "POST ${BASE_URL}/api/accounts/${ADDRESS}/trustlines"

BODY=$(create_trustline "$SEED" "$ISSUER_ADDRESS" "USD" "1000000" "$NETWORK" "$ADDRESS")
echo "$BODY" | jq .
