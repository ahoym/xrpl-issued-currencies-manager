#!/usr/bin/env bash
# Test error paths across API routes — validates that bad input returns
# appropriate error responses rather than 500s.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

echo "=== Error-path integration tests ==="
echo ""

# ---------------------------------------------------------------------------
# Helper: expect a specific HTTP status for a request
# ---------------------------------------------------------------------------
expect_status() {
  local method="$1"
  local path="$2"
  local expected_status="$3"
  local body="${4:-}"
  local description="${5:-$method $path}"

  local response
  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}${path}")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "${BASE_URL}${path}" \
      -H "Content-Type: application/json" \
      -d "$body")
  fi

  parse_response "$response"
  assert_status "$expected_status" "$description"
}

# ---------------------------------------------------------------------------
# 1. Account info — invalid address
# ---------------------------------------------------------------------------
expect_status GET "/api/accounts/not-a-real-address" 400 "" \
  "Account info rejects invalid address"

# ---------------------------------------------------------------------------
# 2. Account info — non-existent account
# ---------------------------------------------------------------------------
expect_status GET "/api/accounts/rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe?network=$NETWORK" 404 "" \
  "Account info returns 404 for unfunded account"

# ---------------------------------------------------------------------------
# 3. Balances — invalid address
# ---------------------------------------------------------------------------
expect_status GET "/api/accounts/bad-address/balances" 400 "" \
  "Balances rejects invalid address"

# ---------------------------------------------------------------------------
# 4. Transactions — invalid address
# ---------------------------------------------------------------------------
expect_status GET "/api/accounts/bad-address/transactions" 400 "" \
  "Transactions rejects invalid address"

# ---------------------------------------------------------------------------
# 5. Trust lines POST — missing required fields
# ---------------------------------------------------------------------------
expect_status POST "/api/accounts/rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe/trustlines" 400 \
  '{}' \
  "Trust line rejects empty body"

# ---------------------------------------------------------------------------
# 6. Trust lines POST — invalid seed
# ---------------------------------------------------------------------------
expect_status POST "/api/accounts/rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe/trustlines" 400 \
  '{"seed":"bad-seed","currency":"USD","issuer":"rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe","limit":"1000"}' \
  "Trust line rejects invalid seed"

# ---------------------------------------------------------------------------
# 7. Issue currency — missing fields
# ---------------------------------------------------------------------------
expect_status POST "/api/currencies/issue" 400 \
  '{}' \
  "Issue currency rejects empty body"

# ---------------------------------------------------------------------------
# 8. Issue currency — invalid recipient address
# ---------------------------------------------------------------------------
expect_status POST "/api/currencies/issue" 400 \
  '{"issuerSeed":"sEdSKaCy2JT7JaM7v95H9SxkhP9wS2r","recipientAddress":"bad","currencyCode":"USD","amount":"100"}' \
  "Issue currency rejects invalid recipient address"

# ---------------------------------------------------------------------------
# 9. Transfer — missing fields
# ---------------------------------------------------------------------------
expect_status POST "/api/transfers" 400 \
  '{}' \
  "Transfer rejects empty body"

# ---------------------------------------------------------------------------
# 10. Transfer — non-XRP without issuer
# ---------------------------------------------------------------------------
expect_status POST "/api/transfers" 400 \
  '{"senderSeed":"sEdSKaCy2JT7JaM7v95H9SxkhP9wS2r","recipientAddress":"rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe","currencyCode":"USD","amount":"100"}' \
  "Transfer rejects non-XRP without issuerAddress"

# ---------------------------------------------------------------------------
# 11. Transfer — zero amount
# ---------------------------------------------------------------------------
expect_status POST "/api/transfers" 400 \
  '{"senderSeed":"sEdSKaCy2JT7JaM7v95H9SxkhP9wS2r","recipientAddress":"rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe","currencyCode":"XRP","amount":"0"}' \
  "Transfer rejects zero amount"

# ---------------------------------------------------------------------------
# 12. DEX offer — missing fields
# ---------------------------------------------------------------------------
expect_status POST "/api/dex/offers" 400 \
  '{}' \
  "DEX offer rejects empty body"

# ---------------------------------------------------------------------------
# 13. DEX offer — non-XRP without issuer
# ---------------------------------------------------------------------------
expect_status POST "/api/dex/offers" 400 \
  '{"seed":"sEdSKaCy2JT7JaM7v95H9SxkhP9wS2r","takerGets":{"currency":"USD","value":"100"},"takerPays":{"currency":"XRP","value":"50"}}' \
  "DEX offer rejects non-XRP takerGets without issuer"

