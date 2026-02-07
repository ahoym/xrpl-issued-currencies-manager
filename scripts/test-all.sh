#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export BASE_URL="${BASE_URL:-http://localhost:3000}"

PASSED=0
FAILED=0
SCRIPTS=(
  "test-generate-account.sh"
  "test-account-info.sh"
  "test-balances.sh"
  "test-trustlines.sh"
  "test-transactions.sh"
  "test-issue-currency.sh"
  "test-transfer.sh"
)

echo "============================================"
echo "  XRPL Issued Currencies Manager - Tests"
echo "  Base URL: ${BASE_URL}"
echo "============================================"
echo ""

for script in "${SCRIPTS[@]}"; do
  echo "--------------------------------------------"
  echo "Running: ${script}"
  echo "--------------------------------------------"
  if bash "${SCRIPT_DIR}/${script}"; then
    echo ""
    echo ">>> ${script}: PASSED"
    PASSED=$((PASSED + 1))
  else
    echo ""
    echo ">>> ${script}: FAILED"
    FAILED=$((FAILED + 1))
  fi
  echo ""
done

echo "============================================"
echo "  Results: ${PASSED} passed, ${FAILED} failed"
echo "============================================"

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
