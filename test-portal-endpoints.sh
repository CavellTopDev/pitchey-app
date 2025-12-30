#!/bin/bash

# Test All Portal Endpoints Comprehensively
# This script tests each portal's dashboard endpoints to identify missing implementations

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test tokens for each portal
CREATOR_TOKEN=""
INVESTOR_TOKEN=""
PRODUCTION_TOKEN=""

# Function to test endpoint
test_endpoint() {
  local method=$1
  local endpoint=$2
  local token=$3
  local description=$4
  
  echo -n "Testing $description: "
  
  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" -X GET \
      -H "Authorization: Bearer $token" \
      "$API_URL$endpoint" 2>/dev/null)
  else
    response=$(curl -s -w "\n%{http_code}" -X $method \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      "$API_URL$endpoint" 2>/dev/null)
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  
  if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ 200 OK${NC}"
    # Check if response has expected structure
    if echo "$body" | grep -q '"success":true'; then
      echo "  Response structure: Valid"
    else
      echo -e "  ${YELLOW}Warning: Response missing success:true${NC}"
    fi
  elif [ "$http_code" = "401" ]; then
    echo -e "${YELLOW}⚠ 401 Unauthorized (needs auth)${NC}"
  elif [ "$http_code" = "404" ]; then
    echo -e "${RED}✗ 404 Not Found - MISSING ENDPOINT${NC}"
  else
    echo -e "${RED}✗ $http_code${NC}"
  fi
  
  # Show response structure for debugging
  if [ "$VERBOSE" = "true" ]; then
    echo "  Response: $(echo "$body" | head -c 200)..."
  fi
}

# Login to get tokens
echo "==================================="
echo "Getting Authentication Tokens"
echo "==================================="

# Creator Login
echo -n "Creator login: "
CREATOR_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}' 2>/dev/null)

