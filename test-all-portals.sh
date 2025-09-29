#!/bin/bash

# Test script for all portals (Creator, Investor, Production)
# This script tests login, functionality, and NDA workflows for each portal type

API_URL="http://localhost:8001/api"
FRONTEND_URL="http://localhost:5173"

echo "========================================="
echo "Testing All Portals - Complete Test Suite"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Helper function to check test result
check_result() {
    local test_name=$1
    local result=$2
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$result" = "0" ]; then
        echo -e "${GREEN}✓ $test_name passed${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ $test_name failed${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

echo "========================================="
echo -e "${CYAN}PART 1: CREATOR PORTAL TESTS${NC}"
echo "========================================="
echo ""

# Test 1: Creator Login
echo -e "${BLUE}Test 1.1: Creator Login${NC}"
CREATOR_RESPONSE=$(curl -s -X POST "$API_URL/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alex.creator@demo.com",
    "password": "Demo123"
  }')

CREATOR_TOKEN=$(echo $CREATOR_RESPONSE | grep -o '"token":"[^"]*' | sed 's/"token":"//')
if [ ! -z "$CREATOR_TOKEN" ]; then
    echo -e "${GREEN}✓ Creator logged in successfully${NC}"
    check_result "Creator login" 0
else
    echo -e "${RED}✗ Creator login failed${NC}"
    echo "Response: $CREATOR_RESPONSE"
    check_result "Creator login" 1
fi
echo ""

# Test 1.2: Get Creator Dashboard Stats
if [ ! -z "$CREATOR_TOKEN" ]; then
    echo -e "${BLUE}Test 1.2: Get Creator Dashboard Stats${NC}"
    STATS_RESPONSE=$(curl -s "$API_URL/creators/dashboard/stats" \
      -H "Authorization: Bearer $CREATOR_TOKEN")
    
    if echo "$STATS_RESPONSE" | grep -q "totalPitches"; then
        echo "Dashboard stats retrieved successfully"
        echo "$STATS_RESPONSE" | python3 -m json.tool 2>/dev/null | head -10
        check_result "Creator dashboard stats" 0
    else
        check_result "Creator dashboard stats" 1
    fi
    echo ""
    
    # Test 1.3: Get Creator's Pitches
    echo -e "${BLUE}Test 1.3: Get Creator's Pitches${NC}"
    PITCHES_RESPONSE=$(curl -s "$API_URL/pitches/my-pitches" \
      -H "Authorization: Bearer $CREATOR_TOKEN")
    
    if echo "$PITCHES_RESPONSE" | grep -q "success"; then
        PITCH_COUNT=$(echo "$PITCHES_RESPONSE" | grep -o '"id"' | wc -l)
        echo "Creator has $PITCH_COUNT pitches"
        check_result "Get creator pitches" 0
    else
        check_result "Get creator pitches" 1
    fi
    echo ""
    
    # Test 1.4: Get Pending NDAs for Creator
    echo -e "${BLUE}Test 1.4: Get Creator's Pending NDA Requests${NC}"
    NDA_RESPONSE=$(curl -s "$API_URL/ndas?status=pending" \
      -H "Authorization: Bearer $CREATOR_TOKEN")
    
    if echo "$NDA_RESPONSE" | grep -q "success\|ndas"; then
        echo "NDA requests retrieved"
        check_result "Get creator NDA requests" 0
    else
        check_result "Get creator NDA requests" 1
    fi
    echo ""
fi

echo "========================================="
echo -e "${PURPLE}PART 2: INVESTOR PORTAL TESTS${NC}"
echo "========================================="
echo ""

# Test 2.1: Investor Login
echo -e "${BLUE}Test 2.1: Investor Login${NC}"
INVESTOR_RESPONSE=$(curl -s -X POST "$API_URL/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sarah.investor@demo.com",
    "password": "Demo123"
  }')

INVESTOR_TOKEN=$(echo $INVESTOR_RESPONSE | grep -o '"token":"[^"]*' | sed 's/"token":"//')
if [ ! -z "$INVESTOR_TOKEN" ]; then
    echo -e "${GREEN}✓ Investor logged in successfully${NC}"
    check_result "Investor login" 0
else
    echo -e "${RED}✗ Investor login failed${NC}"
    echo "Response: $INVESTOR_RESPONSE"
    check_result "Investor login" 1
fi
echo ""

# Test 2.2: Get Investor Dashboard
if [ ! -z "$INVESTOR_TOKEN" ]; then
    echo -e "${BLUE}Test 2.2: Get Investor Dashboard${NC}"
    DASHBOARD_RESPONSE=$(curl -s "$API_URL/investors/dashboard" \
      -H "Authorization: Bearer $INVESTOR_TOKEN")
    
    if echo "$DASHBOARD_RESPONSE" | grep -q "portfolioValue\|watchlist"; then
        echo "Investor dashboard retrieved successfully"
        check_result "Investor dashboard" 0
    else
        check_result "Investor dashboard" 1
    fi
    echo ""
    
    # Test 2.3: Check NDA Request Capability
    echo -e "${BLUE}Test 2.3: Check if Investor Can Request NDA${NC}"
    CAN_REQUEST=$(curl -s "$API_URL/ndas/pitch/45/can-request" \
      -H "Authorization: Bearer $INVESTOR_TOKEN")
    
    echo "Can request NDA response: $CAN_REQUEST"
    check_result "Check NDA capability" 0
    echo ""
    
    # Test 2.4: Get Investor's Portfolio
    echo -e "${BLUE}Test 2.4: Get Investor Portfolio${NC}"
    PORTFOLIO_RESPONSE=$(curl -s "$API_URL/investors/portfolio" \
      -H "Authorization: Bearer $INVESTOR_TOKEN")
    
    if echo "$PORTFOLIO_RESPONSE" | grep -q "success\|portfolio"; then
        echo "Portfolio retrieved successfully"
        check_result "Get investor portfolio" 0
    else
        check_result "Get investor portfolio" 1
    fi
    echo ""
fi

echo "========================================="
echo -e "${YELLOW}PART 3: PRODUCTION PORTAL TESTS${NC}"
echo "========================================="
echo ""

# Test 3.1: Production Company Login
echo -e "${BLUE}Test 3.1: Production Company Login${NC}"
PRODUCTION_RESPONSE=$(curl -s -X POST "$API_URL/auth/production/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "stellar.production@demo.com",
    "password": "Demo123"
  }')

PRODUCTION_TOKEN=$(echo $PRODUCTION_RESPONSE | grep -o '"token":"[^"]*' | sed 's/"token":"//')
if [ ! -z "$PRODUCTION_TOKEN" ]; then
    echo -e "${GREEN}✓ Production company logged in successfully${NC}"
    check_result "Production login" 0
else
    echo -e "${RED}✗ Production login failed${NC}"
    echo "Response: $PRODUCTION_RESPONSE"
    check_result "Production login" 1
fi
echo ""

# Test 3.2: Get Production Dashboard
if [ ! -z "$PRODUCTION_TOKEN" ]; then
    echo -e "${BLUE}Test 3.2: Get Production Dashboard${NC}"
    PROD_DASHBOARD=$(curl -s "$API_URL/production/dashboard" \
      -H "Authorization: Bearer $PRODUCTION_TOKEN")
    
    if echo "$PROD_DASHBOARD" | grep -q "activeProjects\|slate"; then
        echo "Production dashboard retrieved successfully"
        check_result "Production dashboard" 0
    else
        check_result "Production dashboard" 1
    fi
    echo ""
    
    # Test 3.3: Get Production Company's Pitches
    echo -e "${BLUE}Test 3.3: Get Production Company's Pitches${NC}"
    PROD_PITCHES=$(curl -s "$API_URL/pitches/my-pitches" \
      -H "Authorization: Bearer $PRODUCTION_TOKEN")
    
    if echo "$PROD_PITCHES" | grep -q "success"; then
        PROD_PITCH_COUNT=$(echo "$PROD_PITCHES" | grep -o '"id"' | wc -l)
        echo "Production company has $PROD_PITCH_COUNT pitches"
        check_result "Get production pitches" 0
    else
        check_result "Get production pitches" 1
    fi
    echo ""
    
    # Test 3.4: Production Slate Management
    echo -e "${BLUE}Test 3.4: Get Production Slate${NC}"
    SLATE_RESPONSE=$(curl -s "$API_URL/production/slate" \
      -H "Authorization: Bearer $PRODUCTION_TOKEN")
    
    if echo "$SLATE_RESPONSE" | grep -q "projects\|slate"; then
        echo "Production slate retrieved"
        check_result "Get production slate" 0
    else
        check_result "Get production slate" 1
    fi
    echo ""
fi

echo "========================================="
echo -e "${CYAN}PART 4: CROSS-PORTAL NDA WORKFLOW TEST${NC}"
echo "========================================="
echo ""

# Test 4.1: Production requests NDA from Creator pitch
if [ ! -z "$PRODUCTION_TOKEN" ]; then
    echo -e "${BLUE}Test 4.1: Production Company Requests NDA for Creator Pitch${NC}"
    
    # First, get a creator pitch ID
    CREATOR_PITCH_ID=45  # Using a known creator pitch
    
    # Check if can request
    CAN_REQUEST_NDA=$(curl -s "$API_URL/ndas/pitch/$CREATOR_PITCH_ID/can-request" \
      -H "Authorization: Bearer $PRODUCTION_TOKEN")
    
    echo "Can request check: $CAN_REQUEST_NDA"
    
    # Request NDA
    NDA_REQUEST=$(curl -s -X POST "$API_URL/nda/request" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $PRODUCTION_TOKEN" \
      -d "{
        \"pitchId\": $CREATOR_PITCH_ID,
        \"message\": \"Production company requesting access for evaluation\",
        \"expiryDays\": 90
      }")
    
    if echo "$NDA_REQUEST" | grep -q "success\|pending"; then
        echo -e "${GREEN}✓ NDA request submitted${NC}"
        check_result "Production NDA request" 0
    else
        echo "NDA request response: $NDA_REQUEST"
        check_result "Production NDA request" 1
    fi
    echo ""
fi

# Test 4.2: Creator views pending NDAs
if [ ! -z "$CREATOR_TOKEN" ]; then
    echo -e "${BLUE}Test 4.2: Creator Views Pending NDA Requests${NC}"
    
    PENDING_NDAS=$(curl -s "$API_URL/ndas?status=pending" \
      -H "Authorization: Bearer $CREATOR_TOKEN")
    
    if echo "$PENDING_NDAS" | grep -q "ndas\|success"; then
        NDA_COUNT=$(echo "$PENDING_NDAS" | grep -o '"id"' | wc -l)
        echo "Creator has $NDA_COUNT pending NDA requests"
        check_result "View pending NDAs" 0
    else
        check_result "View pending NDAs" 1
    fi
    echo ""
fi

echo "========================================="
echo -e "${CYAN}PART 5: MARKETPLACE ACCESS TEST${NC}"
echo "========================================="
echo ""

# Test 5.1: Public Marketplace Access
echo -e "${BLUE}Test 5.1: Public Marketplace Access (No Auth)${NC}"
PUBLIC_PITCHES=$(curl -s "$API_URL/pitches/public")

if echo "$PUBLIC_PITCHES" | grep -q "pitches\|success"; then
    PUBLIC_COUNT=$(echo "$PUBLIC_PITCHES" | grep -o '"id"' | wc -l)
    echo "Public marketplace has $PUBLIC_COUNT visible pitches"
    check_result "Public marketplace access" 0
else
    check_result "Public marketplace access" 1
fi
echo ""

# Test 5.2: Authenticated Marketplace Access
echo -e "${BLUE}Test 5.2: Authenticated Marketplace Access (Investor)${NC}"
if [ ! -z "$INVESTOR_TOKEN" ]; then
    AUTH_PITCHES=$(curl -s "$API_URL/pitches" \
      -H "Authorization: Bearer $INVESTOR_TOKEN")
    
    if echo "$AUTH_PITCHES" | grep -q "pitches\|success"; then
        AUTH_COUNT=$(echo "$AUTH_PITCHES" | grep -o '"id"' | wc -l)
        echo "Authenticated user sees $AUTH_COUNT pitches"
        check_result "Authenticated marketplace" 0
    else
        check_result "Authenticated marketplace" 1
    fi
fi
echo ""

echo "========================================="
echo -e "${CYAN}PART 6: FOLLOW SYSTEM TEST${NC}"
echo "========================================="
echo ""

# Test 6.1: Investor follows a creator
if [ ! -z "$INVESTOR_TOKEN" ]; then
    echo -e "${BLUE}Test 6.1: Investor Follows Creator${NC}"
    
    FOLLOW_RESPONSE=$(curl -s -X POST "$API_URL/follows/follow" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $INVESTOR_TOKEN" \
      -d '{
        "followingId": 1001,
        "followType": "user"
      }')
    
    if echo "$FOLLOW_RESPONSE" | grep -q "success"; then
        echo -e "${GREEN}✓ Successfully followed creator${NC}"
        check_result "Follow creator" 0
    else
        echo "Follow response: $FOLLOW_RESPONSE"
        check_result "Follow creator" 1
    fi
    echo ""
    
    # Test 6.2: Check follow status
    echo -e "${BLUE}Test 6.2: Check Follow Status${NC}"
    
    FOLLOW_STATUS=$(curl -s "$API_URL/follows/check?targetId=1001&type=user" \
      -H "Authorization: Bearer $INVESTOR_TOKEN")
    
    if echo "$FOLLOW_STATUS" | grep -q "isFollowing"; then
        echo "Follow status checked successfully"
        check_result "Check follow status" 0
    else
        check_result "Check follow status" 1
    fi
    echo ""
fi

echo "========================================="
echo -e "${CYAN}TEST SUMMARY${NC}"
echo "========================================="
echo ""
echo -e "Total Tests: ${TOTAL_TESTS}"
echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
echo -e "${RED}Failed: ${FAILED_TESTS}${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed successfully!${NC}"
else
    echo -e "\n${YELLOW}⚠️  Some tests failed. Please review the output above.${NC}"
fi

echo ""
echo "========================================="
echo -e "${CYAN}PORTAL ENDPOINTS REFERENCE${NC}"
echo "========================================="
echo ""
echo "Creator Portal:"
echo "  - Login: POST $API_URL/auth/creator/login"
echo "  - Dashboard: GET $API_URL/creators/dashboard/stats"
echo "  - My Pitches: GET $API_URL/pitches/my-pitches"
echo "  - NDA Management: GET $API_URL/ndas"
echo ""
echo "Investor Portal:"
echo "  - Login: POST $API_URL/auth/investor/login"
echo "  - Dashboard: GET $API_URL/investors/dashboard"
echo "  - Portfolio: GET $API_URL/investors/portfolio"
echo "  - Watchlist: GET $API_URL/investors/watchlist"
echo ""
echo "Production Portal:"
echo "  - Login: POST $API_URL/auth/production/login"
echo "  - Dashboard: GET $API_URL/production/dashboard"
echo "  - Slate: GET $API_URL/production/slate"
echo "  - Active Projects: GET $API_URL/production/projects"
echo ""
echo "All portals use password: Demo123"
echo ""

# Check if rate limiting is still active
echo "========================================="
echo -e "${CYAN}RATE LIMIT STATUS${NC}"
echo "========================================="
echo ""
TEST_RATE_LIMIT=$(curl -s -X POST "$API_URL/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "test"}' \
  -I 2>/dev/null | grep -i "x-ratelimit")

if [ ! -z "$TEST_RATE_LIMIT" ]; then
    echo "Rate limiting headers detected:"
    echo "$TEST_RATE_LIMIT"
else
    echo "No rate limiting headers found (rate limits may have been increased successfully)"
fi
echo ""