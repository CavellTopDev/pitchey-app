#!/bin/bash

# Test performance improvements after optimization
# Usage: ./test-optimized-performance.sh [production|local]

ENV=${1:-production}

if [ "$ENV" = "production" ]; then
    API_URL="https://pitchey-production.cavelltheleaddev.workers.dev"
    echo "🚀 Testing PRODUCTION worker performance"
else
    API_URL="http://localhost:8787"
    echo "🚀 Testing LOCAL worker performance"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Performance Test Suite - With Optimizations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 1: Cache Performance (Multiple Requests)
echo -e "\n📍 Test 1: Edge Cache Performance"
echo "Testing /api/pitches/browse/enhanced endpoint..."

# First request (cache miss)
echo -e "\nRequest 1 (Cold - Cache Miss):"
response1=$(curl -s -w "\n⏱️  Response Time: %{time_total}s\n📦 Size: %{size_download} bytes" \
    -H "Accept: application/json" \
    -D - \
    "$API_URL/api/pitches/browse/enhanced?limit=10")
    
# Extract and display cache headers
echo "$response1" | grep -i "x-cache-status" || echo "X-Cache-Status: Not found"
echo "$response1" | grep -i "x-response-time" || echo "X-Response-Time: Not found"

# Second request (should be cache hit)
echo -e "\nRequest 2 (Warm - Cache Hit Expected):"
response2=$(curl -s -w "\n⏱️  Response Time: %{time_total}s\n📦 Size: %{size_download} bytes" \
    -H "Accept: application/json" \
    -D - \
    "$API_URL/api/pitches/browse/enhanced?limit=10")
    
echo "$response2" | grep -i "x-cache-status" || echo "X-Cache-Status: Not found"
echo "$response2" | grep -i "x-response-time" || echo "X-Response-Time: Not found"

# Third request (confirm cache hit)
echo -e "\nRequest 3 (Warm - Cache Hit Expected):"
response3=$(curl -s -w "\n⏱️  Response Time: %{time_total}s\n📦 Size: %{size_download} bytes" \
    -H "Accept: application/json" \
    -D - \
    "$API_URL/api/pitches/browse/enhanced?limit=10")
    
echo "$response3" | grep -i "x-cache-status" || echo "X-Cache-Status: Not found"
echo "$response3" | grep -i "x-response-time" || echo "X-Response-Time: Not found"

# Test 2: Database Retry Logic
echo -e "\n\n📍 Test 2: Database Retry Logic"
echo "Testing resilience with rapid requests..."

for i in {1..5}; do
    echo -e "\nRapid Request $i:"
    curl -s -o /dev/null -w "Status: %{http_code}, Time: %{time_total}s\n" \
        "$API_URL/api/pitches/browse/enhanced?limit=5&offset=$((i*5))"
done

# Test 3: Different Cache Keys
echo -e "\n\n📍 Test 3: Cache Key Differentiation"
echo "Testing different query parameters..."

echo -e "\nGenre filter (Action):"
curl -s -w "Time: %{time_total}s\n" -o /dev/null \
    -D - "$API_URL/api/pitches/browse/enhanced?genre=Action&limit=5" | grep -i "x-cache-status"

echo -e "\nGenre filter (Comedy):"
curl -s -w "Time: %{time_total}s\n" -o /dev/null \
    -D - "$API_URL/api/pitches/browse/enhanced?genre=Comedy&limit=5" | grep -i "x-cache-status"

echo -e "\nSort by views:"
curl -s -w "Time: %{time_total}s\n" -o /dev/null \
    -D - "$API_URL/api/pitches/browse/enhanced?sort=views&limit=5" | grep -i "x-cache-status"

# Test 4: Health Check Performance
echo -e "\n\n📍 Test 4: Health Check Performance"
echo "Testing /api/health endpoint..."

for i in {1..3}; do
    echo -e "\nHealth Check $i:"
    curl -s -w "Time: %{time_total}s, Status: %{http_code}\n" \
        "$API_URL/api/health" | jq -r '.status' 2>/dev/null || echo "Response received"
done

# Test 5: Concurrent Requests
echo -e "\n\n📍 Test 5: Concurrent Request Handling"
echo "Sending 10 concurrent requests..."

for i in {1..10}; do
    curl -s -o /dev/null -w "Request $i: %{time_total}s\n" \
        "$API_URL/api/pitches/browse/enhanced?limit=2&offset=$i" &
done
wait

# Summary
echo -e "\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Performance Test Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎯 Expected Improvements:"
echo "  • Cache Hit responses: <100ms (vs 400ms+ uncached)"
echo "  • X-Cache-Status: HIT for repeated requests"
echo "  • X-Response-Time: Visible in headers"
echo "  • Database retry: More resilient under load"
echo ""
echo "📊 Next Steps:"
echo "  1. Monitor cache hit rate over time"
echo "  2. Adjust cache TTL based on usage patterns"
echo "  3. Enable Hyperdrive for connection pooling"
echo "  4. Add more endpoints to optimization"