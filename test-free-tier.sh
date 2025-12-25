#!/bin/bash

# Test Script for Cloudflare Free Tier Implementation
# Tests polling, caching, rate limiting, and performance

API_URL="${API_URL:-http://localhost:8787}"
AUTH_TOKEN=""

echo "🧪 Testing Cloudflare Free Tier Optimizations"
echo "============================================"
echo "API URL: $API_URL"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local expected_status=$3
    local description=$4
    local data=$5
    local headers=$6
    
    echo -n "Testing: $description... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET \
            ${headers:+-H "$headers"} \
            "$API_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            ${headers:+-H "$headers"} \
            ${data:+-d "$data"} \
            -H "Content-Type: application/json" \
            "$API_URL$endpoint")
    fi
    
    status_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓${NC} (${status_code})"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} (Expected: $expected_status, Got: $status_code)"
        echo "  Response: $body"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Test with timing
test_with_timing() {
    local method=$1
    local endpoint=$2
    local description=$3
    local headers=$4
    
    echo -n "Performance: $description... "
    
    start_time=$(date +%s%N)
    
    response=$(curl -s -w "\n%{http_code}\n%{time_total}" -X "$method" \
        ${headers:+-H "$headers"} \
        "$API_URL$endpoint")
    
    end_time=$(date +%s%N)
    elapsed=$((($end_time - $start_time) / 1000000))
    
    status_code=$(echo "$response" | tail -n 2 | head -n 1)
    time_total=$(echo "$response" | tail -n 1)
    
    if [ "$status_code" = "200" ]; then
        if [ $elapsed -lt 100 ]; then
            echo -e "${GREEN}✓${NC} (${elapsed}ms)"
        elif [ $elapsed -lt 500 ]; then
            echo -e "${YELLOW}⚠${NC} (${elapsed}ms - slow)"
        else
            echo -e "${RED}✗${NC} (${elapsed}ms - too slow for free tier)"
        fi
    else
        echo -e "${RED}✗${NC} (HTTP $status_code)"
    fi
}

echo "================================"
echo "1. Testing Basic Endpoints"
echo "================================"

test_endpoint "GET" "/api/health" "200" "Health check"

echo ""
echo "================================"
echo "2. Testing Authentication"
echo "================================"

# Test login
login_response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"alex.creator@demo.com","password":"Demo123","portal":"creator"}' \
    "$API_URL/api/auth/login")

if echo "$login_response" | grep -q "token"; then
    AUTH_TOKEN=$(echo "$login_response" | grep -o '"token":"[^"]*' | sed 's/"token":"//')
    echo -e "${GREEN}✓${NC} Login successful"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗${NC} Login failed"
    echo "Response: $login_response"
    ((TESTS_FAILED++))
fi

echo ""
echo "================================"
echo "3. Testing Polling Endpoints"
echo "================================"

if [ -n "$AUTH_TOKEN" ]; then
    test_endpoint "GET" "/api/poll/notifications" "200" "Poll notifications" "" "Authorization: Bearer $AUTH_TOKEN"
    test_endpoint "GET" "/api/poll/dashboard" "200" "Poll dashboard" "" "Authorization: Bearer $AUTH_TOKEN"
    test_endpoint "GET" "/api/poll/messages" "200" "Poll messages" "" "Authorization: Bearer $AUTH_TOKEN"
    test_endpoint "GET" "/api/poll/all" "200" "Poll all updates" "" "Authorization: Bearer $AUTH_TOKEN"
else
    echo -e "${YELLOW}⚠${NC} Skipping authenticated tests (no auth token)"
fi

echo ""
echo "================================"
echo "4. Testing Cache Headers"
echo "================================"

# Test cache on browse endpoint
echo -n "Testing cache headers... "
response1=$(curl -s -i "$API_URL/api/browse?genre=all" | grep -i "x-cache")
response2=$(curl -s -i "$API_URL/api/browse?genre=all" | grep -i "x-cache")

if echo "$response2" | grep -q "HIT"; then
    echo -e "${GREEN}✓${NC} Cache working (second request was cached)"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠${NC} Cache may not be working"
    ((TESTS_FAILED++))
fi

echo ""
echo "================================"
echo "5. Testing Rate Limiting"
echo "================================"

echo -n "Testing rate limit... "
# Make rapid requests to trigger rate limit
for i in {1..15}; do
    curl -s "$API_URL/api/auth/login" -X POST \
        -H "Content-Type: application/json" \
        -d '{"email":"test@test.com","password":"test"}' > /dev/null 2>&1
done

# This request should be rate limited
rate_limit_response=$(curl -s -w "%{http_code}" -o /dev/null -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"test"}' \
    "$API_URL/api/auth/login")

if [ "$rate_limit_response" = "429" ]; then
    echo -e "${GREEN}✓${NC} Rate limiting working"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠${NC} Rate limiting may not be working (status: $rate_limit_response)"
    ((TESTS_FAILED++))
fi

echo ""
echo "================================"
echo "6. Testing Performance (10ms limit)"
echo "================================"

test_with_timing "GET" "/api/health" "Health check"
test_with_timing "GET" "/api/browse?genre=all" "Browse (should be cached)"

if [ -n "$AUTH_TOKEN" ]; then
    test_with_timing "GET" "/api/profile" "Profile (with auth)" "Authorization: Bearer $AUTH_TOKEN"
    test_with_timing "GET" "/api/dashboard/creator" "Dashboard (with auth)" "Authorization: Bearer $AUTH_TOKEN"
fi

echo ""
echo "================================"
echo "7. Testing WebSocket Fallback"
echo "================================"

echo -n "Testing WebSocket endpoint returns polling info... "
ws_response=$(curl -s "$API_URL/ws")

if echo "$ws_response" | grep -q "Use polling endpoints instead"; then
    echo -e "${GREEN}✓${NC} WebSocket fallback working"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗${NC} WebSocket fallback not working"
    ((TESTS_FAILED++))
fi

echo ""
echo "================================"
echo "8. Testing Stub Endpoints"
echo "================================"

stub_endpoints=(
    "/api/production/investments/overview"
    "/api/investment/recommendations"
    "/api/ndas/incoming-requests"
)

for endpoint in "${stub_endpoints[@]}"; do
    test_endpoint "GET" "$endpoint" "200" "Stub: $endpoint"
done

echo ""
echo "================================"
echo "📊 TEST SUMMARY"
echo "================================"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✅ All tests passed! Free tier optimizations working correctly.${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed. Please review the output above.${NC}"
    exit 1
fi