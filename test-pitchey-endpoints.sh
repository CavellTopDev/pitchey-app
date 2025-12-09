#!/bin/bash

# Pitchey API Endpoint Testing Script
# Run this BEFORE Chrome DevTools testing to document API status
# Usage: ./test-pitchey-endpoints.sh

API_BASE="https://pitchey-production.cavelltheleaddev.workers.dev"
ORIGIN="https://pitchey.pages.dev"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

LOG_FILE="pitchey_api_test_$(date +%Y%m%d_%H%M%S).log"

echo "=============================================" | tee -a $LOG_FILE
echo "PITCHEY API ENDPOINT TEST RESULTS" | tee -a $LOG_FILE
echo "Date: $(date)" | tee -a $LOG_FILE
echo "=============================================" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local auth_required=$3
    local token=$4
    local data=$5
    
    local full_url="${API_BASE}${endpoint}"
    local headers="-H 'Origin: $ORIGIN' -H 'Content-Type: application/json'"
    
    if [ "$auth_required" = "true" ] && [ -n "$token" ]; then
        headers="$headers -H 'Authorization: Bearer $token'"
    fi
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$full_url" \
            -H "Origin: $ORIGIN" \
            -H "Content-Type: application/json" \
            ${token:+-H "Authorization: Bearer $token"} 2>&1)
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$full_url" \
            -H "Origin: $ORIGIN" \
            -H "Content-Type: application/json" \
            ${token:+-H "Authorization: Bearer $token"} \
            ${data:+-d "$data"} 2>&1)
    fi
    
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | sed '$d')
    
    # Check for CORS
    cors_check=$(curl -s -I -X OPTIONS "$full_url" \
        -H "Origin: $ORIGIN" \
        -H "Access-Control-Request-Method: $method" 2>&1 | grep -i "access-control-allow-origin")
    
    if [ -z "$cors_check" ]; then
        status="${RED}CORS FAIL${NC}"
        status_log="CORS FAIL"
    elif [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        status="${GREEN}✓ $http_code${NC}"
        status_log="✓ $http_code"
    elif [ "$http_code" = "401" ]; then
        status="${YELLOW}401 AUTH${NC}"
        status_log="401 AUTH"
    elif [ "$http_code" = "404" ]; then
        status="${RED}404 NOT FOUND${NC}"
        status_log="404 NOT FOUND"
    else
        status="${RED}$http_code ERROR${NC}"
        status_log="$http_code ERROR"
    fi
    
    printf "%-50s %s\n" "$method $endpoint" "$status"
    echo "$method $endpoint: $status_log" >> $LOG_FILE
}

# Get auth tokens
echo "=== AUTHENTICATION ===" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

echo "Getting Creator token..."
CREATOR_RESPONSE=$(curl -s -X POST "${API_BASE}/api/auth/creator/login" \
    -H "Origin: $ORIGIN" \
    -H "Content-Type: application/json" \
    -d '{"email":"alex.creator@demo.com","password":"Demo123"}')
