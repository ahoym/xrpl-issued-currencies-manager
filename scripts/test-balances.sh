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

echo "=== Account Balances ==="
echo "GET ${BASE_URL}/api/accounts/${ADDRESS}/balances"

BODY=$(api_get "/api/accounts/${ADDRESS}/balances?network=${NETWORK}")
echo "$BODY" | jq .
