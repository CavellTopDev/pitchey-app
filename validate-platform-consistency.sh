#!/bin/bash

echo "🔍 Platform Consistency Validation Suite"
echo "========================================"
echo ""

PASS=0
FAIL=0
WARN=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_item() {
    local test_name="$1"
    local test_command="$2"
    local expected="$3"
    
    echo -n "Testing: $test_name ... "
    
    result=$(eval "$test_command" 2>/dev/null)
    
    if [[ "$result" == *"$expected"* ]]; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((PASS++))
    else
        echo -e "${RED}❌ FAIL${NC}"
        echo "  Expected: $expected"
        echo "  Got: $result"
        ((FAIL++))
    fi
}

warn_item() {
    local test_name="$1"
    local test_command="$2"
    
    echo -n "Checking: $test_name ... "
    
    result=$(eval "$test_command" 2>/dev/null)
    
    if [ -z "$result" ]; then
        echo -e "${YELLOW}⚠️ WARNING${NC}"
        ((WARN++))
    else
        echo -e "${GREEN}✅ OK${NC}"
        ((PASS++))
    fi
}

echo "=== 1. DATABASE CONSISTENCY ==="
echo ""

# Check if database is accessible
test_item "Database connection" \
    "PGPASSWORD=password psql -h localhost -U postgres -d pitchey -c 'SELECT 1' | grep -c '1 row'" \
    "1"

# Check critical tables exist
test_item "Users table exists" \
    "PGPASSWORD=password psql -h localhost -U postgres -d pitchey -c '\\dt users' | grep -c 'users'" \
    "1"

test_item "Pitches table exists" \
    "PGPASSWORD=password psql -h localhost -U postgres -d pitchey -c '\\dt pitches' | grep -c 'pitches'" \
    "1"

# Check user IDs
test_item "Demo user alex.creator exists with ID 1001" \
    "PGPASSWORD=password psql -h localhost -U postgres -d pitchey -t -c \"SELECT id FROM users WHERE email='alex.creator@demo.com'\" | tr -d ' '" \
    "1001"

echo ""
echo "=== 2. API ENDPOINT CONSISTENCY ==="
echo ""

# Start server if not running
if ! curl -s http://localhost:8001/health > /dev/null 2>&1; then
    echo "Starting server for testing..."
    PORT=8001 deno run --allow-all working-server.ts > /dev/null 2>&1 &
    SERVER_PID=$!
    sleep 3
fi

# Get auth token
TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}' 2>/dev/null | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
    echo -e "Authentication: ${GREEN}✅ Working${NC}"
    ((PASS++))
else
    echo -e "Authentication: ${RED}❌ Failed${NC}"
    ((FAIL++))
fi

# Test critical endpoints
test_item "GET /api/creator/followers" \
    "curl -s -o /dev/null -w '%{http_code}' -X GET 'http://localhost:8001/api/creator/followers' -H 'Authorization: Bearer $TOKEN'" \
    "200"

test_item "GET /api/creator/saved-pitches" \
    "curl -s -o /dev/null -w '%{http_code}' -X GET 'http://localhost:8001/api/creator/saved-pitches' -H 'Authorization: Bearer $TOKEN'" \
    "200"

test_item "GET /api/pitches response format" \
    "curl -s -X GET 'http://localhost:8001/api/pitches' | python3 -c 'import json,sys; d=json.load(sys.stdin); print(\"success\" in d)' 2>/dev/null" \
    "True"

echo ""
echo "=== 3. WEBSOCKET CONSISTENCY ==="
echo ""

# Check WebSocket endpoint
warn_item "WebSocket endpoint accessible" \
    "curl -s -o /dev/null -w '%{http_code}' -H 'Upgrade: websocket' 'http://localhost:8001/ws'"

echo ""
echo "=== 4. CONFIGURATION CONSISTENCY ==="
echo ""

# Check environment files
test_item "Backend .env exists" \
    "[ -f .env ] && echo 'exists'" \
    "exists"

test_item "Frontend .env exists" \
    "[ -f frontend/.env ] && echo 'exists'" \
    "exists"

warn_item "Frontend API_URL matches backend PORT" \
    "grep 'VITE_API_URL.*8001' frontend/.env"

echo ""
echo "=== 5. TYPE CONSISTENCY ==="
echo ""

# Check for TypeScript errors
warn_item "Frontend TypeScript compilation" \
    "cd frontend && npx tsc --noEmit 2>&1 | grep -c 'error TS'"

echo ""
echo "=== 6. DRIZZLE SCHEMA CONSISTENCY ==="
echo ""

# Check Drizzle schema matches database
test_item "Drizzle users table has correct columns" \
    "grep -c 'firstName.*first_name' src/db/schema.ts" \
    "1"

test_item "Drizzle follows table has creatorId" \
    "grep -c 'creatorId.*creator_id' src/db/schema.ts" \
    "1"

echo ""
echo "========================================"
echo "VALIDATION SUMMARY"
echo "========================================"
echo -e "${GREEN}Passed:${NC} $PASS"
echo -e "${RED}Failed:${NC} $FAIL"  
echo -e "${YELLOW}Warnings:${NC} $WARN"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✅ Platform is consistent!${NC}"
    exit 0
else
    echo -e "${RED}❌ Found $FAIL critical inconsistencies${NC}"
    echo ""
    echo "Run ./fix-critical-inconsistencies.sh to auto-fix issues"
    exit 1
fi

# Cleanup
if [ -n "$SERVER_PID" ]; then
    kill $SERVER_PID 2>/dev/null
fi