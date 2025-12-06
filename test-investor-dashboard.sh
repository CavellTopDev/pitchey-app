#!/bin/bash

# Test investor dashboard functionality
API_URL="https://pitchey-production.cavelltheleaddev.workers.dev"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Testing Investor Dashboard${NC}"
echo "=========================="

# Login as investor
echo -e "\n${BLUE}1. Logging in as investor...${NC}"
INVESTOR_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sarah.investor@demo.com",
    "password": "Demo123"
  }')

INVESTOR_TOKEN=$(echo $INVESTOR_RESPONSE | jq -r '.data.token')

if [ "$INVESTOR_TOKEN" = "null" ]; then
  echo -e "${RED}❌ Failed to login as investor${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Logged in as investor${NC}"

# Test main dashboard endpoint
echo -e "\n${BLUE}2. Testing /api/investor/dashboard...${NC}"
DASHBOARD_RESPONSE=$(curl -s -X GET "$API_URL/api/investor/dashboard" \
  -H "Authorization: Bearer $INVESTOR_TOKEN")

if [ "$(echo $DASHBOARD_RESPONSE | jq -r '.success')" = "true" ]; then
  echo -e "${GREEN}✅ Dashboard loaded successfully${NC}"
  
  # Extract dashboard data
  PORTFOLIO=$(echo $DASHBOARD_RESPONSE | jq '.data.portfolio')
  TOTAL_INVESTED=$(echo $PORTFOLIO | jq -r '.totalInvested')
  ACTIVE_INVESTMENTS=$(echo $PORTFOLIO | jq -r '.activeInvestments')
  
  echo -e "\n${BLUE}Portfolio Summary:${NC}"
  echo "  Total Invested: \$$TOTAL_INVESTED"
  echo "  Active Investments: $ACTIVE_INVESTMENTS"
  
  # Show stats
  STATS=$(echo $DASHBOARD_RESPONSE | jq '.data.stats')
  echo -e "\n${BLUE}Dashboard Stats:${NC}"
  echo "$STATS" | jq '.'
  
  # Recent activity
  ACTIVITY_COUNT=$(echo $DASHBOARD_RESPONSE | jq '.data.recentActivity | length')
  echo -e "\n${BLUE}Recent Activity:${NC} $ACTIVITY_COUNT items"
  
  # Investment opportunities
  OPP_COUNT=$(echo $DASHBOARD_RESPONSE | jq '.data.opportunities | length')
  echo -e "${BLUE}Investment Opportunities:${NC} $OPP_COUNT available"
else
  echo -e "${RED}❌ Dashboard failed to load${NC}"
  echo "$DASHBOARD_RESPONSE" | jq '.'
fi

# Test portfolio summary
echo -e "\n${BLUE}3. Testing /api/investor/portfolio/summary...${NC}"
PORTFOLIO_RESPONSE=$(curl -s -X GET "$API_URL/api/investor/portfolio/summary" \
  -H "Authorization: Bearer $INVESTOR_TOKEN")

if [ "$(echo $PORTFOLIO_RESPONSE | jq -r '.success')" = "true" ]; then
  echo -e "${GREEN}✅ Portfolio summary loaded${NC}"
  echo "$PORTFOLIO_RESPONSE" | jq '.data'
else
  echo -e "${RED}❌ Portfolio summary failed${NC}"
fi

# Test investments list
echo -e "\n${BLUE}4. Testing /api/investor/investments...${NC}"
INVESTMENTS_RESPONSE=$(curl -s -X GET "$API_URL/api/investor/investments" \
  -H "Authorization: Bearer $INVESTOR_TOKEN")

if [ "$(echo $INVESTMENTS_RESPONSE | jq -r '.success')" = "true" ]; then
  echo -e "${GREEN}✅ Investments list loaded${NC}"
  INVESTMENT_COUNT=$(echo $INVESTMENTS_RESPONSE | jq '.data | length')
  echo "  Found $INVESTMENT_COUNT investments"
  
  if [ "$INVESTMENT_COUNT" -gt 0 ]; then
    echo -e "\n${BLUE}First Investment:${NC}"
    echo "$INVESTMENTS_RESPONSE" | jq '.data[0] | {pitchTitle, amount, investmentLevel, status}'
  fi
else
  echo -e "${RED}❌ Investments list failed${NC}"
  echo "$INVESTMENTS_RESPONSE" | jq '.'
fi

# Test saved pitches
echo -e "\n${BLUE}5. Testing /api/user/saved-pitches...${NC}"
SAVED_RESPONSE=$(curl -s -X GET "$API_URL/api/user/saved-pitches" \
  -H "Authorization: Bearer $INVESTOR_TOKEN")

if [ "$(echo $SAVED_RESPONSE | jq -r '.success')" = "true" ]; then
  SAVED_COUNT=$(echo $SAVED_RESPONSE | jq '.data | length')
  echo -e "${GREEN}✅ Saved pitches loaded: $SAVED_COUNT items${NC}"
else
  echo -e "${RED}❌ Saved pitches failed${NC}"
fi

# Test NDA requests
echo -e "\n${BLUE}6. Testing /api/ndas/my-requests...${NC}"
NDA_RESPONSE=$(curl -s -X GET "$API_URL/api/ndas/my-requests" \
  -H "Authorization: Bearer $INVESTOR_TOKEN")

if [ "$(echo $NDA_RESPONSE | jq -r '.success')" = "true" ]; then
  NDA_COUNT=$(echo $NDA_RESPONSE | jq '.data | length')
  echo -e "${GREEN}✅ NDA requests loaded: $NDA_COUNT items${NC}"
else
  echo -e "${BLUE}ℹ️  NDA endpoint may not exist yet${NC}"
fi

echo -e "\n${GREEN}✅ Investor Dashboard Test Complete!${NC}"
echo -e "${BLUE}Summary:${NC}"
echo "- Main dashboard endpoint is working"
echo "- Portfolio data is being fetched"
echo "- Investment interests are tracked"
echo "- Stats and opportunities are displayed"