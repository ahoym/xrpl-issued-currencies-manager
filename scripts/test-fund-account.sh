#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

echo "=== End-to-End: Fund Account ==="

# Step 1: Generate an account
echo ""
echo "--- Step 1: Generate account ---"
ACCOUNT=$(generate_account "$NETWORK")
ADDRESS=$(echo "$ACCOUNT" | jq -r '.address')
echo "Address: ${ADDRESS}"

# Step 2: Fund the existing account via the fund endpoint
echo ""
echo "--- Step 2: Fund existing account ---"
BODY=$(api_post "/api/accounts/${ADDRESS}/fund" "{\"network\": \"${NETWORK}\"}" "200")
FUNDED_ADDRESS=$(echo "$BODY" | jq -r '.address')

if [ "$FUNDED_ADDRESS" = "$ADDRESS" ]; then
  echo "PASS: Funded address matches"
else
  echo "FAIL: Expected address ${ADDRESS}, got ${FUNDED_ADDRESS}"
  echo "$BODY" | jq .
  exit 1
fi

echo ""
echo "=== Fund account test passed ==="
