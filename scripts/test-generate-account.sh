#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ACCOUNT_FILE="${SCRIPT_DIR}/.test-account.json"

echo "=== Generate Account ==="
echo "POST ${BASE_URL}/api/accounts/generate"

BODY=$(generate_account)
echo "$BODY" | jq .
# Save for other scripts
echo "$BODY" > "$ACCOUNT_FILE"
echo "Account saved to ${ACCOUNT_FILE}"
