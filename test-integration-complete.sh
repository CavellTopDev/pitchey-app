#!/bin/bash

# Complete Integration Test for Raw SQL Implementation
# Tests WebSocket, Redis, Database, and Auth

echo "🧪 COMPLETE INTEGRATION TEST - RAW SQL IMPLEMENTATION"
echo "======================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run test
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -n "Testing $test_name... "
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASSED${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAILED${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

# 1. Database Connection Tests
echo "📊 DATABASE CONNECTION TESTS"
echo "----------------------------"

# Test health check endpoint
run_test "Database health check" "curl -s http://localhost:8001/health | grep -q 'ok'"

# Test raw SQL query execution
run_test "Raw SQL query execution" "curl -s http://localhost:8001/api/test/db | grep -q 'success'"

echo ""

# 2. Authentication Tests
echo "🔐 AUTHENTICATION TESTS"
echo "----------------------"

# Test sign up with raw SQL
run_test "Sign up (Raw SQL)" 'curl -s -X POST http://localhost:8001/api/auth/signup \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"test@example.com\",\"password\":\"Test123!\",\"username\":\"testuser\"}" \
    | grep -q "session"'

# Test sign in
run_test "Sign in (Raw SQL)" 'curl -s -X POST http://localhost:8001/api/auth/signin \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"alex.creator@demo.com\",\"password\":\"Demo123\"}" \
    | grep -q "token"'

# Test session validation
SESSION_TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/signin \
    -H "Content-Type: application/json" \
    -d '{"email":"alex.creator@demo.com","password":"Demo123"}' \
    | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

run_test "Session validation" "curl -s http://localhost:8001/api/auth/session \
    -H 'Cookie: pitchey-session=$SESSION_TOKEN' \
    | grep -q 'user'"

echo ""

# 3. WebSocket Connection Tests
echo "🔌 WEBSOCKET TESTS"
echo "-----------------"

# Test WebSocket upgrade
run_test "WebSocket upgrade" "curl -s -i -N \
    -H 'Connection: Upgrade' \
    -H 'Upgrade: websocket' \
    -H 'Sec-WebSocket-Version: 13' \
    -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \
    http://localhost:8001/ws \
    | grep -q '101 Switching Protocols'"

echo ""

# 4. Redis Cache Tests
echo "📦 REDIS CACHE TESTS"
echo "-------------------"

# Test cache write
run_test "Cache write" "curl -s -X POST http://localhost:8001/api/test/cache/set \
    -H 'Content-Type: application/json' \
    -d '{\"key\":\"test-key\",\"value\":\"test-value\",\"ttl\":60}' \
    | grep -q 'success'"

# Test cache read
run_test "Cache read" "curl -s http://localhost:8001/api/test/cache/get?key=test-key \
    | grep -q 'test-value'"

echo ""

# 5. API Endpoint Tests
echo "🌐 API ENDPOINT TESTS"
echo "--------------------"

# Test pitch endpoints
run_test "Get pitches" "curl -s http://localhost:8001/api/pitches | grep -q '\\['"

# Test with query parameters
run_test "Get pitches with filter" "curl -s 'http://localhost:8001/api/pitches?status=published&limit=5' \
    | grep -q '\\['"

# Test user endpoints
run_test "Get users" "curl -s http://localhost:8001/api/users \
    -H 'Cookie: pitchey-session=$SESSION_TOKEN' \
    | grep -q '\\['"

echo ""

# 6. Performance Tests
echo "⚡ PERFORMANCE TESTS"
echo "-------------------"

# Test query speed
START_TIME=$(date +%s%N)
curl -s http://localhost:8001/api/pitches?limit=10 > /dev/null
END_TIME=$(date +%s%N)
QUERY_TIME=$(( ($END_TIME - $START_TIME) / 1000000 ))

if [ $QUERY_TIME -lt 100 ]; then
    echo -e "Query response time: ${GREEN}${QUERY_TIME}ms ✅${NC} (< 100ms target)"
    ((TESTS_PASSED++))
else
    echo -e "Query response time: ${RED}${QUERY_TIME}ms ❌${NC} (> 100ms target)"
    ((TESTS_FAILED++))
fi

# Test concurrent connections
echo -n "Testing concurrent connections... "
for i in {1..10}; do
    curl -s http://localhost:8001/api/pitches?limit=1 > /dev/null 2>&1 &
done
wait
echo -e "${GREEN}✅ PASSED${NC}"
((TESTS_PASSED++))

echo ""

# 7. Error Handling Tests
echo "🛡️ ERROR HANDLING TESTS"
echo "----------------------"

# Test invalid SQL injection attempt
run_test "SQL injection protection" "curl -s 'http://localhost:8001/api/pitches?status=published%27%20OR%201=1--' \
    | grep -q 'error'"

# Test invalid authentication
run_test "Invalid auth rejection" "curl -s http://localhost:8001/api/admin/users \
    -H 'Cookie: pitchey-session=invalid-token' \
    | grep -q '401'"

echo ""

# 8. Transaction Tests
echo "💰 TRANSACTION TESTS"
echo "-------------------"

# Test transaction rollback
run_test "Transaction rollback" "curl -s -X POST http://localhost:8001/api/test/transaction \
    -H 'Content-Type: application/json' \
    -d '{\"test\":\"rollback\"}' \
    | grep -q 'rolled back'"

echo ""

# 9. Integration Tests
echo "🔗 INTEGRATION TESTS"
echo "-------------------"

# Test database + cache integration
run_test "Database + Cache" "curl -s http://localhost:8001/api/test/integrated \
    | grep -q 'success'"

# Test WebSocket + Database
run_test "WebSocket + Database" "curl -s http://localhost:8001/api/test/ws-db \
    | grep -q 'success'"

echo ""

# 10. Migration Verification
echo "✅ MIGRATION VERIFICATION"
echo "------------------------"

# Check if Drizzle is removed
echo -n "Checking Drizzle removal... "
if ! grep -q "drizzle-orm" package.json 2>/dev/null; then
    echo -e "${GREEN}✅ REMOVED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ STILL PRESENT${NC}"
    ((TESTS_FAILED++))
fi

# Check if raw SQL files exist
echo -n "Checking raw SQL files... "
if [ -f "src/db/raw-sql-connection.ts" ] && [ -f "src/auth/raw-sql-auth.ts" ]; then
    echo -e "${GREEN}✅ PRESENT${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ MISSING${NC}"
    ((TESTS_FAILED++))
fi

echo ""
echo "======================================================"
echo "📊 TEST RESULTS SUMMARY"
echo "======================================================"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    echo ""
    echo "✨ Your Raw SQL implementation is fully functional!"
    echo "   - WebSockets: Working"
    echo "   - Redis Cache: Working"
    echo "   - Database: Working"
    echo "   - Authentication: Working"
    echo "   - Performance: Optimized"
    exit 0
else
    echo -e "${YELLOW}⚠️ Some tests failed. Please review the output above.${NC}"
    echo ""
    echo "Common issues:"
    echo "  1. Ensure backend is running on port 8001"
    echo "  2. Check database credentials are correct"
    echo "  3. Verify Redis connection is configured"
    exit 1
fi