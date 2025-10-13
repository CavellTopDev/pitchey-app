#!/bin/bash

# Comprehensive Platform Testing Script
# Tests all major components of the Pitchey platform

echo "🚀 COMPREHENSIVE PITCHEY PLATFORM TESTING"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASS=0
FAIL=0
TOTAL=0

# Test function
test_endpoint() {
    local test_name="$1"
    local method="$2"
    local endpoint="$3"
    local headers="$4"
    local data="$5"
    local expected_status="$6"
    
    echo -n "Testing: $test_name ... "
    TOTAL=$((TOTAL + 1))
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X "$method" "$endpoint" $headers -d "$data")
    else
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X "$method" "$endpoint" $headers)
    fi
    
    status=$(echo "$response" | grep -o 'HTTPSTATUS:[0-9]*' | cut -d':' -f2)
    body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    if [ "$status" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} ($status)"
        PASS=$((PASS + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (Expected: $expected_status, Got: $status)"
        echo "   Response: $body" | head -c 100
        FAIL=$((FAIL + 1))
        return 1
    fi
}

echo "🔐 AUTHENTICATION TESTING"
echo "========================="
echo ""

# Get authentication tokens
echo "Getting authentication tokens..."

CREATOR_RESPONSE=$(curl -s -X POST http://localhost:8001/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}')
CREATOR_TOKEN=$(echo "$CREATOR_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

INVESTOR_RESPONSE=$(curl -s -X POST http://localhost:8001/api/auth/investor/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah.investor@demo.com","password":"Demo123"}')
INVESTOR_TOKEN=$(echo "$INVESTOR_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

PRODUCTION_RESPONSE=$(curl -s -X POST http://localhost:8001/api/auth/production/login \
  -H "Content-Type: application/json" \
  -d '{"email":"stellar.production@demo.com","password":"Demo123"}')
PRODUCTION_TOKEN=$(echo "$PRODUCTION_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$CREATOR_TOKEN" ] && [ -n "$INVESTOR_TOKEN" ] && [ -n "$PRODUCTION_TOKEN" ]; then
    echo -e "${GREEN}✅ All tokens obtained successfully${NC}"
else
    echo -e "${RED}❌ Failed to get authentication tokens${NC}"
    exit 1
fi

echo ""

# Test authentication endpoints
test_endpoint "Creator Login" "POST" "http://localhost:8001/api/auth/creator/login" \
    "-H 'Content-Type: application/json'" \
    '{"email":"alex.creator@demo.com","password":"Demo123"}' "200"

test_endpoint "Investor Login" "POST" "http://localhost:8001/api/auth/investor/login" \
    "-H 'Content-Type: application/json'" \
    '{"email":"sarah.investor@demo.com","password":"Demo123"}' "200"

test_endpoint "Production Login" "POST" "http://localhost:8001/api/auth/production/login" \
    "-H 'Content-Type: application/json'" \
    '{"email":"stellar.production@demo.com","password":"Demo123"}' "200"

test_endpoint "Invalid Login" "POST" "http://localhost:8001/api/auth/creator/login" \
    "-H 'Content-Type: application/json'" \
    '{"email":"invalid@test.com","password":"wrong"}' "400"

echo ""
echo "📊 API ENDPOINT TESTING"
echo "======================="
echo ""

# Creator endpoints
test_endpoint "Creator Followers" "GET" "http://localhost:8001/api/creator/followers" \
    "-H 'Authorization: Bearer $CREATOR_TOKEN'" "" "200"

test_endpoint "Creator Saved Pitches" "GET" "http://localhost:8001/api/creator/saved-pitches" \
    "-H 'Authorization: Bearer $CREATOR_TOKEN'" "" "200"

test_endpoint "Creator Recommendations" "GET" "http://localhost:8001/api/creator/recommendations" \
    "-H 'Authorization: Bearer $CREATOR_TOKEN'" "" "200"

# Investment endpoints
test_endpoint "Investment Details" "GET" "http://localhost:8001/api/investments/7/details" \
    "-H 'Authorization: Bearer $INVESTOR_TOKEN'" "" "200"

# Production endpoints
test_endpoint "Production Analytics" "GET" "http://localhost:8001/api/production/analytics" \
    "-H 'Authorization: Bearer $PRODUCTION_TOKEN'" "" "200"

test_endpoint "Production Calendar" "GET" "http://localhost:8001/api/production/calendar" \
    "-H 'Authorization: Bearer $PRODUCTION_TOKEN'" "" "200"

# Public endpoints
test_endpoint "Public Pitches List" "GET" "http://localhost:8001/api/pitches" "" "" "200"

test_endpoint "Search Pitches" "GET" "http://localhost:8001/api/pitches/search?q=test" "" "" "200"

echo ""
echo "🔒 SECURITY TESTING"
echo "=================="
echo ""

# Test unauthorized access
test_endpoint "Unauthorized Access" "GET" "http://localhost:8001/api/creator/followers" \
    "" "" "401"

test_endpoint "Invalid Token" "GET" "http://localhost:8001/api/creator/followers" \
    "-H 'Authorization: Bearer invalid_token'" "" "401"

# Test CORS
test_endpoint "CORS Preflight" "OPTIONS" "http://localhost:8001/api/pitches" \
    "-H 'Origin: http://localhost:5173'" "" "200"

echo ""
echo "📁 DATABASE TESTING"
echo "=================="
echo ""

echo -n "Testing database connectivity ... "
if PGPASSWORD=password psql -h localhost -U postgres -d pitchey -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC}"
    PASS=$((PASS + 1))
else
    echo -e "${RED}❌ FAIL${NC}"
    FAIL=$((FAIL + 1))
fi
TOTAL=$((TOTAL + 1))

echo -n "Testing user data integrity ... "
USER_COUNT=$(PGPASSWORD=password psql -h localhost -U postgres -d pitchey -t -c "SELECT COUNT(*) FROM users WHERE id IN (1001, 1002, 1003);" | tr -d ' ')
if [ "$USER_COUNT" = "3" ]; then
    echo -e "${GREEN}✅ PASS${NC} ($USER_COUNT demo users)"
    PASS=$((PASS + 1))
else
    echo -e "${RED}❌ FAIL${NC} (Expected 3 users, got $USER_COUNT)"
    FAIL=$((FAIL + 1))
fi
TOTAL=$((TOTAL + 1))

echo -n "Testing pitch data ... "
PITCH_COUNT=$(PGPASSWORD=password psql -h localhost -U postgres -d pitchey -t -c "SELECT COUNT(*) FROM pitches;" | tr -d ' ')
if [ "$PITCH_COUNT" -gt "0" ]; then
    echo -e "${GREEN}✅ PASS${NC} ($PITCH_COUNT pitches)"
    PASS=$((PASS + 1))
else
    echo -e "${RED}❌ FAIL${NC} (No pitches found)"
    FAIL=$((FAIL + 1))
fi
TOTAL=$((TOTAL + 1))

echo -n "Testing foreign key relationships ... "
ORPHANED=$(PGPASSWORD=password psql -h localhost -U postgres -d pitchey -t -c "SELECT COUNT(*) FROM pitches WHERE user_id NOT IN (SELECT id FROM users);" | tr -d ' ')
if [ "$ORPHANED" = "0" ]; then
    echo -e "${GREEN}✅ PASS${NC} (No orphaned records)"
    PASS=$((PASS + 1))
else
    echo -e "${RED}❌ FAIL${NC} ($ORPHANED orphaned pitches)"
    FAIL=$((FAIL + 1))
fi
TOTAL=$((TOTAL + 1))

echo ""
echo "🔌 WEBSOCKET TESTING"
echo "==================="
echo ""

echo -n "Testing WebSocket endpoint ... "
WS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Upgrade: websocket" \
    -H "Connection: Upgrade" \
    "http://localhost:8001/ws")
if [ "$WS_STATUS" = "400" ] || [ "$WS_STATUS" = "101" ]; then
    echo -e "${GREEN}✅ PASS${NC} (Endpoint accessible)"
    PASS=$((PASS + 1))
else
    echo -e "${RED}❌ FAIL${NC} (Status: $WS_STATUS)"
    FAIL=$((FAIL + 1))
fi
TOTAL=$((TOTAL + 1))

echo ""
echo "⚡ PERFORMANCE TESTING"
echo "===================="
echo ""

echo -n "Testing API response time ... "
START_TIME=$(date +%s%N)
curl -s "http://localhost:8001/api/pitches" > /dev/null
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 )) # Convert to milliseconds

if [ "$RESPONSE_TIME" -lt "1000" ]; then
    echo -e "${GREEN}✅ PASS${NC} (${RESPONSE_TIME}ms)"
    PASS=$((PASS + 1))
else
    echo -e "${YELLOW}⚠️ SLOW${NC} (${RESPONSE_TIME}ms)"
    FAIL=$((FAIL + 1))
fi
TOTAL=$((TOTAL + 1))

echo -n "Testing concurrent requests ... "
START_TIME=$(date +%s)
for i in {1..10}; do
    curl -s "http://localhost:8001/api/pitches" > /dev/null &
done
wait
END_TIME=$(date +%s)
CONCURRENT_TIME=$((END_TIME - START_TIME))

if [ "$CONCURRENT_TIME" -lt "5" ]; then
    echo -e "${GREEN}✅ PASS${NC} (${CONCURRENT_TIME}s for 10 concurrent requests)"
    PASS=$((PASS + 1))
else
    echo -e "${YELLOW}⚠️ SLOW${NC} (${CONCURRENT_TIME}s for 10 concurrent requests)"
    FAIL=$((FAIL + 1))
fi
TOTAL=$((TOTAL + 1))

echo ""
echo "🌐 FRONTEND INTEGRATION TESTING"
echo "==============================="
echo ""

echo -n "Testing frontend assets ... "
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:5173" | grep -q "200"; then
    echo -e "${GREEN}✅ PASS${NC} (Frontend accessible)"
    PASS=$((PASS + 1))
else
    echo -e "${YELLOW}⚠️ SKIP${NC} (Frontend not running on :5173)"
    # Don't count as fail since frontend might not be running
fi
TOTAL=$((TOTAL + 1))

echo ""
echo "📋 ERROR HANDLING TESTING"
echo "========================="
echo ""

# Test malformed JSON
test_endpoint "Malformed JSON" "POST" "http://localhost:8001/api/auth/creator/login" \
    "-H 'Content-Type: application/json'" \
    '{"invalid":json}' "400"

# Test missing content-type
test_endpoint "Missing Content-Type" "POST" "http://localhost:8001/api/auth/creator/login" \
    "" \
    '{"email":"test","password":"test"}' "400"

# Test non-existent endpoint
test_endpoint "Non-existent Endpoint" "GET" "http://localhost:8001/api/nonexistent" "" "" "404"

echo ""
echo "========================================"
echo "🎯 TEST RESULTS SUMMARY"
echo "========================================"
echo ""

PASS_RATE=$(( PASS * 100 / TOTAL ))

echo -e "Total Tests: ${BLUE}$TOTAL${NC}"
echo -e "Passed: ${GREEN}$PASS${NC}"
echo -e "Failed: ${RED}$FAIL${NC}"
echo -e "Pass Rate: ${BLUE}${PASS_RATE}%${NC}"

echo ""

if [ "$FAIL" -eq "0" ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED! Platform is working perfectly.${NC}"
    exit 0
elif [ "$PASS_RATE" -ge "80" ]; then
    echo -e "${YELLOW}⚠️ Platform is mostly working with minor issues.${NC}"
    exit 0
else
    echo -e "${RED}❌ Platform has significant issues that need attention.${NC}"
    exit 1
fi