# ---------------------------------------------------------------------------
# 14. DEX offer — invalid flags
# ---------------------------------------------------------------------------
expect_status POST "/api/dex/offers" 400 \
  '{"seed":"sEdSKaCy2JT7JaM7v95H9SxkhP9wS2r","takerGets":{"currency":"XRP","value":"50"},"takerPays":{"currency":"XRP","value":"50"},"flags":["invalidFlag"]}' \
  "DEX offer rejects unknown flags"

# ---------------------------------------------------------------------------
# 15. DEX cancel — missing fields
# ---------------------------------------------------------------------------
expect_status POST "/api/dex/offers/cancel" 400 \
  '{}' \
  "DEX cancel rejects empty body"

# ---------------------------------------------------------------------------
# 16. Orderbook — missing currency pair
# ---------------------------------------------------------------------------
expect_status GET "/api/dex/orderbook" 400 "" \
  "Orderbook rejects missing currency pair"

# ---------------------------------------------------------------------------
# 17. Orderbook — invalid domain ID
# ---------------------------------------------------------------------------
expect_status GET "/api/dex/orderbook?base_currency=XRP&quote_currency=USD&quote_issuer=rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe&domain=not-hex" 400 "" \
  "Orderbook rejects invalid domain ID"

# ---------------------------------------------------------------------------
# 18. Credential create — missing fields
# ---------------------------------------------------------------------------
expect_status POST "/api/credentials/create" 400 \
  '{}' \
  "Credential create rejects empty body"

# ---------------------------------------------------------------------------
# 19. Credential create — credential type too long
# ---------------------------------------------------------------------------
LONG_TYPE=$(printf 'x%.0s' {1..200})
expect_status POST "/api/credentials/create" 400 \
  "{\"seed\":\"sEdSKaCy2JT7JaM7v95H9SxkhP9wS2r\",\"subject\":\"rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe\",\"credentialType\":\"${LONG_TYPE}\"}" \
  "Credential create rejects overly long credential type"

# ---------------------------------------------------------------------------
# 20. Domain create — empty acceptedCredentials
# ---------------------------------------------------------------------------
expect_status POST "/api/domains/create" 400 \
  '{"seed":"sEdSKaCy2JT7JaM7v95H9SxkhP9wS2r","acceptedCredentials":[]}' \
  "Domain create rejects empty acceptedCredentials"

# ---------------------------------------------------------------------------
# 21. Domain delete — invalid domainID format
# ---------------------------------------------------------------------------
expect_status POST "/api/domains/delete" 400 \
  '{"seed":"sEdSKaCy2JT7JaM7v95H9SxkhP9wS2r","domainID":"not-hex"}' \
  "Domain delete rejects invalid domainID"

# ---------------------------------------------------------------------------
# 22. AMM info — missing currency pair
# ---------------------------------------------------------------------------
expect_status GET "/api/amm/info" 400 "" \
  "AMM info rejects missing currency pair"

# ---------------------------------------------------------------------------
# 23. AMM create — missing fields
# ---------------------------------------------------------------------------
expect_status POST "/api/amm/create" 400 \
  '{}' \
  "AMM create rejects empty body"

# ---------------------------------------------------------------------------
# 24. AMM create — invalid trading fee
# ---------------------------------------------------------------------------
expect_status POST "/api/amm/create" 400 \
  '{"seed":"sEdSKaCy2JT7JaM7v95H9SxkhP9wS2r","amount":{"currency":"XRP","value":"100"},"amount2":{"currency":"USD","issuer":"rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe","value":"100"},"tradingFee":2000}' \
  "AMM create rejects trading fee > 1000"

# ---------------------------------------------------------------------------
# 25. AMM deposit — invalid mode
# ---------------------------------------------------------------------------
expect_status POST "/api/amm/deposit" 400 \
  '{"seed":"sEdSKaCy2JT7JaM7v95H9SxkhP9wS2r","asset":{"currency":"XRP"},"asset2":{"currency":"USD","issuer":"rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe"},"mode":"invalid"}' \
  "AMM deposit rejects invalid mode"

# ---------------------------------------------------------------------------
# 26. AMM withdraw — missing fields
# ---------------------------------------------------------------------------
expect_status POST "/api/amm/withdraw" 400 \
  '{}' \
  "AMM withdraw rejects empty body"

# ---------------------------------------------------------------------------
# 27. Filled orders — invalid address
# ---------------------------------------------------------------------------
expect_status GET "/api/accounts/bad-address/filled-orders?base_currency=XRP&quote_currency=USD&quote_issuer=rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe" 400 "" \
  "Filled orders rejects invalid address"

# ---------------------------------------------------------------------------
# 28. Filled orders — missing currency pair
# ---------------------------------------------------------------------------
expect_status GET "/api/accounts/rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe/filled-orders" 400 "" \
  "Filled orders rejects missing currency pair"

echo ""
echo "=== All error-path tests passed ==="
