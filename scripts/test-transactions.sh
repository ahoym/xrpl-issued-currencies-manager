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

echo "=== Transactions ==="
echo "GET ${BASE_URL}/api/accounts/${ADDRESS}/transactions?limit=5"

BODY=$(api_get "/api/accounts/${ADDRESS}/transactions?network=${NETWORK}&limit=5")
echo "$BODY" | jq .