if echo "$CREATOR_RESPONSE" | grep -q '"token"'; then
  CREATOR_TOKEN=$(echo "$CREATOR_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  echo -e "${GREEN}✓ Success${NC}"
else
  echo -e "${RED}✗ Failed${NC}"
fi

# Investor Login
echo -n "Investor login: "
INVESTOR_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah.investor@demo.com","password":"Demo123"}' 2>/dev/null)

if echo "$INVESTOR_RESPONSE" | grep -q '"token"'; then
  INVESTOR_TOKEN=$(echo "$INVESTOR_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  echo -e "${GREEN}✓ Success${NC}"
else
  echo -e "${RED}✗ Failed${NC}"
fi

# Production Login
echo -n "Production login: "
PRODUCTION_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/production/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"stellar.production@demo.com","password":"Demo123"}' 2>/dev/null)

if echo "$PRODUCTION_RESPONSE" | grep -q '"token"'; then
  PRODUCTION_TOKEN=$(echo "$PRODUCTION_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  echo -e "${GREEN}✓ Success${NC}"
else
  echo -e "${RED}✗ Failed${NC}"
fi

echo ""
echo "==================================="
echo "CREATOR DASHBOARD ENDPOINTS"
echo "==================================="

test_endpoint "GET" "/api/creator/dashboard" "$CREATOR_TOKEN" "Creator Dashboard Main"
test_endpoint "GET" "/api/creator/dashboard/stats" "$CREATOR_TOKEN" "Creator Stats"
test_endpoint "GET" "/api/creator/pitches" "$CREATOR_TOKEN" "Creator Pitches"
test_endpoint "GET" "/api/creator/analytics" "$CREATOR_TOKEN" "Creator Analytics"
test_endpoint "GET" "/api/creator/funding" "$CREATOR_TOKEN" "Creator Funding"
test_endpoint "GET" "/api/follows/followers?creatorId=1" "$CREATOR_TOKEN" "Creator Followers"
test_endpoint "GET" "/api/analytics/dashboard" "$CREATOR_TOKEN" "Analytics Dashboard"
test_endpoint "GET" "/api/analytics/user" "$CREATOR_TOKEN" "User Analytics"
test_endpoint "GET" "/api/analytics/realtime" "$CREATOR_TOKEN" "Realtime Analytics"
test_endpoint "GET" "/api/payments/credits/balance" "$CREATOR_TOKEN" "Credit Balance"
test_endpoint "GET" "/api/payments/subscription-status" "$CREATOR_TOKEN" "Subscription Status"
test_endpoint "GET" "/api/ndas/stats" "$CREATOR_TOKEN" "NDA Stats"
test_endpoint "GET" "/api/notifications" "$CREATOR_TOKEN" "Notifications"

echo ""
echo "==================================="
echo "INVESTOR DASHBOARD ENDPOINTS"
echo "==================================="

test_endpoint "GET" "/api/investor/portfolio/summary" "$INVESTOR_TOKEN" "Portfolio Summary"
test_endpoint "GET" "/api/investor/investments" "$INVESTOR_TOKEN" "Investments List"
test_endpoint "GET" "/api/investor/saved-pitches" "$INVESTOR_TOKEN" "Saved Pitches"
test_endpoint "GET" "/api/investor/nda-requests" "$INVESTOR_TOKEN" "NDA Requests"
test_endpoint "GET" "/api/investor/notifications" "$INVESTOR_TOKEN" "Investor Notifications"
test_endpoint "GET" "/api/investor/recommendations" "$INVESTOR_TOKEN" "Recommendations"
test_endpoint "GET" "/api/investor/dashboard" "$INVESTOR_TOKEN" "Investor Dashboard"
test_endpoint "GET" "/api/investor/analytics" "$INVESTOR_TOKEN" "Investor Analytics"
test_endpoint "GET" "/api/investor/following" "$INVESTOR_TOKEN" "Following List"
test_endpoint "GET" "/api/investor/watchlist" "$INVESTOR_TOKEN" "Watchlist"
test_endpoint "GET" "/api/investor/activity" "$INVESTOR_TOKEN" "Activity Feed"

echo ""
echo "==================================="
echo "PRODUCTION DASHBOARD ENDPOINTS"
echo "==================================="

test_endpoint "GET" "/api/production/dashboard" "$PRODUCTION_TOKEN" "Production Dashboard"
test_endpoint "GET" "/api/production/projects" "$PRODUCTION_TOKEN" "Production Projects"
test_endpoint "GET" "/api/production/submissions" "$PRODUCTION_TOKEN" "Submissions"
test_endpoint "GET" "/api/production/investments" "$PRODUCTION_TOKEN" "Production Investments"
test_endpoint "GET" "/api/production/analytics" "$PRODUCTION_TOKEN" "Production Analytics"
test_endpoint "GET" "/api/production/pipeline" "$PRODUCTION_TOKEN" "Production Pipeline"
test_endpoint "GET" "/api/production/team" "$PRODUCTION_TOKEN" "Production Team"
test_endpoint "GET" "/api/production/contracts" "$PRODUCTION_TOKEN" "Contracts"
test_endpoint "GET" "/api/production/budget" "$PRODUCTION_TOKEN" "Budget Overview"
test_endpoint "GET" "/api/production/schedule" "$PRODUCTION_TOKEN" "Production Schedule"
test_endpoint "GET" "/api/investment-opportunities" "$PRODUCTION_TOKEN" "Investment Opportunities"
test_endpoint "GET" "/api/analytics/dashboard" "$PRODUCTION_TOKEN" "Analytics Dashboard"

echo ""
echo "==================================="
echo "SHARED ANALYTICS ENDPOINTS"
echo "==================================="

test_endpoint "GET" "/api/analytics/trending" "$CREATOR_TOKEN" "Trending Analytics"
test_endpoint "GET" "/api/analytics/pitch/1" "$CREATOR_TOKEN" "Pitch Analytics"
test_endpoint "GET" "/api/analytics/funnel/1" "$CREATOR_TOKEN" "Funnel Analytics"
test_endpoint "GET" "/api/analytics/engagement?entityType=pitch&entityId=1" "$CREATOR_TOKEN" "Engagement Metrics"
test_endpoint "GET" "/api/analytics/revenue" "$CREATOR_TOKEN" "Revenue Analytics"
test_endpoint "GET" "/api/analytics/compare/dashboard" "$CREATOR_TOKEN" "Comparison Analytics"

echo ""
echo "==================================="
echo "SUMMARY"
echo "==================================="
echo "Check above for:"
echo "- ${RED}404 Not Found${NC} = Missing endpoint implementation"
echo "- ${YELLOW}401 Unauthorized${NC} = Auth working but may need role check"
echo "- ${GREEN}200 OK${NC} = Endpoint exists and responds"
echo ""
echo "Run with VERBOSE=true for response details"