#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Output JSON shape (consumed by make-market.sh):
# {
#   "network": "testnet" | "devnet",
#   "issuer":            { "address": "r...", "seed": "s...", "publicKey": "..." },
#   "credentialIssuer":  { "address": "r...", "seed": "s...", "publicKey": "..." },
#   "domainOwner":       { "address": "r...", "seed": "s...", "publicKey": "..." },
#   "currencies": ["XCAD", "XTHB"],
#   "recipients": [
#     { "address": "r...", "seed": "s...", "publicKey": "..." },
#     { "address": "r...", "seed": "s...", "publicKey": "..." }
#   ]
# }

# Allow NETWORK env var to skip the prompt
if [ -n "${NETWORK:-}" ]; then
  echo "Using network from env: ${NETWORK}"
else
  echo "Which network?"
  echo "  1) testnet"
  echo "  2) devnet"
  read -rp "Select [1]: " choice
  case "${choice:-1}" in
    1) NETWORK="testnet" ;;
    2) NETWORK="devnet" ;;
    *) echo "Invalid choice"; exit 1 ;;
  esac
fi

OUTPUT_FILE="${SCRIPT_DIR}/setup-state-${NETWORK}-$(date +%Y-%m-%d).json"

RLUSD_ISSUER="rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV"

# Helper: generate a funded wallet and extract fields
generate_wallet() {
  local label="$1"
  local response
  response=$(curl -s -X POST "${BASE_URL}/api/accounts/generate" \
    -H "Content-Type: application/json" \
    -d "{\"network\":\"${NETWORK}\"}")

  local address seed publicKey
  address=$(echo "$response" | jq -r '.address')
  seed=$(echo "$response" | jq -r '.seed')
  publicKey=$(echo "$response" | jq -r '.publicKey')

  if [ "$address" = "null" ] || [ -z "$address" ]; then
    echo "FAIL: Could not generate ${label}"
    echo "$response" | jq . 2>/dev/null || echo "$response"
    exit 1
  fi

  echo "  ${label}: ${address}" >&2
  echo "{\"address\":\"${address}\",\"seed\":\"${seed}\",\"publicKey\":\"${publicKey}\"}"
}

# Helper: create a trust line
create_trustline() {
  local seed="$1" address="$2" currency="$3" issuer="$4"
  local response http_code body
  response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/accounts/${address}/trustlines" \
    -H "Content-Type: application/json" \
    -d "{
      \"seed\": \"${seed}\",
      \"currency\": \"${currency}\",
      \"issuer\": \"${issuer}\",
      \"limit\": \"1000000\",
      \"network\": \"${NETWORK}\"
    }")
  http_code=$(echo "$response" | tail -1)
  if [ "$http_code" -ne 201 ]; then
    body=$(echo "$response" | sed '$d')
    echo "FAIL: Trust line ${currency} for ${address}"
    echo "$body" | jq . 2>/dev/null || echo "$body"
    exit 1
  fi
  echo "  Trust line: ${address} -> ${issuer} (${currency})"
}

# Helper: issue currency
issue_currency() {
  local issuer_seed="$1" recipient="$2" currency="$3" amount="$4"
  local response http_code body
  response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/currencies/issue" \
    -H "Content-Type: application/json" \
    -d "{
      \"issuerSeed\": \"${issuer_seed}\",
      \"recipientAddress\": \"${recipient}\",
      \"currencyCode\": \"${currency}\",
      \"amount\": \"${amount}\",
      \"network\": \"${NETWORK}\"
    }")
  http_code=$(echo "$response" | tail -1)
  if [ "$http_code" -ne 201 ]; then
    body=$(echo "$response" | sed '$d')
    echo "FAIL: Issue ${amount} ${currency} to ${recipient}"
    echo "$body" | jq . 2>/dev/null || echo "$body"
    exit 1
  fi
  echo "  Issued: ${amount} ${currency} -> ${recipient}"
}

# Helper: create credential
create_credential() {
  local seed="$1" subject="$2" cred_type="$3"
  local response http_code body
  response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/credentials/create" \
    -H "Content-Type: application/json" \
    -d "{
      \"seed\": \"${seed}\",
      \"subject\": \"${subject}\",
      \"credentialType\": \"${cred_type}\",
      \"network\": \"${NETWORK}\"
    }")
  http_code=$(echo "$response" | tail -1)
  if [ "$http_code" -ne 201 ]; then
    body=$(echo "$response" | sed '$d')
    echo "FAIL: Create credential ${cred_type} for ${subject}"
    echo "$body" | jq . 2>/dev/null || echo "$body"
    exit 1
  fi
  echo "  Credential created: ${cred_type} -> ${subject}"
}

# Helper: accept credential
accept_credential() {
  local seed="$1" issuer="$2" cred_type="$3"
  local response http_code body
  response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/credentials/accept" \
    -H "Content-Type: application/json" \
    -d "{
      \"seed\": \"${seed}\",
      \"issuer\": \"${issuer}\",
      \"credentialType\": \"${cred_type}\",
      \"network\": \"${NETWORK}\"
    }")
  http_code=$(echo "$response" | tail -1)
  if [ "$http_code" -ne 201 ]; then
    body=$(echo "$response" | sed '$d')
    echo "FAIL: Accept credential ${cred_type} from ${issuer}"
    echo "$body" | jq . 2>/dev/null || echo "$body"
    exit 1
  fi
  echo "  Credential accepted: ${cred_type} from ${issuer}"
}

