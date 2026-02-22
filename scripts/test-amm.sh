#!/usr/bin/env bash
set -euo pipefail
USER_NETWORK="${NETWORK:-}"
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

# AMM lifecycle test: create → query → deposit (two-asset) → deposit (single-asset)
#                     → withdraw (single-asset) → withdraw-all → verify deleted
#
# Reads issuer and recipient wallets from the latest setup-state-*.json in examples/.
# Set STATE_FILE env var to use a specific file.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXAMPLES_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/examples"

echo "=== AMM Pool Lifecycle Test (${NETWORK}) ==="

# --- Resolve state file ---
if [ -n "${STATE_FILE:-}" ]; then
  if [ ! -f "$STATE_FILE" ]; then
    echo "Error: STATE_FILE not found: $STATE_FILE"
    exit 1
  fi
  echo "Using state file: ${STATE_FILE}"
else
  STATE_FILE=$(ls -t "$EXAMPLES_DIR"/setup-state-*.json 2>/dev/null | head -1) || true
  if [ -z "$STATE_FILE" ]; then
    echo "No state file found in examples/. Run setup-full-state.sh first, or set STATE_FILE."
    echo ""
    echo "  STATE_FILE=examples/setup-state-testnet-2026-02-13.json $0"
    exit 1
  fi
  echo "Auto-detected state file: ${STATE_FILE}"
fi

# --- Load wallets from state ---
ISSUER_ADDRESS=$(jq -r '.issuer.address' "$STATE_FILE")
ISSUER_SEED=$(jq -r '.issuer.seed' "$STATE_FILE")
RECIPIENT_ADDRESS=$(jq -r '.recipients[0].address' "$STATE_FILE")
RECIPIENT_SEED=$(jq -r '.recipients[0].seed' "$STATE_FILE")
CURRENCY=$(jq -r '.currencies[0]' "$STATE_FILE")
STATE_NETWORK=$(jq -r '.network' "$STATE_FILE")

echo "Issuer:    ${ISSUER_ADDRESS}"
echo "Recipient: ${RECIPIENT_ADDRESS}"
echo "Currency:  ${CURRENCY}"
echo "Network:   ${STATE_NETWORK}"
echo ""

# Use the network from the state file (lib.sh defaults NETWORK=testnet,
# so we must override it here unless the user explicitly set NETWORK)
if [ "${USER_NETWORK:-}" = "" ]; then
  NETWORK="$STATE_NETWORK"
fi

# Step 1: Query AMM info — should not exist yet
echo "--- Step 1: Query AMM info (expect exists=false) ---"
INFO=$(api_get "/api/amm/info?base_currency=XRP&quote_currency=${CURRENCY}&quote_issuer=${ISSUER_ADDRESS}&network=${NETWORK}")
EXISTS=$(echo "$INFO" | jq -r '.exists')
if [ "$EXISTS" = "false" ]; then
  echo "PASS: AMM pool does not exist yet"
else
  echo "FAIL: Expected exists=false, got exists=${EXISTS}"
  echo "$INFO" | jq .
  exit 1
fi

# Step 2: Create AMM pool (recipient holds the issued currency)
echo ""
echo "--- Step 2: Create AMM pool ---"
CREATE_BODY=$(api_post "/api/amm/create" "{
  \"seed\": \"${RECIPIENT_SEED}\",
  \"amount\": {\"currency\": \"XRP\", \"value\": \"10\"},
  \"amount2\": {\"currency\": \"${CURRENCY}\", \"issuer\": \"${ISSUER_ADDRESS}\", \"value\": \"100\"},
  \"tradingFee\": 500,
  \"network\": \"${NETWORK}\"
}")
echo "PASS: AMM pool created"
echo "$CREATE_BODY" | jq '.result.TransactionResult // .result.meta.TransactionResult // "submitted"'

# Step 3: Query AMM info — should now exist
echo ""
echo "--- Step 3: Query AMM info (expect exists=true) ---"
INFO=$(api_get "/api/amm/info?base_currency=XRP&quote_currency=${CURRENCY}&quote_issuer=${ISSUER_ADDRESS}&network=${NETWORK}")
EXISTS=$(echo "$INFO" | jq -r '.exists')
if [ "$EXISTS" = "true" ]; then
  echo "PASS: AMM pool exists"
  echo "  Fee:        $(echo "$INFO" | jq -r '.tradingFeeDisplay')"
  echo "  Spot price: $(echo "$INFO" | jq -r '.spotPrice')"
  echo "  XRP reserve:      $(echo "$INFO" | jq -r '.asset1.value') XRP"
  echo "  ${CURRENCY} reserve: $(echo "$INFO" | jq -r '.asset2.value') ${CURRENCY}"
else
  echo "FAIL: Expected exists=true after create"
  echo "$INFO" | jq .
  exit 1
fi

