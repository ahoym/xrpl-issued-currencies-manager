#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "=== End-to-End: Credentials ==="

# Step 1: Generate credential issuer account
echo ""
echo "--- Step 1: Generate credential issuer account ---"
ISSUER=$(curl -s -X POST "${BASE_URL}/api/accounts/generate" \
  -H "Content-Type: application/json" \
  -d '{"network":"testnet"}')

ISSUER_ADDRESS=$(echo "$ISSUER" | jq -r '.address')
ISSUER_SEED=$(echo "$ISSUER" | jq -r '.seed')
echo "Credential Issuer: ${ISSUER_ADDRESS}"

if [ "$ISSUER_ADDRESS" = "null" ] || [ -z "$ISSUER_ADDRESS" ]; then
  echo "FAIL: Could not generate credential issuer account"
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
  echo "FAIL: Could not generate subject account"
  exit 1
fi

# Step 3: Create credential
echo ""
echo "--- Step 3: Create credential (issuer -> subject, type=KYC) ---"
CREATE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/credentials/create" \
  -H "Content-Type: application/json" \
  -d "{
    \"seed\": \"${ISSUER_SEED}\",
    \"subject\": \"${SUBJECT_ADDRESS}\",
    \"credentialType\": \"KYC\",
    \"network\": \"testnet\"
  }")

CREATE_CODE=$(echo "$CREATE" | tail -1)
if [ "$CREATE_CODE" -eq 201 ]; then
  echo "PASS: Credential created"
else
  CREATE_BODY=$(echo "$CREATE" | sed '$d')
  echo "FAIL: Credential creation failed (HTTP ${CREATE_CODE})"
  echo "$CREATE_BODY" | jq . 2>/dev/null || echo "$CREATE_BODY"
  exit 1
fi

# Step 4: List credentials for subject (should be unaccepted)
echo ""
echo "--- Step 4: List subject credentials (expect unaccepted) ---"
LIST=$(curl -s "${BASE_URL}/api/accounts/${SUBJECT_ADDRESS}/credentials?network=testnet&role=subject")
CRED_COUNT=$(echo "$LIST" | jq '.credentials | length')
ACCEPTED=$(echo "$LIST" | jq -r '.credentials[0].accepted')
echo "Credential count: ${CRED_COUNT}, accepted: ${ACCEPTED}"

if [ "$CRED_COUNT" -ge 1 ] && [ "$ACCEPTED" = "false" ]; then
  echo "PASS: Credential found and is unaccepted"
else
  echo "FAIL: Expected 1 unaccepted credential"
  echo "$LIST" | jq .
  exit 1
fi

# Step 5: Accept credential
echo ""
echo "--- Step 5: Accept credential ---"
ACCEPT=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/credentials/accept" \
  -H "Content-Type: application/json" \
  -d "{
    \"seed\": \"${SUBJECT_SEED}\",
    \"issuer\": \"${ISSUER_ADDRESS}\",
    \"credentialType\": \"KYC\",
    \"network\": \"testnet\"
  }")

ACCEPT_CODE=$(echo "$ACCEPT" | tail -1)
if [ "$ACCEPT_CODE" -eq 201 ]; then
  echo "PASS: Credential accepted"
else
  ACCEPT_BODY=$(echo "$ACCEPT" | sed '$d')
  echo "FAIL: Credential accept failed (HTTP ${ACCEPT_CODE})"
  echo "$ACCEPT_BODY" | jq . 2>/dev/null || echo "$ACCEPT_BODY"
  exit 1
fi

# Step 6: List credentials (should now be accepted)
echo ""
echo "--- Step 6: List subject credentials (expect accepted) ---"
LIST2=$(curl -s "${BASE_URL}/api/accounts/${SUBJECT_ADDRESS}/credentials?network=testnet&role=subject")
ACCEPTED2=$(echo "$LIST2" | jq -r '.credentials[0].accepted')
echo "Accepted: ${ACCEPTED2}"

if [ "$ACCEPTED2" = "true" ]; then
  echo "PASS: Credential is now accepted"
else
  echo "FAIL: Expected credential to be accepted"
  echo "$LIST2" | jq .
  exit 1
fi

# Step 7: Delete credential (by issuer)
echo ""
echo "--- Step 7: Delete credential ---"
DELETE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/credentials/delete" \
  -H "Content-Type: application/json" \
  -d "{
    \"seed\": \"${ISSUER_SEED}\",
    \"subject\": \"${SUBJECT_ADDRESS}\",
    \"credentialType\": \"KYC\",
    \"network\": \"testnet\"
  }")

DELETE_CODE=$(echo "$DELETE" | tail -1)
if [ "$DELETE_CODE" -eq 201 ]; then
  echo "PASS: Credential deleted"
else
  DELETE_BODY=$(echo "$DELETE" | sed '$d')
  echo "FAIL: Credential delete failed (HTTP ${DELETE_CODE})"
  echo "$DELETE_BODY" | jq . 2>/dev/null || echo "$DELETE_BODY"
  exit 1
fi

# Step 8: Verify credential is gone
echo ""
echo "--- Step 8: Verify credential deleted ---"
LIST3=$(curl -s "${BASE_URL}/api/accounts/${SUBJECT_ADDRESS}/credentials?network=testnet&role=subject")
CRED_COUNT3=$(echo "$LIST3" | jq '.credentials | length')
echo "Credential count: ${CRED_COUNT3}"

if [ "$CRED_COUNT3" -eq 0 ]; then
  echo "PASS: No credentials remaining"
else
  echo "FAIL: Expected 0 credentials, got ${CRED_COUNT3}"
  exit 1
fi

echo ""
echo "=== All credential tests passed ==="
