#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
NETWORK="${NETWORK:-testnet}"
PERMISSIONED="${PERMISSIONED:-false}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXAMPLES_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/examples"

# --- Resolve state file: explicit arg > latest in examples/ ---
if [ $# -ge 1 ]; then
  STATE_FILE="$1"
  if [ ! -f "$STATE_FILE" ]; then
    echo "Error: file not found: $STATE_FILE"
    exit 1
  fi
else
  # Auto-detect latest setup-state file in examples/
  STATE_FILE=$(ls -t "$EXAMPLES_DIR"/setup-state-*.json 2>/dev/null | head -1) || true
  if [ -z "$STATE_FILE" ]; then
    echo "No state file found in examples/. Run setup-full-state.sh first, or pass a path:"
    echo ""
    echo "  $0 [state-file.json]"
    echo ""
    echo "Environment variables:"
    echo "  BASE_URL      API base URL       (default: http://localhost:3000)"
    echo "  NETWORK       XRPL network       (default: testnet)"
    echo "  PERMISSIONED  Also place permissioned offers (default: false)"
    exit 1
  fi
  echo "Auto-detected state file: ${STATE_FILE}"
fi

echo "=== Market Making: Ladder Orders ==="
echo "State:       ${STATE_FILE}"
echo "Network:     ${NETWORK}"
echo "Permissioned: ${PERMISSIONED}"
echo ""

# --- Load wallets from state ---
ISSUER_ADDRESS=$(jq -r '.issuer.address' "$STATE_FILE")
R1_ADDRESS=$(jq -r '.recipients[0].address' "$STATE_FILE")
R1_SEED=$(jq -r '.recipients[0].seed' "$STATE_FILE")
R2_ADDRESS=$(jq -r '.recipients[1].address' "$STATE_FILE")
R2_SEED=$(jq -r '.recipients[1].seed' "$STATE_FILE")

# RLUSD issuer only exists on testnet
case "$NETWORK" in
  testnet) RLUSD_ISSUER="rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV" ;;
  *)       RLUSD_ISSUER="" ;;
esac

echo "Issuer:      ${ISSUER_ADDRESS}"
echo "Recipient 1: ${R1_ADDRESS} (places bids)"
echo "Recipient 2: ${R2_ADDRESS} (places asks)"

# --- Permissioned domain lookup ---
DOMAIN_ID=""
if [ "$PERMISSIONED" = "true" ]; then
  DOMAIN_OWNER_ADDRESS=$(jq -r '.domainOwner.address' "$STATE_FILE")
  echo "Domain owner: ${DOMAIN_OWNER_ADDRESS}"
  echo ""
  echo "--- Looking up permissioned domain ---"
  DOMAINS_RESP=$(curl -s "${BASE_URL}/api/accounts/${DOMAIN_OWNER_ADDRESS}/domains?network=${NETWORK}")
  DOMAIN_ID=$(echo "$DOMAINS_RESP" | jq -r '.domains[0].DomainID // empty')
  if [ -z "$DOMAIN_ID" ]; then
    echo "WARNING: No permissioned domain found. Skipping permissioned offers."
    PERMISSIONED="false"
  else
    echo "Domain ID: ${DOMAIN_ID}"
  fi
fi
echo ""

# --- Counters ---
TOTAL_OK=0
TOTAL_FAIL=0

# --- Helper: place a single DEX offer ---
place_offer() {
  local seed="$1" taker_gets="$2" taker_pays="$3" label="$4"
  local domain_arg="${5:-}"

  local payload
  payload="{\"seed\":\"${seed}\",\"takerGets\":${taker_gets},\"takerPays\":${taker_pays},\"network\":\"${NETWORK}\""
  if [ -n "$domain_arg" ]; then
    payload="${payload},\"domainID\":\"${domain_arg}\""
  fi
  payload="${payload}}"

  local response http_code body
  response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/dex/offers" \
    -H "Content-Type: application/json" \
    -d "$payload")
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" -eq 201 ]; then
    echo "  OK:   ${label}"
    TOTAL_OK=$((TOTAL_OK + 1))
    return 0
  else
    local err
    err=$(echo "$body" | jq -r '.error // "unknown"' 2>/dev/null || echo "HTTP ${http_code}")
    echo "  FAIL: ${label} — ${err}"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
    return 1
  fi
}

# --- Helpers: format currency amounts ---
xrp_amt() { echo "{\"currency\":\"XRP\",\"value\":\"$1\"}"; }
tok_amt() { echo "{\"currency\":\"$1\",\"issuer\":\"$2\",\"value\":\"$3\"}"; }

# --- Ladder configuration ---
# 3 levels: tightest to widest spread
SPREAD_PCT=(2 5 10)
BASE_AMTS=(5 10 20)

