#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

echo "=== End-to-End: Ping ==="

echo ""
echo "--- GET /api/ping ---"
BODY=$(api_get "/api/ping")
STATUS=$(echo "$BODY" | jq -r '.status')

if [ "$STATUS" = "ok" ]; then
  echo "PASS: Ping returned status ok"
else
  echo "FAIL: Expected status ok, got ${STATUS}"
  echo "$BODY" | jq .
  exit 1
fi

echo ""
echo "=== Ping test passed ==="
