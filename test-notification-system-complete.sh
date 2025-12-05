#!/bin/bash

# Comprehensive Notification System Test Suite
# Tests all notification endpoints, Twilio webhooks, and preferences

API_URL="${API_URL:-https://pitchey-production.cavelltheleaddev.workers.dev}"
LOCAL_URL="${LOCAL_URL:-http://localhost:8001}"

# Use local URL if testing locally
if [ "$1" == "local" ]; then
    API_URL="$LOCAL_URL"
    echo "🔧 Testing against local server: $API_URL"
else
    echo "🌍 Testing against production: $API_URL"
fi

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}   PITCHEY NOTIFICATION SYSTEM TEST SUITE${NC}"
echo -e "${BLUE}================================================${NC}"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local description=$5
    local auth_token=$6
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "\n${BLUE}Test $TOTAL_TESTS: $description${NC}"
    echo "Endpoint: $method $endpoint"
    
    if [ -z "$data" ]; then
        if [ -z "$auth_token" ]; then
            response=$(curl -s -w "\n%{http_code}" -X $method "$API_URL$endpoint")
        else
            response=$(curl -s -w "\n%{http_code}" -X $method \
                -H "Authorization: Bearer $auth_token" \
                "$API_URL$endpoint")
        fi
    else
        if [ -z "$auth_token" ]; then
            response=$(curl -s -w "\n%{http_code}" -X $method \
                -H "Content-Type: application/json" \
                -d "$data" \
                "$API_URL$endpoint")
        else
            response=$(curl -s -w "\n%{http_code}" -X $method \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $auth_token" \
                -d "$data" \
                "$API_URL$endpoint")
        fi
    fi
    
    status_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$status_code" == "$expected_status" ]; then
        echo -e "${GREEN}✅ PASSED${NC} - Status: $status_code"
        if [ "$VERBOSE" == "true" ]; then
            echo "Response: $body" | jq '.' 2>/dev/null || echo "$body"
        fi
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ FAILED${NC} - Expected: $expected_status, Got: $status_code"
        echo "Response: $body" | jq '.' 2>/dev/null || echo "$body"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# ============================================
# AUTHENTICATION
# ============================================

echo -e "\n${YELLOW}=== AUTHENTICATION ===${NC}"

# Login as demo creator
login_response=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "alex.creator@demo.com",
        "password": "Demo123"
    }')

TOKEN=$(echo "$login_response" | jq -r '.data.token // .token')

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    echo -e "${GREEN}✅ Authentication successful${NC}"
else
    echo -e "${RED}❌ Authentication failed${NC}"
    echo "$login_response" | jq '.'
    exit 1
fi

# ============================================
# NOTIFICATION PREFERENCES
# ============================================

echo -e "\n${YELLOW}=== NOTIFICATION PREFERENCES ===${NC}"

# Test GET preferences
test_endpoint "GET" "/api/notifications/preferences" "" "200" \
    "Get notification preferences" "$TOKEN"

# Test UPDATE preferences
preferences_update='{
  "email_notifications": true,
  "sms_notifications": true,
  "push_notifications": false,
  "notification_frequency": "digest",
  "marketing_emails": false,
  "digest_frequency": "weekly",
  "timezone": "America/New_York"
}'

test_endpoint "PUT" "/api/notifications/preferences" "$preferences_update" "200" \
    "Update notification preferences" "$TOKEN"

# Test invalid field update (should fail)
invalid_update='{
  "invalid_field": "test",
  "another_invalid": 123
}'

test_endpoint "PUT" "/api/notifications/preferences" "$invalid_update" "400" \
    "Reject invalid preference fields" "$TOKEN"

# ============================================
# NOTIFICATION DASHBOARD
# ============================================

echo -e "\n${YELLOW}=== NOTIFICATION DASHBOARD ===${NC}"

# Test dashboard access (non-admin should fail)
test_endpoint "GET" "/api/notifications/dashboard" "" "403" \
    "Dashboard requires admin (expected to fail)" "$TOKEN"

# Test notification unread endpoint
test_endpoint "GET" "/api/notifications/unread" "" "200" \
    "Get unread notifications" "$TOKEN"

