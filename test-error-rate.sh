#!/bin/bash

echo "Testing Cloudflare Worker endpoints for error rate..."
echo "=========================================="

WORKER_URL="https://pitchey-production.cavelltheleaddev.workers.dev"
TOTAL_TESTS=0
SUCCESSFUL_TESTS=0

declare -a endpoints=(
  "/api/health"
  "/api/pitches?limit=10"
  "/api/auth/check"
  "/api/admin/cache-status"
  "/api/ab-test/variant"
  "/api/config/genres"
  "/api/config/formats"
  "/api/config/budget-ranges"
  "/api/config/stages"
  "/api/config/all"
  "/api/content/about"
  "/api/content/how-it-works"
  "/api/content/stats"
  "/api/content/team"
  "/api/ab-test/results"
)

for endpoint in "${endpoints[@]}"; do
  echo -n "Testing $endpoint... "
  http_code=$(curl -s -o /dev/null -w "%{http_code}" "$WORKER_URL$endpoint")
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  
  if [[ $http_code -ge 200 && $http_code -lt 300 ]] || [[ $http_code == 401 ]]; then
    echo "✓ ($http_code)"
    SUCCESSFUL_TESTS=$((SUCCESSFUL_TESTS + 1))
  else
    echo "✗ ($http_code)"
  fi
done

echo "=========================================="
echo "Total tests: $TOTAL_TESTS"
echo "Successful tests: $SUCCESSFUL_TESTS"
SUCCESS_RATE=$(echo "scale=2; $SUCCESSFUL_TESTS * 100 / $TOTAL_TESTS" | bc)
ERROR_RATE=$(echo "scale=2; 100 - $SUCCESS_RATE" | bc)
echo "Success rate: ${SUCCESS_RATE}%"
echo "Error rate: ${ERROR_RATE}%"

if (( $(echo "$ERROR_RATE < 10" | bc -l) )); then
  echo "🎉 SUCCESS: Error rate is below 10%!"
else
  echo "❌ Still need improvement: Error rate is above 10%"
fi
