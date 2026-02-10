#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

echo "=== End-to-End: Credentials ==="

# Step 1: Generate credential issuer account
echo ""
echo "--- Step 1: Generate credential issuer account ---"
ISSUER=$(generate_account "$NETWORK")
ISSUER_ADDRESS=$(echo "$ISSUER" | jq -r '.address')
ISSUER_SEED=$(echo "$ISSUER" | jq -r '.seed')
echo "Credential Issuer: ${ISSUER_ADDRESS}"

# Step 2: Generate subject account
echo ""
echo "--- Step 2: Generate subject account ---"
SUBJECT=$(generate_account "$NETWORK")
SUBJECT_ADDRESS=$(echo "$SUBJECT" | jq -r '.address')
SUBJECT_SEED=$(echo "$SUBJECT" | jq -r '.seed')
echo "Subject: ${SUBJECT_ADDRESS}"

# Step 3: Create credential
echo ""
echo "--- Step 3: Create credential (issuer -> subject, type=KYC) ---"
create_credential "$ISSUER_SEED" "$SUBJECT_ADDRESS" "KYC" "$NETWORK" > /dev/null

# Step 4: List credentials for subject (should be unaccepted)
echo ""
echo "--- Step 4: List subject credentials (expect unaccepted) ---"
LIST=$(api_get "/api/accounts/${SUBJECT_ADDRESS}/credentials?network=${NETWORK}&role=subject")
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
accept_credential "$SUBJECT_SEED" "$ISSUER_ADDRESS" "KYC" "$NETWORK" > /dev/null

# Step 6: List credentials (should now be accepted)
echo ""
echo "--- Step 6: List subject credentials (expect accepted) ---"
LIST2=$(api_get "/api/accounts/${SUBJECT_ADDRESS}/credentials?network=${NETWORK}&role=subject")
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
api_post "/api/credentials/delete" "{
  \"seed\": \"${ISSUER_SEED}\",
  \"subject\": \"${SUBJECT_ADDRESS}\",
  \"credentialType\": \"KYC\",
  \"network\": \"${NETWORK}\"
}" > /dev/null

# Step 8: Verify credential is gone
echo ""
echo "--- Step 8: Verify credential deleted ---"
LIST3=$(api_get "/api/accounts/${SUBJECT_ADDRESS}/credentials?network=${NETWORK}&role=subject")
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
