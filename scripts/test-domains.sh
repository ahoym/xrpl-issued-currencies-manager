#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "=== End-to-End: Permissioned Domains ==="

# Step 1: Generate credential issuer account
echo ""
echo "--- Step 1: Generate credential issuer account ---"
CRED_ISSUER=$(curl -s -X POST "${BASE_URL}/api/accounts/generate" \
  -H "Content-Type: application/json" \
  -d '{"network":"testnet"}')

CRED_ISSUER_ADDRESS=$(echo "$CRED_ISSUER" | jq -r '.address')
CRED_ISSUER_SEED=$(echo "$CRED_ISSUER" | jq -r '.seed')
echo "Credential Issuer: ${CRED_ISSUER_ADDRESS}"

if [ "$CRED_ISSUER_ADDRESS" = "null" ] || [ -z "$CRED_ISSUER_ADDRESS" ]; then
  echo "FAIL: Could not generate credential issuer"
  exit 1
fi

# Step 2: Generate subject account
echo ""
echo "--- Step 2: Generate subject account ---"
SUBJECT=$(curl -s -X POST "${BASE_URL}/api/accounts/generate" \
  -H "Content-Type: application/json" \
  -d '{"network":"testnet"}')

SUBJECT_ADDRESS=$(echo "$SUBJECT" | jq -r '.address')
SUBJECT_SEED=$(echo "$SUBJECT" | jq -r '.seed')
echo "Subject: ${SUBJECT_ADDRESS}"

if [ "$SUBJECT_ADDRESS" = "null" ] || [ -z "$SUBJECT_ADDRESS" ]; then
  echo "FAIL: Could not generate subject"
  exit 1
fi

# Step 3: Generate domain owner account
echo ""
echo "--- Step 3: Generate domain owner account ---"
DOMAIN_OWNER=$(curl -s -X POST "${BASE_URL}/api/accounts/generate" \
  -H "Content-Type: application/json" \
  -d '{"network":"testnet"}')

DOMAIN_OWNER_ADDRESS=$(echo "$DOMAIN_OWNER" | jq -r '.address')
DOMAIN_OWNER_SEED=$(echo "$DOMAIN_OWNER" | jq -r '.seed')
echo "Domain Owner: ${DOMAIN_OWNER_ADDRESS}"

if [ "$DOMAIN_OWNER_ADDRESS" = "null" ] || [ -z "$DOMAIN_OWNER_ADDRESS" ]; then
  echo "FAIL: Could not generate domain owner"
  exit 1
fi

# Step 4: Create credential and accept it (prerequisite for domain)
echo ""
echo "--- Step 4: Create and accept credential ---"
curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/credentials/create" \
  -H "Content-Type: application/json" \
  -d "{
    \"seed\": \"${CRED_ISSUER_SEED}\",
    \"subject\": \"${SUBJECT_ADDRESS}\",
    \"credentialType\": \"KYC\",
    \"network\": \"testnet\"
  }" | tail -1 | grep -q "201" && echo "Credential created" || { echo "FAIL: Credential create"; exit 1; }

curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/credentials/accept" \
  -H "Content-Type: application/json" \
  -d "{
    \"seed\": \"${SUBJECT_SEED}\",
    \"issuer\": \"${CRED_ISSUER_ADDRESS}\",
    \"credentialType\": \"KYC\",
    \"network\": \"testnet\"
  }" | tail -1 | grep -q "201" && echo "Credential accepted" || { echo "FAIL: Credential accept"; exit 1; }

echo "PASS: Credential created and accepted"

# Step 5: Create permissioned domain
echo ""
echo "--- Step 5: Create permissioned domain ---"
DOMAIN=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/domains/create" \
  -H "Content-Type: application/json" \
  -d "{
    \"seed\": \"${DOMAIN_OWNER_SEED}\",
    \"acceptedCredentials\": [
      {
        \"issuer\": \"${CRED_ISSUER_ADDRESS}\",
        \"credentialType\": \"KYC\"
      }
    ],
    \"network\": \"testnet\"
  }")

DOMAIN_CODE=$(echo "$DOMAIN" | tail -1)
DOMAIN_BODY=$(echo "$DOMAIN" | sed '$d')

if [ "$DOMAIN_CODE" -eq 201 ]; then
  DOMAIN_ID=$(echo "$DOMAIN_BODY" | jq -r '.domainID')
  echo "PASS: Domain created — ID: ${DOMAIN_ID}"
else
  echo "FAIL: Domain creation failed (HTTP ${DOMAIN_CODE})"
  echo "$DOMAIN_BODY" | jq . 2>/dev/null || echo "$DOMAIN_BODY"
  exit 1
fi

if [ "$DOMAIN_ID" = "null" ] || [ -z "$DOMAIN_ID" ]; then
  echo "FAIL: Could not extract domainID from response"
  exit 1
fi

# Step 6: List domains for owner
echo ""
echo "--- Step 6: List domains for owner ---"
DOMAINS=$(curl -s "${BASE_URL}/api/accounts/${DOMAIN_OWNER_ADDRESS}/domains?network=testnet")
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
DEL=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/domains/delete" \
  -H "Content-Type: application/json" \
  -d "{
    \"seed\": \"${DOMAIN_OWNER_SEED}\",
    \"domainID\": \"${DOMAIN_ID}\",
    \"network\": \"testnet\"
  }")

DEL_CODE=$(echo "$DEL" | tail -1)
if [ "$DEL_CODE" -eq 201 ]; then
  echo "PASS: Domain deleted"
else
  DEL_BODY=$(echo "$DEL" | sed '$d')
  echo "FAIL: Domain delete failed (HTTP ${DEL_CODE})"
  echo "$DEL_BODY" | jq . 2>/dev/null || echo "$DEL_BODY"
  exit 1
fi

# Step 8: Verify domain gone
echo ""
echo "--- Step 8: Verify domain deleted ---"
DOMAINS2=$(curl -s "${BASE_URL}/api/accounts/${DOMAIN_OWNER_ADDRESS}/domains?network=testnet")
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
