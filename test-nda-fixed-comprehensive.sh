#!/bin/bash

# Comprehensive NDA test script with proper error handling
# Tests all NDA functionality step by step

API_URL="http://localhost:8001/api"

echo "========================================="
echo "🔧 COMPREHENSIVE NDA TEST SUITE"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Test counter
TOTAL_TESTS=0
PASSED_TESTS=0

# Helper function for test results
test_result() {
    local test_name="$1"
    local condition="$2"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$condition" = "true" ]; then
        echo -e "${GREEN}✓ PASS:${NC} $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAIL:${NC} $test_name"
    fi
}

echo "========================================="
echo -e "${BLUE}TEST 1: NDA Status Endpoint (Unauthenticated)${NC}"
echo "========================================="

# Test 1: Check NDA status without authentication
echo "Testing NDA status endpoint without authentication..."
STATUS_RESPONSE=$(curl -s "$API_URL/ndas/pitch/46/status")
echo "Response: $STATUS_RESPONSE"

# Parse response
if echo "$STATUS_RESPONSE" | grep -q '"success":true'; then
    test_result "NDA status endpoint returns success for unauthenticated user" "true"
    
    if echo "$STATUS_RESPONSE" | grep -q '"requiresAuth":true'; then
        test_result "Response indicates authentication required" "true"
    else
        test_result "Response indicates authentication required" "false"
    fi
    
    if echo "$STATUS_RESPONSE" | grep -q '"title"'; then
        test_result "Response includes pitch title" "true"
    else
        test_result "Response includes pitch title" "false"
    fi
else
    test_result "NDA status endpoint returns success for unauthenticated user" "false"
fi

echo ""

echo "========================================="
echo -e "${BLUE}TEST 2: Public Pitch Access${NC}"
echo "========================================="

# Test 2: Get public pitches
echo "Testing public pitches endpoint..."
PUBLIC_RESPONSE=$(curl -s "$API_URL/pitches/public")
echo "Response sample: $(echo "$PUBLIC_RESPONSE" | head -c 200)..."

if echo "$PUBLIC_RESPONSE" | grep -q '"success":true'; then
    test_result "Public pitches endpoint works" "true"
    
    # Count pitches
    PITCH_COUNT=$(echo "$PUBLIC_RESPONSE" | grep -o '"id"' | wc -l)
    if [ "$PITCH_COUNT" -gt 0 ]; then
        test_result "Public pitches contain data ($PITCH_COUNT pitches found)" "true"
    else
        test_result "Public pitches contain data" "false"
    fi
else
    test_result "Public pitches endpoint works" "false"
fi

echo ""

echo "========================================="
echo -e "${BLUE}TEST 3: NDA Endpoints Structure${NC}"
echo "========================================="

# Test 3: Check various NDA endpoints without auth (should fail gracefully)
echo "Testing NDA endpoints structure..."

# Test can-request endpoint
CAN_REQUEST_RESPONSE=$(curl -s "$API_URL/ndas/pitch/46/can-request")
if echo "$CAN_REQUEST_RESPONSE" | grep -q '"success":false'; then
    test_result "NDA can-request endpoint requires authentication" "true"
else
    test_result "NDA can-request endpoint requires authentication" "false"
fi

# Test NDA request endpoint
REQUEST_RESPONSE=$(curl -s -X POST "$API_URL/nda/request" -H "Content-Type: application/json" -d '{"pitchId": 46}')
if echo "$REQUEST_RESPONSE" | grep -q '"success":false.*Authentication required'; then
    test_result "NDA request endpoint requires authentication" "true"
else
    test_result "NDA request endpoint requires authentication" "false"
fi

echo ""

echo "========================================="
echo -e "${BLUE}TEST 4: Response Format Validation${NC}"
echo "========================================="

# Test 4: Validate response formats
echo "Validating response formats..."

# Check if NDA status response has proper JSON structure
if echo "$STATUS_RESPONSE" | python3 -m json.tool > /dev/null 2>&1; then
    test_result "NDA status response is valid JSON" "true"
else
    test_result "NDA status response is valid JSON" "false"
fi

# Check required fields in status response
if echo "$STATUS_RESPONSE" | grep -q '"hasNDA".*"canAccess".*"pitch"'; then
    test_result "NDA status response has required fields" "true"
else
    test_result "NDA status response has required fields" "false"
fi

echo ""

echo "========================================="
echo -e "${BLUE}TEST 5: Error Handling${NC}"
echo "========================================="

# Test 5: Error handling
echo "Testing error handling..."

# Test with invalid pitch ID
INVALID_RESPONSE=$(curl -s "$API_URL/ndas/pitch/99999/status")
if echo "$INVALID_RESPONSE" | grep -q '"success":false'; then
    test_result "Invalid pitch ID returns error" "true"
else
    test_result "Invalid pitch ID returns error" "false"
fi

# Test with non-numeric pitch ID
NONNUMERIC_RESPONSE=$(curl -s "$API_URL/ndas/pitch/abc/status")
if echo "$NONNUMERIC_RESPONSE" | grep -q '"success":false'; then
    test_result "Non-numeric pitch ID returns error" "true"
else
    test_result "Non-numeric pitch ID returns error" "false"
fi

echo ""

echo "========================================="
echo -e "${BLUE}TEST 6: CORS and Headers${NC}"
echo "========================================="

# Test 6: CORS headers
echo "Testing CORS headers..."
CORS_RESPONSE=$(curl -s -I "$API_URL/ndas/pitch/46/status")

if echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Origin"; then
    test_result "CORS headers present" "true"
else
    test_result "CORS headers present" "false"
fi

echo ""

echo "========================================="
echo -e "${PURPLE}TEST SUMMARY${NC}"
echo "========================================="
echo ""
echo -e "Total Tests: ${BLUE}$TOTAL_TESTS${NC}"
echo -e "Passed Tests: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed Tests: ${RED}$((TOTAL_TESTS - PASSED_TESTS))${NC}"

if [ "$PASSED_TESTS" -eq "$TOTAL_TESTS" ]; then
    echo -e "\n${GREEN}🎉 ALL TESTS PASSED!${NC}"
    echo -e "NDA endpoints are working correctly."
else
    echo -e "\n${YELLOW}⚠️  SOME TESTS FAILED${NC}"
    echo -e "NDA endpoints need fixes."
fi

echo ""
echo "========================================="
echo -e "${BLUE}NEXT STEPS FOR AUTHENTICATED TESTING${NC}"
echo "========================================="
echo ""
echo "Once rate limits reset, test with authentication:"
echo "1. Login as investor: POST $API_URL/auth/investor/login"
echo "2. Test NDA request: POST $API_URL/nda/request"
echo "3. Login as creator: POST $API_URL/auth/creator/login"
echo "4. Test NDA approval/rejection"
echo ""
echo "Rate limits reset in 15 minutes from last failed login attempt."
echo ""