# ============================================
# SMS TESTING
# ============================================

echo -e "\n${YELLOW}=== SMS TESTING ===${NC}"

# Test SMS send (simulation)
sms_data='{
  "to": "+1234567890",
  "message": "Test SMS from Pitchey notification system"
}'

test_endpoint "POST" "/api/sms/test" "$sms_data" "200" \
    "Send test SMS" "$TOKEN"

# Test SMS without required fields
invalid_sms='{
  "message": "Missing phone number"
}'

test_endpoint "POST" "/api/sms/test" "$invalid_sms" "400" \
    "Reject SMS without phone number" "$TOKEN"

# ============================================
# TWILIO WEBHOOKS (No Auth Required)
# ============================================

echo -e "\n${YELLOW}=== TWILIO WEBHOOKS ===${NC}"

# Note: These will fail without proper Twilio signature
# but we test that they exist and respond

# Test status webhook exists
test_endpoint "POST" "/webhooks/twilio/status" "" "401" \
    "Twilio status webhook exists (401 expected without signature)" ""

# Test incoming webhook exists
test_endpoint "POST" "/webhooks/twilio/incoming" "" "401" \
    "Twilio incoming webhook exists (401 expected without signature)" ""

# ============================================
# ENTERPRISE SERVICE ENDPOINTS
# ============================================

echo -e "\n${YELLOW}=== ENTERPRISE SERVICES ===${NC}"

services=("ml" "data-science" "security" "distributed" "edge" "automation")

for service in "${services[@]}"; do
    test_endpoint "GET" "/api/$service/overview" "" "200" \
        "$service service overview" ""
done

# ============================================
# WEBSOCKET CONNECTION TEST
# ============================================

echo -e "\n${YELLOW}=== WEBSOCKET CONNECTION ===${NC}"

if command -v wscat &> /dev/null; then
    echo "Testing WebSocket connection..."
    timeout 2 wscat -c "${API_URL/https/wss}/ws?token=$TOKEN" &
    ws_pid=$!
    sleep 1
    
    if ps -p $ws_pid > /dev/null; then
        echo -e "${GREEN}✅ WebSocket connection established${NC}"
        kill $ws_pid 2>/dev/null
    else
        echo -e "${YELLOW}⚠️ WebSocket connection test inconclusive${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ wscat not installed, skipping WebSocket test${NC}"
    echo "Install with: npm install -g wscat"
fi

# ============================================
# ANALYTICS ENDPOINTS
# ============================================

echo -e "\n${YELLOW}=== ANALYTICS ENDPOINTS ===${NC}"

test_endpoint "GET" "/api/analytics/user" "" "200" \
    "User analytics" "$TOKEN"

test_endpoint "GET" "/api/analytics/dashboard" "" "200" \
    "Dashboard analytics" "$TOKEN"

test_endpoint "GET" "/api/analytics/pitch/1" "" "200" \
    "Pitch analytics" "$TOKEN"

# ============================================
# DATABASE CONNECTION
# ============================================

echo -e "\n${YELLOW}=== DATABASE CONNECTION ===${NC}"

test_endpoint "GET" "/api/db-test" "" "200" \
    "Database connectivity test" ""

# ============================================
# HEALTH CHECK
# ============================================

echo -e "\n${YELLOW}=== HEALTH CHECK ===${NC}"

test_endpoint "GET" "/api/health" "" "200" \
    "API health check" ""

# ============================================
# TEST SUMMARY
# ============================================

echo -e "\n${BLUE}================================================${NC}"
echo -e "${BLUE}              TEST SUMMARY${NC}"
echo -e "${BLUE}================================================${NC}"

PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))

echo -e "Total Tests: ${TOTAL_TESTS}"
echo -e "Passed: ${GREEN}${PASSED_TESTS}${NC}"
echo -e "Failed: ${RED}${FAILED_TESTS}${NC}"
echo -e "Pass Rate: ${PASS_RATE}%"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ALL TESTS PASSED! 🎉${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️ SOME TESTS FAILED${NC}"
    exit 1
fi