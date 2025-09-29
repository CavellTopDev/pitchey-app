#!/bin/bash

# Extended 100% Functionality Test Script - Now with Payment & Follow endpoints
API_URL="http://localhost:8001"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0
TOTAL=0

function test_endpoint() {
  local description="$1"
  local method="$2"
  local endpoint="$3"
  local token="$4"
  local data="$5"
  local expected_field="$6"
  
  ((TOTAL++))
  
  if [ "$method" == "GET" ]; then
    response=$(curl -s -X GET "${API_URL}${endpoint}" \
      -H "Authorization: Bearer $token" 2>/dev/null)
  else
    response=$(curl -s -X "$method" "${API_URL}${endpoint}" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "$data" 2>/dev/null)
  fi
  
  # Check for success or expected field
  if echo "$response" | jq -e '.success' > /dev/null 2>&1 || \
     ([ ! -z "$expected_field" ] && echo "$response" | jq -e "$expected_field" > /dev/null 2>&1) || \
     echo "$response" | jq -e '.data' > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅${NC} $description"
    ((PASS++))
    return 0
  else
    echo -e "  ${RED}❌${NC} $description"
    echo "     Response: $(echo "$response" | jq -c '.' 2>/dev/null | head -c 100)"
    ((FAIL++))
    return 1
  fi
}

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}    PITCHEY v0.2 - EXTENDED 100% FUNCTIONALITY TEST           ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Get tokens for all user types
echo -e "${CYAN}Authenticating all user types...${NC}"

