#!/bin/bash

echo "🧪 Simple Cache Test for Pitchey"
echo "================================"

BASE_URL="https://pitchey-production.cavelltheleaddev.workers.dev"

echo "1. Testing cache health..."
curl -s "$BASE_URL/api/cache/health" | jq -r "\"   Status: \(.status // \"unknown\"), Hit Rate: \(.hitRate // 0)%, Total Requests: \(.totalRequests // 0)\""

echo -e "
2. Warming cache..."
WARM_RESULT=$(curl -s -X POST "$BASE_URL/api/cache/warm")
echo "   $WARM_RESULT"

echo -e "
3. Testing cache metrics..."
curl -s "$BASE_URL/api/cache/metrics" | jq -r "\"   Hit Rate: \(.hitRate // 0)%, Requests: \(.totalRequests // 0), Errors: \(.errors // 0)\""

echo -e "
4. Testing a cacheable endpoint (5 requests)..."
for i in {1..5}; do
  START_TIME=$(date +%s%3N)
  RESPONSE=$(curl -s -w "%{http_code}" "$BASE_URL/api/health" -o /dev/null)
  END_TIME=$(date +%s%3N)
  LATENCY=$((END_TIME - START_TIME))
  echo "   Request $i: HTTP $RESPONSE, ${LATENCY}ms"
done

echo -e "
5. Final cache metrics..."
curl -s "$BASE_URL/api/cache/metrics" | jq -r "\"   Final Hit Rate: \(.hitRate // 0)%, Total Requests: \(.totalRequests // 0)\""

echo -e "
✅ Cache test completed!"
