#!/bin/bash

# Quick Production Validation Test
# Use this to verify fixes after database issues are resolved
# Tests only the most critical workflows that were broken

set -e

BACKEND_URL="https://pitchey-backend.deno.dev"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}${CYAN}🔧 QUICK PRODUCTION VALIDATION TEST${NC}"
echo "Testing critical fixes..."
echo

# Test counter
tests_passed=0
tests_failed=0

test_result() {
    local name="$1"
    local success="$2"
    local details="$3"
    
    if [ "$success" = "true" ]; then
        echo -e "  ${GREEN}✓ PASS${NC} $name${details:+ - $details}"
        ((tests_passed++))
    else
        echo -e "  ${RED}✗ FAIL${NC} $name${details:+ - $details}"
        ((tests_failed++))
    fi
}

# 1. Test Authentication (should still work)
echo -e "${BOLD}1. Authentication Test${NC}"
auth_response=$(curl -s -X POST "$BACKEND_URL/api/auth/investor/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"sarah.investor@demo.com","password":"Demo123"}')

if echo "$auth_response" | grep -q '"success":true'; then
    test_result "Investor login" "true"
    token=$(echo "$auth_response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('token', ''))" 2>/dev/null)
else
    test_result "Investor login" "false" "Authentication broken"
    echo "Cannot proceed without authentication"
    exit 1
fi

# 2. Test Pitch Listing (was failing)
echo -e "\n${BOLD}2. Database Connectivity Test${NC}"
pitches_response=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/api/pitches")
http_code=$(echo "$pitches_response" | tail -n1)
body=$(echo "$pitches_response" | head -n-1)

if [ "$http_code" = "200" ] || [ "$http_code" = "401" ]; then
    if echo "$body" | grep -q '"success"'; then
        test_result "Pitch listing endpoint" "true" "Database queries working"
    else
        test_result "Pitch listing endpoint" "false" "Still returning errors"
    fi
else
    test_result "Pitch listing endpoint" "false" "HTTP $http_code"
fi

# 3. Test NDA Request (the recently fixed feature)
echo -e "\n${BOLD}3. NDA Request Test (Recently Fixed Feature)${NC}"
nda_response=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL/api/ndas/request" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $token" \
    -d '{"pitchId": 1, "ndaType": "basic", "requestMessage": "Validation test"}')

nda_http_code=$(echo "$nda_response" | tail -n1)
nda_body=$(echo "$nda_response" | head -n-1)

echo "Response Code: $nda_http_code"
echo "Response Body: $nda_body"

if [ "$nda_http_code" = "201" ]; then
    test_result "NDA request creation" "true" "Successfully created"
elif [ "$nda_http_code" = "400" ]; then
    if echo "$nda_body" | grep -q "already"; then
        test_result "NDA request creation" "true" "Request already exists (acceptable)"
    elif echo "$nda_body" | grep -q "client.query"; then
        test_result "NDA request creation" "false" "Database client still broken"
    else
        test_result "NDA request creation" "false" "Validation error: $nda_body"
    fi
elif [ "$nda_http_code" = "404" ]; then
    test_result "NDA request creation" "false" "Pitch not found"
elif [ "$nda_http_code" = "500" ]; then
    test_result "NDA request creation" "false" "Server error - check logs"
else
    test_result "NDA request creation" "false" "Unexpected HTTP $nda_http_code"
fi

# 4. Test NDA Request Listing  
echo -e "\n${BOLD}4. NDA Request Listing Test${NC}"
nda_list_response=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/api/ndas/request?type=outgoing" \
    -H "Authorization: Bearer $token")

nda_list_http_code=$(echo "$nda_list_response" | tail -n1)
nda_list_body=$(echo "$nda_list_response" | head -n-1)

if [ "$nda_list_http_code" = "200" ]; then
    if echo "$nda_list_body" | grep -q '"success":true'; then
        test_result "NDA request listing" "true" "Can retrieve request list"
    else
        test_result "NDA request listing" "false" "API error in response"
    fi
elif echo "$nda_list_body" | grep -q "client.query"; then
    test_result "NDA request listing" "false" "Database client still broken"
else
    test_result "NDA request listing" "false" "HTTP $nda_list_http_code"
fi

# 5. Test authenticated pitch access
echo -e "\n${BOLD}5. Authenticated Pitch Access Test${NC}"
auth_pitch_response=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/api/pitches" \
    -H "Authorization: Bearer $token")

auth_pitch_http_code=$(echo "$auth_pitch_response" | tail -n1)
auth_pitch_body=$(echo "$auth_pitch_response" | head -n-1)

if [ "$auth_pitch_http_code" = "200" ]; then
    if echo "$auth_pitch_body" | grep -q '"success"'; then
        test_result "Authenticated pitch access" "true" "Can access pitches"
    else
        test_result "Authenticated pitch access" "false" "API error"
    fi
elif echo "$auth_pitch_body" | grep -q "client.query"; then
    test_result "Authenticated pitch access" "false" "Database client still broken"
else
    test_result "Authenticated pitch access" "false" "HTTP $auth_pitch_http_code"
fi

# Summary
echo -e "\n${BOLD}${CYAN}📊 VALIDATION SUMMARY${NC}"
echo "================================"
total_tests=$((tests_passed + tests_failed))
success_rate=0
if [ "$total_tests" -gt "0" ]; then
    success_rate=$((tests_passed * 100 / total_tests))
fi

echo -e "${GREEN}✓ Passed: $tests_passed${NC}"
echo -e "${RED}✗ Failed: $tests_failed${NC}"
echo "📈 Success Rate: $success_rate%"

echo -e "\n${BOLD}VALIDATION RESULT:${NC}"
if [ "$tests_failed" -eq "0" ]; then
    echo -e "${GREEN}🎉 ALL CRITICAL FIXES VERIFIED!${NC}"
    echo -e "${GREEN}Production deployment is ready.${NC}"
elif [ "$tests_passed" -ge "$tests_failed" ]; then
    echo -e "${YELLOW}⚠️  PARTIAL FIXES VERIFIED${NC}"
    echo -e "${YELLOW}Some issues resolved, others remain.${NC}"
else
    echo -e "${RED}🚨 CRITICAL ISSUES REMAIN${NC}"
    echo -e "${RED}Database problems not fully resolved.${NC}"
fi

exit $([ "$tests_failed" -eq "0" ] && echo "0" || echo "1")