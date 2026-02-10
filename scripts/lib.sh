#!/usr/bin/env bash
# Shared test helpers for XRPL API test scripts.

export BASE_URL="${BASE_URL:-http://localhost:3000}"
export NETWORK="${NETWORK:-testnet}"

# Parse an HTTP response captured with `curl -s -w "\n%{http_code}"`.
# Sets BODY and HTTP_CODE variables in the caller's scope.
parse_response() {
  local response="$1"
  HTTP_CODE=$(echo "$response" | tail -1)
  BODY=$(echo "$response" | sed '$d')
}

# Assert the HTTP status code matches the expected value.
# Usage: assert_status <expected_code> <description>
# Reads HTTP_CODE and BODY from the caller's scope (set by parse_response).
assert_status() {
  local expected="$1"
  local description="$2"
  if [ "$HTTP_CODE" -eq "$expected" ]; then
    echo "PASS: ${description}" >&2
  else
    echo "FAIL: ${description} — expected HTTP ${expected}, got ${HTTP_CODE}" >&2
    echo "$BODY" | jq . 2>/dev/null >&2 || echo "$BODY" >&2
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Generic HTTP helpers
# ---------------------------------------------------------------------------

# Generic GET request.
# Usage: api_get <path> [expected_status]
# Returns the response body via echo. Uses BASE_URL from the environment.
api_get() {
  local path="$1"
  local expected="${2:-200}"
  local response
  response=$(curl -s -w "\n%{http_code}" "${BASE_URL}${path}")
  parse_response "$response"
  assert_status "$expected" "GET ${path}"
  echo "$BODY"
}

# Generic POST request.
# Usage: api_post <path> <json_body> [expected_status]
# Returns the response body via echo. Uses BASE_URL from the environment.
api_post() {
  local path="$1"
  local json_body="$2"
  local expected="${3:-201}"
  local response
  response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}${path}" \
    -H "Content-Type: application/json" \
    -d "$json_body")
  parse_response "$response"
  assert_status "$expected" "POST ${path}"
  echo "$BODY"
}

# ---------------------------------------------------------------------------
# Domain-specific helpers
# ---------------------------------------------------------------------------

# Generate a funded test account and return the response body.
# Usage: generate_account [network] [extra_json_fields]
#   extra_json_fields — e.g. ',"isIssuer":true'
generate_account() {
  local network="${1:-$NETWORK}"
  local extra="${2:-}"
  local response
  response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/accounts/generate" \
    -H "Content-Type: application/json" \
    -d "{\"network\": \"${network}\"${extra}}")
  parse_response "$response"
  assert_status 201 "Generate account (${network})"
  echo "$BODY"
}

# Create a trust line.
# Usage: create_trustline <seed> <issuer_address> <currency> <limit> <network> <account_address>
# The account_address is the address of the wallet that holds the seed (trustor).
# POSTs to /api/accounts/{account_address}/trustlines.
# Uses parse_response + assert_status internally. Echoes the response body.
create_trustline() {
  local seed="$1"
  local issuer_address="$2"
  local currency="$3"
  local limit="$4"
  local network="${5:-$NETWORK}"
  local account_address="$6"

  local response
  response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/accounts/${account_address}/trustlines" \
    -H "Content-Type: application/json" \
    -d "{
      \"seed\": \"${seed}\",
      \"currency\": \"${currency}\",
      \"issuer\": \"${issuer_address}\",
      \"limit\": \"${limit}\",
      \"network\": \"${network}\"
    }")
  parse_response "$response"
  assert_status 201 "Trust line ${currency} (${account_address} -> ${issuer_address})"
  echo "$BODY"
}

# Issue currency.
# Usage: issue_currency <issuer_seed> <recipient_address> <currency> <amount> [network]
# POSTs to /api/currencies/issue. Uses parse_response + assert_status internally.
# Echoes the response body.
issue_currency() {
  local issuer_seed="$1"
  local recipient_address="$2"
  local currency="$3"
  local amount="$4"
  local network="${5:-$NETWORK}"

  local response
  response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/currencies/issue" \
    -H "Content-Type: application/json" \
    -d "{
      \"issuerSeed\": \"${issuer_seed}\",
      \"recipientAddress\": \"${recipient_address}\",
      \"currencyCode\": \"${currency}\",
      \"amount\": \"${amount}\",
      \"network\": \"${network}\"
    }")
  parse_response "$response"
  assert_status 201 "Issue ${amount} ${currency} to ${recipient_address}"
  echo "$BODY"
}

# Place a DEX offer.
# Usage: place_offer <seed> <taker_gets_json> <taker_pays_json> [network] [domain_id]
# taker_gets_json and taker_pays_json are JSON strings, e.g.:
#   '{"currency":"USD","issuer":"rXXX","value":"100"}'
#   '{"currency":"XRP","value":"50"}'
# Echoes the response body.
place_offer() {
  local seed="$1"
  local taker_gets_json="$2"
  local taker_pays_json="$3"
  local network="${4:-$NETWORK}"
  local domain_id="${5:-}"

  local domain_field=""
  if [ -n "$domain_id" ]; then
    domain_field=",\"domainID\": \"${domain_id}\""
  fi

  local response
  response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/dex/offers" \
    -H "Content-Type: application/json" \
    -d "{
      \"seed\": \"${seed}\",
      \"takerGets\": ${taker_gets_json},
      \"takerPays\": ${taker_pays_json},
      \"network\": \"${network}\"${domain_field}
    }")
  parse_response "$response"
  assert_status 201 "Place DEX offer"
  echo "$BODY"
}

# Create a credential.
# Usage: create_credential <seed> <subject_address> <credential_type> [network]
create_credential() {
  local seed="$1"
  local subject="$2"
  local credential_type="$3"
  local network="${4:-$NETWORK}"
  api_post "/api/credentials/create" "{
    \"seed\": \"${seed}\",
    \"subject\": \"${subject}\",
    \"credentialType\": \"${credential_type}\",
    \"network\": \"${network}\"
  }"
}

# Accept a credential.
# Usage: accept_credential <seed> <issuer_address> <credential_type> [network]
accept_credential() {
  local seed="$1"
  local issuer="$2"
  local credential_type="$3"
  local network="${4:-$NETWORK}"
  api_post "/api/credentials/accept" "{
    \"seed\": \"${seed}\",
    \"issuer\": \"${issuer}\",
    \"credentialType\": \"${credential_type}\",
    \"network\": \"${network}\"
  }"
}

# Create a permissioned domain.
# Usage: create_domain <seed> <accepted_credentials_json> [network]
# accepted_credentials_json is a JSON array string, e.g.:
#   '[{"issuer":"rXXX","credentialType":"KYC"}]'
# Echoes the response body (includes .domainID).
create_domain() {
  local seed="$1"
  local accepted_credentials_json="$2"
  local network="${3:-$NETWORK}"
  api_post "/api/domains/create" "{
    \"seed\": \"${seed}\",
    \"acceptedCredentials\": ${accepted_credentials_json},
    \"network\": \"${network}\"
  }"
}