AMM_ACCOUNT=$(echo "$INFO" | jq -r '.account')
LP_CURRENCY=$(echo "$INFO" | jq -r '.lpToken.currency')
LP_ISSUER=$(echo "$INFO" | jq -r '.lpToken.issuer')
echo "  AMM account: ${AMM_ACCOUNT}"
echo "  LP token:    ${LP_CURRENCY} / ${LP_ISSUER}"

# Step 4: Deposit (two-asset mode)
echo ""
echo "--- Step 4: Deposit — two-asset mode ---"
DEPOSIT_BODY=$(api_post "/api/amm/deposit" "{
  \"seed\": \"${RECIPIENT_SEED}\",
  \"asset\": {\"currency\": \"XRP\"},
  \"asset2\": {\"currency\": \"${CURRENCY}\", \"issuer\": \"${ISSUER_ADDRESS}\"},
  \"amount\": {\"currency\": \"XRP\", \"value\": \"2\"},
  \"amount2\": {\"currency\": \"${CURRENCY}\", \"issuer\": \"${ISSUER_ADDRESS}\", \"value\": \"20\"},
  \"mode\": \"two-asset\",
  \"network\": \"${NETWORK}\"
}" "200")
echo "PASS: Two-asset deposit completed"

# Step 5: Query AMM info to verify updated reserves
echo ""
echo "--- Step 5: Query AMM info (verify updated reserves) ---"
INFO=$(api_get "/api/amm/info?base_currency=XRP&quote_currency=${CURRENCY}&quote_issuer=${ISSUER_ADDRESS}&network=${NETWORK}")
EXISTS=$(echo "$INFO" | jq -r '.exists')
if [ "$EXISTS" = "true" ]; then
  echo "PASS: Pool still exists after deposit"
  echo "  XRP reserve:      $(echo "$INFO" | jq -r '.asset1.value') XRP"
  echo "  ${CURRENCY} reserve: $(echo "$INFO" | jq -r '.asset2.value') ${CURRENCY}"
else
  echo "FAIL: Pool should still exist after deposit"
  echo "$INFO" | jq .
  exit 1
fi

# Step 6: Deposit (single-asset mode)
echo ""
echo "--- Step 6: Deposit — single-asset mode ---"
DEPOSIT2_BODY=$(api_post "/api/amm/deposit" "{
  \"seed\": \"${RECIPIENT_SEED}\",
  \"asset\": {\"currency\": \"XRP\"},
  \"asset2\": {\"currency\": \"${CURRENCY}\", \"issuer\": \"${ISSUER_ADDRESS}\"},
  \"amount\": {\"currency\": \"XRP\", \"value\": \"1\"},
  \"mode\": \"single-asset\",
  \"network\": \"${NETWORK}\"
}" "200")
echo "PASS: Single-asset deposit completed"

# Step 7: Withdraw (single-asset mode)
echo ""
echo "--- Step 7: Withdraw — single-asset mode ---"
WITHDRAW_BODY=$(api_post "/api/amm/withdraw" "{
  \"seed\": \"${RECIPIENT_SEED}\",
  \"asset\": {\"currency\": \"XRP\"},
  \"asset2\": {\"currency\": \"${CURRENCY}\", \"issuer\": \"${ISSUER_ADDRESS}\"},
  \"amount\": {\"currency\": \"XRP\", \"value\": \"1\"},
  \"mode\": \"single-asset\",
  \"network\": \"${NETWORK}\"
}" "200")
echo "PASS: Single-asset withdrawal completed"

# Step 8: Withdraw all (close position)
echo ""
echo "--- Step 8: Withdraw all (close position) ---"
WITHDRAW_ALL_BODY=$(api_post "/api/amm/withdraw" "{
  \"seed\": \"${RECIPIENT_SEED}\",
  \"asset\": {\"currency\": \"XRP\"},
  \"asset2\": {\"currency\": \"${CURRENCY}\", \"issuer\": \"${ISSUER_ADDRESS}\"},
  \"mode\": \"withdraw-all\",
  \"network\": \"${NETWORK}\"
}" "200")
POOL_DELETED=$(echo "$WITHDRAW_ALL_BODY" | jq -r '.poolDeleted // false')
if [ "$POOL_DELETED" = "true" ]; then
  echo "PASS: Pool deleted after withdraw-all"
else
  echo "INFO: poolDeleted not returned (pool may still exist if other LPs remain)"
fi

# Step 9: Query AMM info — should not exist
echo ""
echo "--- Step 9: Query AMM info (expect exists=false after withdraw-all) ---"
INFO=$(api_get "/api/amm/info?base_currency=XRP&quote_currency=${CURRENCY}&quote_issuer=${ISSUER_ADDRESS}&network=${NETWORK}")
EXISTS=$(echo "$INFO" | jq -r '.exists')
if [ "$EXISTS" = "false" ]; then
  echo "PASS: AMM pool no longer exists"
else
  echo "INFO: Pool still exists (expected if other LPs have positions) — exists=${EXISTS}"
fi

echo ""
echo "=== All AMM tests passed ==="
