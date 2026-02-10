#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

echo "=== End-to-End: Permissioned Domains ==="

# Step 1: Generate credential issuer account
echo ""
echo "--- Step 1: Generate credential issuer account ---"
CRED_ISSUER=$(generate_account "$NETWORK")
CRED_ISSUER_ADDRESS=$(echo "$CRED_ISSUER" | jq -r '.address')
CRED_ISSUER_SEED=$(echo "$CRED_ISSUER" | jq -r '.seed')
echo "Credential Issuer: ${CRED_ISSUER_ADDRESS}"

# Step 2: Generate subject account
echo ""
echo "--- Step 2: Generate subject account ---"
SUBJECT=$(generate_account "$NETWORK")
SUBJECT_ADDRESS=$(echo "$SUBJECT" | jq -r '.address')
SUBJECT_SEED=$(echo "$SUBJECT" | jq -r '.seed')
echo "Subject: ${SUBJECT_ADDRESS}"

# Step 3: Generate domain owner account
echo ""
echo "--- Step 3: Generate domain owner account ---"
DOMAIN_OWNER=$(generate_account "$NETWORK")
DOMAIN_OWNER_ADDRESS=$(echo "$DOMAIN_OWNER" | jq -r '.address')
DOMAIN_OWNER_SEED=$(echo "$DOMAIN_OWNER" | jq -r '.seed')
echo "Domain Owner: ${DOMAIN_OWNER_ADDRESS}"

# Step 4: Create credential and accept it (prerequisite for domain)
echo ""
echo "--- Step 4: Create and accept credential ---"
create_credential "$CRED_ISSUER_SEED" "$SUBJECT_ADDRESS" "KYC" "$NETWORK" > /dev/null
accept_credential "$SUBJECT_SEED" "$CRED_ISSUER_ADDRESS" "KYC" "$NETWORK" > /dev/null
echo "PASS: Credential created and accepted"

# Step 5: Create permissioned domain
echo ""
echo "--- Step 5: Create permissioned domain ---"
DOMAIN_BODY=$(create_domain "$DOMAIN_OWNER_SEED" \
  "[{\"issuer\":\"${CRED_ISSUER_ADDRESS}\",\"credentialType\":\"KYC\"}]" \
  "$NETWORK")
DOMAIN_ID=$(echo "$DOMAIN_BODY" | jq -r '.domainID')
echo "Domain ID: ${DOMAIN_ID}"

if [ "$DOMAIN_ID" = "null" ] || [ -z "$DOMAIN_ID" ]; then
  echo "FAIL: Could not extract domainID from response"
  exit 1
fi

# Step 6: List domains for owner
echo ""
echo "--- Step 6: List domains for owner ---"
DOMAINS=$(api_get "/api/accounts/${DOMAIN_OWNER_ADDRESS}/domains?network=${NETWORK}")
DOMAIN_COUNT=$(echo "$DOMAINS" | jq '.domains | length')
echo "Domain count: ${DOMAIN_COUNT}"

if [ "$DOMAIN_COUNT" -ge 1 ]; then
  echo "PASS: Domain found"
else
  echo "FAIL: Expected at least 1 domain, got ${DOMAIN_COUNT}"
  echo "$DOMAINS" | jq .
  exit 1
fi

# Step 7: Delete domain
echo ""
echo "--- Step 7: Delete domain ---"
api_post "/api/domains/delete" "{
  \"seed\": \"${DOMAIN_OWNER_SEED}\",
  \"domainID\": \"${DOMAIN_ID}\",
  \"network\": \"${NETWORK}\"
}" > /dev/null

# Step 8: Verify domain gone
echo ""
echo "--- Step 8: Verify domain deleted ---"
DOMAINS2=$(api_get "/api/accounts/${DOMAIN_OWNER_ADDRESS}/domains?network=${NETWORK}")
DOMAIN_COUNT2=$(echo "$DOMAINS2" | jq '.domains | length')
echo "Domain count: ${DOMAIN_COUNT2}"

if [ "$DOMAIN_COUNT2" -eq 0 ]; then
  echo "PASS: No domains remaining"
else
  echo "FAIL: Expected 0 domains, got ${DOMAIN_COUNT2}"
  exit 1
fi

echo ""
echo "=== All domain tests passed ==="