CREATOR_TOKEN=$(echo $CREATOR_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$CREATOR_TOKEN" ]; then
    echo -e "${GREEN}Creator login: SUCCESS${NC}"
    echo "Creator login: SUCCESS" >> $LOG_FILE
else
    echo -e "${RED}Creator login: FAILED${NC}"
    echo "Creator login: FAILED" >> $LOG_FILE
fi

echo "Getting Investor token..."
INVESTOR_RESPONSE=$(curl -s -X POST "${API_BASE}/api/auth/investor/login" \
    -H "Origin: $ORIGIN" \
    -H "Content-Type: application/json" \
    -d '{"email":"sarah.investor@demo.com","password":"Demo123"}')
INVESTOR_TOKEN=$(echo $INVESTOR_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$INVESTOR_TOKEN" ]; then
    echo -e "${GREEN}Investor login: SUCCESS${NC}"
    echo "Investor login: SUCCESS" >> $LOG_FILE
else
    echo -e "${RED}Investor login: FAILED${NC}"
    echo "Investor login: FAILED" >> $LOG_FILE
fi

echo "Getting Production token..."
PRODUCTION_RESPONSE=$(curl -s -X POST "${API_BASE}/api/auth/production/login" \
    -H "Origin: $ORIGIN" \
    -H "Content-Type: application/json" \
    -d '{"email":"stellar.production@demo.com","password":"Demo123"}')
PRODUCTION_TOKEN=$(echo $PRODUCTION_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$PRODUCTION_TOKEN" ]; then
    echo -e "${GREEN}Production login: SUCCESS${NC}"
    echo "Production login: SUCCESS" >> $LOG_FILE
else
    echo -e "${RED}Production login: FAILED${NC}"
    echo "Production login: FAILED" >> $LOG_FILE
fi

echo "" | tee -a $LOG_FILE
echo "=== PUBLIC ENDPOINTS (No Auth Required) ===" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

test_endpoint "GET" "/api/health" "false"
test_endpoint "GET" "/api/pitches/browse/enhanced?limit=5" "false"
test_endpoint "GET" "/api/pitches/trending" "false"
test_endpoint "GET" "/api/pitches/new" "false"

echo "" | tee -a $LOG_FILE
echo "=== CREATOR ENDPOINTS ===" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

test_endpoint "GET" "/api/validate-token" "true" "$CREATOR_TOKEN"
test_endpoint "GET" "/api/creator/dashboard" "true" "$CREATOR_TOKEN"
test_endpoint "GET" "/api/creator/pitches" "true" "$CREATOR_TOKEN"
test_endpoint "GET" "/api/analytics/dashboard" "true" "$CREATOR_TOKEN"
test_endpoint "GET" "/api/analytics/realtime" "true" "$CREATOR_TOKEN"
test_endpoint "GET" "/api/analytics/user" "true" "$CREATOR_TOKEN"
test_endpoint "GET" "/api/notifications/unread" "true" "$CREATOR_TOKEN"
test_endpoint "GET" "/api/user/notifications?limit=10" "true" "$CREATOR_TOKEN"
test_endpoint "GET" "/api/payments/credits/balance" "true" "$CREATOR_TOKEN"
test_endpoint "GET" "/api/payments/subscription-status" "true" "$CREATOR_TOKEN"

echo "" | tee -a $LOG_FILE
echo "=== NDA ENDPOINTS ===" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

test_endpoint "GET" "/api/nda/pending" "true" "$CREATOR_TOKEN"
test_endpoint "GET" "/api/nda/active" "true" "$CREATOR_TOKEN"
test_endpoint "GET" "/api/ndas/incoming-requests" "true" "$CREATOR_TOKEN"
test_endpoint "GET" "/api/ndas/outgoing-requests" "true" "$CREATOR_TOKEN"
test_endpoint "GET" "/api/ndas/incoming-signed" "true" "$CREATOR_TOKEN"
test_endpoint "GET" "/api/ndas/outgoing-signed" "true" "$CREATOR_TOKEN"
test_endpoint "GET" "/api/ndas/stats" "true" "$CREATOR_TOKEN"

echo "" | tee -a $LOG_FILE
echo "=== INVESTOR ENDPOINTS ===" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

test_endpoint "GET" "/api/investor/portfolio/summary" "true" "$INVESTOR_TOKEN"
test_endpoint "GET" "/api/investor/investments" "true" "$INVESTOR_TOKEN"
test_endpoint "GET" "/api/investor/dashboard" "true" "$INVESTOR_TOKEN"
test_endpoint "GET" "/api/saved-pitches" "true" "$INVESTOR_TOKEN"
test_endpoint "GET" "/api/user/saved-pitches" "true" "$INVESTOR_TOKEN"
test_endpoint "GET" "/api/investment/recommendations?limit=5" "true" "$INVESTOR_TOKEN"
test_endpoint "GET" "/api/pitches/following" "true" "$INVESTOR_TOKEN"
test_endpoint "GET" "/api/follows/stats/1" "false"

echo "" | tee -a $LOG_FILE
echo "=== PRODUCTION ENDPOINTS ===" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

test_endpoint "GET" "/api/production/submissions" "true" "$PRODUCTION_TOKEN"
test_endpoint "GET" "/api/production/projects" "true" "$PRODUCTION_TOKEN"
test_endpoint "GET" "/api/production/investments/overview" "true" "$PRODUCTION_TOKEN"

echo "" | tee -a $LOG_FILE
echo "=============================================" | tee -a $LOG_FILE
echo "TEST COMPLETE" | tee -a $LOG_FILE
echo "Results saved to: $LOG_FILE" | tee -a $LOG_FILE
echo "=============================================" | tee -a $LOG_FILE

# Summary
echo "" | tee -a $LOG_FILE
echo "=== SUMMARY ===" | tee -a $LOG_FILE
CORS_FAILS=$(grep -c "CORS FAIL" $LOG_FILE)
NOT_FOUND=$(grep -c "404" $LOG_FILE)
SUCCESSES=$(grep -c "✓" $LOG_FILE)
AUTH_ISSUES=$(grep -c "401" $LOG_FILE)

echo "✓ Successful: $SUCCESSES" | tee -a $LOG_FILE
echo "✗ CORS Failures: $CORS_FAILS" | tee -a $LOG_FILE
echo "✗ 404 Not Found: $NOT_FOUND" | tee -a $LOG_FILE
echo "⚠ Auth Required: $AUTH_ISSUES" | tee -a $LOG_FILE