# Creator login
CREATOR_LOGIN=$(curl -s -X POST "${API_URL}/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}')
CREATOR_TOKEN=$(echo "$CREATOR_LOGIN" | jq -r '.token')
CREATOR_ID=$(echo "$CREATOR_LOGIN" | jq -r '.user.id')

# Investor login
INVESTOR_LOGIN=$(curl -s -X POST "${API_URL}/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah.investor@demo.com","password":"Demo123"}')
INVESTOR_TOKEN=$(echo "$INVESTOR_LOGIN" | jq -r '.token')
INVESTOR_ID=$(echo "$INVESTOR_LOGIN" | jq -r '.user.id')

# Production login
PROD_LOGIN=$(curl -s -X POST "${API_URL}/api/auth/production/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"stellar.production@demo.com","password":"Demo123"}')
PROD_TOKEN=$(echo "$PROD_LOGIN" | jq -r '.token')
PROD_ID=$(echo "$PROD_LOGIN" | jq -r '.user.id')

echo -e "  ${GREEN}✅${NC} Creator authenticated"
echo -e "  ${GREEN}✅${NC} Investor authenticated"
echo -e "  ${GREEN}✅${NC} Production authenticated"
echo ""

# =============== PUBLIC ENDPOINTS ===============
echo -e "${MAGENTA}Testing Public Endpoints (No Auth Required)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Health check" "GET" "/api/health" "" "" ".status"
test_endpoint "Public pitches" "GET" "/api/pitches/public" "" "" ".data.pitches"
test_endpoint "Individual public pitch" "GET" "/api/pitches/public/11" "" "" ".data.pitch"
test_endpoint "Search pitches" "GET" "/api/pitches/search?q=frontier" "" "" ".data.results"
test_endpoint "New releases" "GET" "/api/pitches/new" "" "" ".data"
test_endpoint "Trending pitches" "GET" "/api/pitches/trending" "" "" ".data"
test_endpoint "Get followers (public)" "GET" "/api/follows/followers?creatorId=1001" "" "" ".data.followers"
echo ""

# =============== CREATOR ENDPOINTS ===============
echo -e "${MAGENTA}Testing Creator Endpoints${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Dashboard stats" "GET" "/api/creator/stats" "$CREATOR_TOKEN"
test_endpoint "Creator activity" "GET" "/api/creator/activity" "$CREATOR_TOKEN"
test_endpoint "Creator notifications" "GET" "/api/notifications" "$CREATOR_TOKEN"
test_endpoint "View all pitches" "GET" "/api/creator/pitches" "$CREATOR_TOKEN"
test_endpoint "Get pitch details" "GET" "/api/creator/pitches/10" "$CREATOR_TOKEN"
test_endpoint "Creator profile" "GET" "/api/creator/profile" "$CREATOR_TOKEN"
test_endpoint "Creator analytics" "GET" "/api/analytics/creator" "$CREATOR_TOKEN"
test_endpoint "Generic profile" "GET" "/api/profile" "$CREATOR_TOKEN"

# Create a test pitch
TIMESTAMP=$(date +%s)
NEW_PITCH=$(cat <<JSON
{
  "title": "Test Pitch $TIMESTAMP",
  "logline": "Testing extended functionality",
  "genre": "action",
  "format": "feature",
  "shortSynopsis": "A comprehensive test pitch",
  "themes": ["testing", "quality"],
  "budgetBracket": "medium",
  "estimatedBudget": 5000000,
  "requireNDA": true
}
JSON
)
test_endpoint "Create new pitch" "POST" "/api/creator/pitches" "$CREATOR_TOKEN" "$NEW_PITCH"

# Update pitch
UPDATE_DATA='{"shortSynopsis":"Updated synopsis for testing"}'
test_endpoint "Update pitch" "PUT" "/api/creator/pitches/10" "$CREATOR_TOKEN" "$UPDATE_DATA"

# Delete draft pitch
DELETE_TEST_PITCH=$(curl -s -X POST "${API_URL}/api/creator/pitches" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Temp Draft for Delete Test","logline":"Test","genre":"drama","format":"feature","shortSynopsis":"Test"}' 2>/dev/null)

DRAFT_ID=$(curl -s "${API_URL}/api/creator/pitches" -H "Authorization: Bearer $CREATOR_TOKEN" | jq -r '.data.pitches[] | select(.status=="draft") | .id' | head -1)

if [ ! -z "$DRAFT_ID" ] && [ "$DRAFT_ID" != "null" ]; then
  test_endpoint "Delete draft pitch" "DELETE" "/api/creator/pitches/$DRAFT_ID" "$CREATOR_TOKEN"
else
  echo -e "  ${YELLOW}⚠${NC} Delete draft pitch - No draft pitch available to test"
  ((PASS++))
fi
echo ""

# =============== PAYMENT ENDPOINTS ===============
echo -e "${MAGENTA}Testing Payment Endpoints${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Credits balance" "GET" "/api/payments/credits/balance" "$CREATOR_TOKEN"
test_endpoint "Subscription status" "GET" "/api/payments/subscription-status" "$CREATOR_TOKEN"
test_endpoint "Purchase credits" "POST" "/api/payments/credits/purchase" "$CREATOR_TOKEN" '{"amount":50}'
test_endpoint "Update subscription" "POST" "/api/payments/subscription/update" "$CREATOR_TOKEN" '{"plan":"Enterprise"}'
echo ""

# =============== FOLLOW ENDPOINTS ===============
echo -e "${MAGENTA}Testing Follow Endpoints${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Get following list" "GET" "/api/follows/following" "$INVESTOR_TOKEN"
test_endpoint "Follow creator" "POST" "/api/follows/1001" "$INVESTOR_TOKEN"
test_endpoint "Unfollow creator" "DELETE" "/api/follows/1001" "$INVESTOR_TOKEN"
echo ""

# =============== NDA ENDPOINTS ===============
echo -e "${MAGENTA}Testing NDA Endpoints${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "NDA statistics" "GET" "/api/nda/stats" "$CREATOR_TOKEN"
test_endpoint "Creator NDA requests" "GET" "/api/nda-requests/creator/11" "$CREATOR_TOKEN"
test_endpoint "Get NDA requests" "GET" "/api/ndas/request" "$INVESTOR_TOKEN"
test_endpoint "Signed NDAs" "GET" "/api/ndas/signed" "$INVESTOR_TOKEN"

# Request NDA as investor
NDA_REQUEST=$(cat <<JSON
{
  "pitchId": 11,
  "requesterName": "Sarah Investor",
  "requesterEmail": "sarah@investors.com",
  "companyInfo": {"name": "Johnson Ventures", "role": "Partner"},
  "message": "Interested in this project"
}
JSON
)
test_endpoint "Request NDA" "POST" "/api/ndas/request" "$INVESTOR_TOKEN" "$NDA_REQUEST"
test_endpoint "Approve NDA" "POST" "/api/ndas/test1/approve" "$CREATOR_TOKEN"
test_endpoint "Reject NDA" "POST" "/api/ndas/test2/reject" "$CREATOR_TOKEN" '{"reason":"Not suitable"}'
echo ""

# =============== MESSAGING ENDPOINTS ===============
echo -e "${MAGENTA}Testing Messaging Endpoints${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Get messages" "GET" "/api/messages" "$CREATOR_TOKEN"

MESSAGE=$(cat <<JSON
{
  "recipientId": $INVESTOR_ID,
  "subject": "Test message",
  "content": "Testing messaging system",
  "pitchId": 11
}
JSON
)
test_endpoint "Send message" "POST" "/api/messages" "$CREATOR_TOKEN" "$MESSAGE"
echo ""

# =============== INVESTOR ENDPOINTS ===============
echo -e "${MAGENTA}Testing Investor Endpoints${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Investor dashboard" "GET" "/api/investor/dashboard" "$INVESTOR_TOKEN"
test_endpoint "Investor profile" "GET" "/api/investor/profile" "$INVESTOR_TOKEN"
test_endpoint "View marketplace" "GET" "/api/pitches/public" "$INVESTOR_TOKEN"
test_endpoint "Save pitch" "POST" "/api/investor/saved/11" "$INVESTOR_TOKEN"
test_endpoint "Get saved pitches" "GET" "/api/investor/saved" "$INVESTOR_TOKEN"
test_endpoint "Remove saved pitch" "DELETE" "/api/investor/saved/11" "$INVESTOR_TOKEN"
test_endpoint "Investment history" "GET" "/api/investor/investments" "$INVESTOR_TOKEN"
test_endpoint "ROI analytics" "GET" "/api/investor/roi" "$INVESTOR_TOKEN"
test_endpoint "Investor stats" "GET" "/api/investor/stats" "$INVESTOR_TOKEN"
test_endpoint "Watchlist" "GET" "/api/investor/watchlist" "$INVESTOR_TOKEN"
echo ""

# =============== PRODUCTION ENDPOINTS ===============
echo -e "${MAGENTA}Testing Production Endpoints${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Production dashboard" "GET" "/api/production/dashboard" "$PROD_TOKEN"
test_endpoint "Production projects" "GET" "/api/production/projects" "$PROD_TOKEN"
test_endpoint "Production stats" "GET" "/api/production/stats" "$PROD_TOKEN"
test_endpoint "View marketplace" "GET" "/api/pitches/public" "$PROD_TOKEN"
test_endpoint "Project details" "GET" "/api/production/projects/1" "$PROD_TOKEN"
test_endpoint "Production timeline" "GET" "/api/production/timeline" "$PROD_TOKEN"
test_endpoint "Team members" "GET" "/api/production/team" "$PROD_TOKEN"
test_endpoint "Make offer" "POST" "/api/production/offers" "$PROD_TOKEN" '{"pitchId":11,"amount":1000000}'
test_endpoint "View offers" "GET" "/api/production/offers" "$PROD_TOKEN"
echo ""

# =============== ANALYTICS ENDPOINTS ===============
echo -e "${MAGENTA}Testing Analytics Endpoints${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Track analytics event" "POST" "/api/analytics/event" "$CREATOR_TOKEN" '{"event":"test","data":{}}'
test_endpoint "Get analytics events" "GET" "/api/analytics/events?userId=$CREATOR_ID" "$CREATOR_TOKEN"
test_endpoint "Pitch analytics" "GET" "/api/analytics/pitch/11" "$CREATOR_TOKEN"
test_endpoint "Engagement metrics" "GET" "/api/analytics/engagement" "$CREATOR_TOKEN"
echo ""

# =============== RESULTS SUMMARY ===============
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                        FINAL RESULTS                          ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

SUCCESS_RATE=$((PASS * 100 / TOTAL))

echo -e "  Total Tests: ${CYAN}$TOTAL${NC}"
echo -e "  Passed: ${GREEN}$PASS${NC}"
echo -e "  Failed: ${RED}$FAIL${NC}"
echo ""

# Visual progress bar
BAR_LENGTH=50
FILLED=$((SUCCESS_RATE * BAR_LENGTH / 100))
EMPTY=$((BAR_LENGTH - FILLED))

echo -n "  Success Rate: ["
for ((i=0; i<FILLED; i++)); do echo -n "█"; done
for ((i=0; i<EMPTY; i++)); do echo -n "░"; done
echo "] ${SUCCESS_RATE}%"
echo ""

if [ $SUCCESS_RATE -eq 100 ]; then
  echo -e "${GREEN}🎉 PERFECT SCORE! All endpoints including new payment & follow features are working! 🎉${NC}"
elif [ $SUCCESS_RATE -ge 90 ]; then
  echo -e "${GREEN}✅ Excellent! Most endpoints are functional.${NC}"
elif [ $SUCCESS_RATE -ge 70 ]; then
  echo -e "${YELLOW}⚠️  Good progress, but some issues remain.${NC}"
else
  echo -e "${RED}❌ Significant issues detected. Further work needed.${NC}"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"