# --- place_ladder: create a 3-level bid/ask ladder for one currency pair ---
# Args: BASE_CUR BASE_ISSUER QUOTE_CUR QUOTE_ISSUER MID_PRICE SIDES
#   SIDES: "both" | "bids" | "asks"
place_ladder() {
  local base_cur="$1" base_iss="$2" quote_cur="$3" quote_iss="$4"
  local mid="$5" sides="$6"
  local pair="${base_cur}/${quote_cur}"

  local sides_label="bids + asks"
  [ "$sides" = "bids" ] && sides_label="bids only"
  [ "$sides" = "asks" ] && sides_label="asks only"
  echo "--- ${pair}  mid=${mid}  (${sides_label}) ---"

  for i in "${!SPREAD_PCT[@]}"; do
    local pct=${SPREAD_PCT[$i]}
    local qty=${BASE_AMTS[$i]}
    local level=$((i + 1))

    local bid_price ask_price
    bid_price=$(printf "%.6f" "$(echo "$mid * (100 - $pct) / 100" | bc -l)")
    ask_price=$(printf "%.6f" "$(echo "$mid * (100 + $pct) / 100" | bc -l)")

    local bid_quote_val ask_quote_val
    bid_quote_val=$(printf "%.6f" "$(echo "$qty * $bid_price" | bc -l)")
    ask_quote_val=$(printf "%.6f" "$(echo "$qty * $ask_price" | bc -l)")

    # Bid: R1 buys base by selling quote  (TakerGets=quote, TakerPays=base)
    if [ "$sides" = "both" ] || [ "$sides" = "bids" ]; then
      local tg tp
      [ "$quote_cur" = "XRP" ] && tg=$(xrp_amt "$bid_quote_val") || tg=$(tok_amt "$quote_cur" "$quote_iss" "$bid_quote_val")
      [ "$base_cur" = "XRP" ]  && tp=$(xrp_amt "$qty")            || tp=$(tok_amt "$base_cur" "$base_iss" "$qty")

      place_offer "$R1_SEED" "$tg" "$tp" \
        "BID L${level}: ${qty} ${base_cur} @ ${bid_price} ${quote_cur}" || true

      if [ "$PERMISSIONED" = "true" ]; then
        place_offer "$R1_SEED" "$tg" "$tp" \
          "BID L${level}: ${qty} ${base_cur} @ ${bid_price} [perm]" "$DOMAIN_ID" || true
      fi
    fi

    # Ask: R2 sells base for quote  (TakerGets=base, TakerPays=quote)
    if [ "$sides" = "both" ] || [ "$sides" = "asks" ]; then
      local tg tp
      [ "$base_cur" = "XRP" ]  && tg=$(xrp_amt "$qty")            || tg=$(tok_amt "$base_cur" "$base_iss" "$qty")
      [ "$quote_cur" = "XRP" ] && tp=$(xrp_amt "$ask_quote_val")  || tp=$(tok_amt "$quote_cur" "$quote_iss" "$ask_quote_val")

      place_offer "$R2_SEED" "$tg" "$tp" \
        "ASK L${level}: ${qty} ${base_cur} @ ${ask_price} ${quote_cur}" || true

      if [ "$PERMISSIONED" = "true" ]; then
        place_offer "$R2_SEED" "$tg" "$tp" \
          "ASK L${level}: ${qty} ${base_cur} @ ${ask_price} [perm]" "$DOMAIN_ID" || true
      fi
    fi
  done
  echo ""
}

# =====================================================================
#  Place ladder orders for all 6 currency pairs
# =====================================================================

# XCAD/XRP — full two-sided book
place_ladder "XCAD" "$ISSUER_ADDRESS" "XRP" "" "10" "both"

# XTHB/XRP — full two-sided book
place_ladder "XTHB" "$ISSUER_ADDRESS" "XRP" "" "0.5" "both"

# XCAD/XTHB — full two-sided book
place_ladder "XCAD" "$ISSUER_ADDRESS" "XTHB" "$ISSUER_ADDRESS" "20" "both"

if [ -n "$RLUSD_ISSUER" ]; then
  # RLUSD/XRP — bids only (recipients hold no RLUSD to sell)
  echo "  Note: recipients have RLUSD trust lines but no balance"
  place_ladder "RLUSD" "$RLUSD_ISSUER" "XRP" "" "2" "bids"

  # XCAD/RLUSD — asks only (can sell XCAD; no RLUSD to bid with)
  echo "  Note: no RLUSD balance to place bids"
  place_ladder "XCAD" "$ISSUER_ADDRESS" "RLUSD" "$RLUSD_ISSUER" "5" "asks"

  # XTHB/RLUSD — asks only (can sell XTHB; no RLUSD to bid with)
  echo "  Note: no RLUSD balance to place bids"
  place_ladder "XTHB" "$ISSUER_ADDRESS" "RLUSD" "$RLUSD_ISSUER" "0.25" "asks"
else
  echo "--- Skipping RLUSD pairs (no RLUSD issuer on ${NETWORK}) ---"
  echo ""
fi

# =====================================================================
#  Summary
# =====================================================================
echo "========================================"
echo "  Offers placed: ${TOTAL_OK}"
echo "  Offers failed: ${TOTAL_FAIL}"
echo "========================================"
echo ""

echo "--- Recipient 1 open offers ---"
R1_OFFERS=$(curl -s "${BASE_URL}/api/accounts/${R1_ADDRESS}/offers?network=${NETWORK}")
R1_COUNT=$(echo "$R1_OFFERS" | jq '.offers | length')
echo "  Count: ${R1_COUNT}"

echo "--- Recipient 2 open offers ---"
R2_OFFERS=$(curl -s "${BASE_URL}/api/accounts/${R2_ADDRESS}/offers?network=${NETWORK}")
R2_COUNT=$(echo "$R2_OFFERS" | jq '.offers | length')
echo "  Count: ${R2_COUNT}"

echo ""
echo "=== Market making complete ==="