# Helper: create domain
create_domain() {
  local seed="$1" cred_issuer="$2" cred_type="$3"
  local response http_code body domain_id
  response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/domains/create" \
    -H "Content-Type: application/json" \
    -d "{
      \"seed\": \"${seed}\",
      \"acceptedCredentials\": [
        {
          \"issuer\": \"${cred_issuer}\",
          \"credentialType\": \"${cred_type}\"
        }
      ],
      \"network\": \"${NETWORK}\"
    }")
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')
  if [ "$http_code" -ne 201 ]; then
    echo "FAIL: Create domain"
    echo "$body" | jq . 2>/dev/null || echo "$body"
    exit 1
  fi
  domain_id=$(echo "$body" | jq -r '.domainID')
  echo "  Domain created: ${domain_id}"
}

echo "=== Full State Setup ==="
echo ""

# --- Step 1: Generate all wallets ---
echo "--- Step 1: Generate wallets (5 total) ---"
ISSUER_JSON=$(generate_wallet "Issuer")
RECIPIENT1_JSON=$(generate_wallet "Recipient 1")
RECIPIENT2_JSON=$(generate_wallet "Recipient 2")
CRED_ISSUER_JSON=$(generate_wallet "Credential Issuer")
DOMAIN_OWNER_JSON=$(generate_wallet "Domain Owner")

ISSUER_ADDRESS=$(echo "$ISSUER_JSON" | jq -r '.address')
ISSUER_SEED=$(echo "$ISSUER_JSON" | jq -r '.seed')

R1_ADDRESS=$(echo "$RECIPIENT1_JSON" | jq -r '.address')
R1_SEED=$(echo "$RECIPIENT1_JSON" | jq -r '.seed')

R2_ADDRESS=$(echo "$RECIPIENT2_JSON" | jq -r '.address')
R2_SEED=$(echo "$RECIPIENT2_JSON" | jq -r '.seed')

CRED_ISSUER_ADDRESS=$(echo "$CRED_ISSUER_JSON" | jq -r '.address')
CRED_ISSUER_SEED=$(echo "$CRED_ISSUER_JSON" | jq -r '.seed')

DOMAIN_OWNER_SEED=$(echo "$DOMAIN_OWNER_JSON" | jq -r '.seed')

echo ""

# --- Step 2: Trust lines ---
echo "--- Step 2: Create trust lines ---"
for R_ADDR in "$R1_ADDRESS" "$R2_ADDRESS"; do
  R_SEED="$R1_SEED"
  if [ "$R_ADDR" = "$R2_ADDRESS" ]; then R_SEED="$R2_SEED"; fi

  create_trustline "$R_SEED" "$R_ADDR" "XCAD" "$ISSUER_ADDRESS"
  create_trustline "$R_SEED" "$R_ADDR" "XTHB" "$ISSUER_ADDRESS"
  create_trustline "$R_SEED" "$R_ADDR" "RLUSD" "$RLUSD_ISSUER"
done
echo ""

# --- Step 3: Issue currencies ---
echo "--- Step 3: Issue currencies ---"
for R_ADDR in "$R1_ADDRESS" "$R2_ADDRESS"; do
  issue_currency "$ISSUER_SEED" "$R_ADDR" "XCAD" "1000"
  issue_currency "$ISSUER_SEED" "$R_ADDR" "XTHB" "1000"
done
echo ""

# --- Step 4: Issue credentials ---
echo "--- Step 4: Issue KYC credentials ---"
create_credential "$CRED_ISSUER_SEED" "$R1_ADDRESS" "KYC"
create_credential "$CRED_ISSUER_SEED" "$R2_ADDRESS" "KYC"
echo ""

# --- Step 5: Accept credentials ---
echo "--- Step 5: Accept KYC credentials ---"
accept_credential "$R1_SEED" "$CRED_ISSUER_ADDRESS" "KYC"
accept_credential "$R2_SEED" "$CRED_ISSUER_ADDRESS" "KYC"
echo ""

# --- Step 6: Create permissioned domain ---
echo "--- Step 6: Create permissioned domain ---"
create_domain "$DOMAIN_OWNER_SEED" "$CRED_ISSUER_ADDRESS" "KYC"
echo ""

# --- Step 7: Save state JSON ---
echo "--- Step 7: Save state ---"
STATE=$(jq -n \
  --arg network "$NETWORK" \
  --argjson issuer "$ISSUER_JSON" \
  --argjson credentialIssuer "$CRED_ISSUER_JSON" \
  --argjson domainOwner "$DOMAIN_OWNER_JSON" \
  --argjson r1 "$RECIPIENT1_JSON" \
  --argjson r2 "$RECIPIENT2_JSON" \
  '{
    network: $network,
    issuer: $issuer,
    credentialIssuer: $credentialIssuer,
    domainOwner: $domainOwner,
    currencies: ["XCAD", "XTHB"],
    recipients: [$r1, $r2]
  }')

echo "$STATE" > "$OUTPUT_FILE"
echo "State saved to ${OUTPUT_FILE}"
echo ""
echo "$STATE" | jq .
echo ""
echo "=== Setup complete ==="
