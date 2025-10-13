#!/bin/bash

# Test script for missing endpoints in Pitchey backend
# This tests the endpoints that were added to fix 404 errors

echo "🧪 Testing Missing Endpoints for Pitchey Backend"
echo "=============================================="

BASE_URL="http://localhost:8001"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local auth_token=$3
    local expected_status=$4
    local description=$5
    
    echo -e "\n${YELLOW}Testing:${NC} $method $endpoint"
    echo "Description: $description"
    
    if [ -n "$auth_token" ]; then
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
                        -X "$method" \
                        -H "Authorization: Bearer $auth_token" \
                        -H "Content-Type: application/json" \
                        "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
                        -X "$method" \
                        -H "Content-Type: application/json" \
                        "$BASE_URL$endpoint")
    fi
    
    http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
    response_body=$(echo "$response" | sed '/HTTP_STATUS:/d')
    
    if [ "$http_status" == "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} - Status: $http_status"
    else
        echo -e "${RED}❌ FAIL${NC} - Expected: $expected_status, Got: $http_status"
    fi
    
    # Show response preview (first 200 chars)
    echo "Response preview: $(echo "$response_body" | head -c 200)..."
}

# Start server in background for testing
echo "🚀 Starting server..."
PORT=8001 deno run --allow-all working-server.ts > server.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 5

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null; then
    echo -e "${RED}❌ Server failed to start${NC}"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

echo -e "${GREEN}✅ Server started successfully${NC}"

# Create a demo JWT token for testing (using demo user ID 1)
# This simulates the token creation process
DEMO_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWxleC5jcmVhdG9yQGRlbW8uY29tIiwidXNlclR5cGUiOiJjcmVhdG9yIiwiaWF0IjoxNzMzOTQwMDAwfQ.dummytoken"

echo -e "\n${YELLOW}=== Testing New Endpoints ===${NC}"

# Test 1: POST /api/auth/logout
test_endpoint "POST" "/api/auth/logout" "$DEMO_TOKEN" "200" "Logout endpoint"

# Test 2: GET /api/auth/profile  
test_endpoint "GET" "/api/auth/profile" "$DEMO_TOKEN" "200" "Get user profile"

# Test 3: GET /api/search/pitches
test_endpoint "GET" "/api/search/pitches?q=movie&page=1&limit=10" "$DEMO_TOKEN" "200" "Search pitches with query"

# Test 4: POST /api/watchlist/1 (add to watchlist)
test_endpoint "POST" "/api/watchlist/1" "$DEMO_TOKEN" "200" "Add pitch to watchlist"

# Test 5: GET /api/nda/status/1
test_endpoint "GET" "/api/nda/status/1" "$DEMO_TOKEN" "200" "Check NDA status"

# Test 6: GET /api/messages/unread-count
test_endpoint "GET" "/api/messages/unread-count" "$DEMO_TOKEN" "200" "Get unread message count"

# Test 7: GET /api/notifications/unread
test_endpoint "GET" "/api/notifications/unread" "$DEMO_TOKEN" "200" "Get unread notifications"

echo -e "\n${YELLOW}=== Testing Fixed Endpoints ===${NC}"

# Test 8: GET /api/pitches/featured (should be public - no auth)
test_endpoint "GET" "/api/pitches/featured?limit=3" "" "200" "Get featured pitches (public)"

# Test 9: GET /api/search/pitches without auth (should require auth)
test_endpoint "GET" "/api/search/pitches?q=test" "" "401" "Search without auth should fail"

echo -e "\n${YELLOW}=== Testing Authentication Requirements ===${NC}"

# Test endpoints without auth tokens to verify they properly require authentication
test_endpoint "POST" "/api/auth/logout" "" "401" "Logout without auth should fail"
test_endpoint "GET" "/api/auth/profile" "" "401" "Profile without auth should fail"
test_endpoint "POST" "/api/watchlist/1" "" "401" "Watchlist without auth should fail"
test_endpoint "GET" "/api/nda/status/1" "" "401" "NDA status without auth should fail"
test_endpoint "GET" "/api/messages/unread-count" "" "401" "Unread count without auth should fail"
test_endpoint "GET" "/api/notifications/unread" "" "401" "Unread notifications without auth should fail"

# Cleanup
echo -e "\n🧹 Cleaning up..."
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

echo -e "\n${GREEN}✅ Test completed!${NC}"
echo "📋 Check the results above to verify all endpoints are working correctly."
echo "📝 Server logs saved to: server.log"