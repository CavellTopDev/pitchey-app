#!/bin/bash

# Test Production Investor Portal
API_URL="https://pitchey-backend-fresh.deno.dev"

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}============================================="
echo "TESTING PRODUCTION INVESTOR PORTAL"
echo "=============================================${NC}"
echo ""

# 1. Test Login
echo -e "${BLUE}1. Testing Investor Login...${NC}"
LOGIN_RESP=$(curl -s -X POST "$API_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah.investor@demo.com","password":"Demo123"}')

TOKEN=$(echo "$LOGIN_RESP" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
USER_ID=$(echo "$LOGIN_RESP" | grep -o '"id":[0-9]*' | grep -o '[0-9]*' | head -1)

if [ -n "$TOKEN" ]; then
  echo -e "${GREEN}✅ Login successful${NC}"
  echo "   User ID: $USER_ID"
  if [ "$USER_ID" = "2" ]; then
    echo -e "   ${GREEN}✅ Correct user ID (2)${NC}"
  else
    echo -e "   ${RED}❌ Wrong user ID (expected 2, got $USER_ID)${NC}"
  fi
else
  echo -e "${RED}❌ Login failed${NC}"
  echo "Response: $LOGIN_RESP"
  exit 1
fi

echo ""

# 2. Test Dashboard
echo -e "${BLUE}2. Testing Dashboard Endpoint...${NC}"
DASHBOARD=$(curl -s "$API_URL/api/investor/dashboard" \
  -H "Authorization: Bearer $TOKEN")

# Check structure - should have data.portfolio
if echo "$DASHBOARD" | jq -e '.data.portfolio' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Dashboard structure correct${NC}"
  
  # Get values
  TOTAL_INVESTED=$(echo "$DASHBOARD" | jq -r '.data.portfolio.totalInvested // 0')
  ACTIVE_INVESTMENTS=$(echo "$DASHBOARD" | jq -r '.data.portfolio.activeInvestments // 0')
  
  echo "   Total Invested: \$$TOTAL_INVESTED"
  echo "   Active Investments: $ACTIVE_INVESTMENTS"
  
  if [ "$TOTAL_INVESTED" = "100000" ]; then
    echo -e "   ${GREEN}✅ Shows correct investment amount${NC}"
  else
    echo -e "   ${YELLOW}⚠️ Investment amount: $TOTAL_INVESTED (expected 100000)${NC}"
  fi
else
  echo -e "${RED}❌ Dashboard structure issue${NC}"
  echo "Response: $DASHBOARD" | jq . 2>/dev/null || echo "$DASHBOARD"
fi

echo ""

# 3. Test Analytics
echo -e "${BLUE}3. Testing Analytics Endpoint...${NC}"
ANALYTICS=$(curl -s "$API_URL/api/investor/analytics" \
  -H "Authorization: Bearer $TOKEN")

if echo "$ANALYTICS" | jq -e '.data.portfolioValue' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Analytics endpoint working${NC}"
  
  PORTFOLIO_VALUE=$(echo "$ANALYTICS" | jq -r '.data.portfolioValue')
  GROWTH_RATE=$(echo "$ANALYTICS" | jq -r '.data.portfolioGrowth')
  
  echo "   Portfolio Value: \$$PORTFOLIO_VALUE"
  echo "   Growth Rate: ${GROWTH_RATE}%"
else
  echo -e "${RED}❌ Analytics endpoint issue${NC}"
  echo "Response: $ANALYTICS" | jq . 2>/dev/null || echo "$ANALYTICS"
fi

echo ""

# 4. Test Opportunities
echo -e "${BLUE}4. Testing Opportunities Endpoint...${NC}"
OPP=$(curl -s "$API_URL/api/investor/opportunities" \
  -H "Authorization: Bearer $TOKEN")

if echo "$OPP" | jq -e '.data.opportunities' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Opportunities endpoint working${NC}"
  
  TOTAL=$(echo "$OPP" | jq -r '.data.total')
  COUNT=$(echo "$OPP" | jq '.data.opportunities | length')
  
  echo "   Total Opportunities: $TOTAL"
  echo "   Current Page Count: $COUNT"
else
  echo -e "${RED}❌ Opportunities endpoint issue${NC}"
  echo "Response: $OPP" | jq . 2>/dev/null || echo "$OPP"
fi

echo ""

# 5. Test Portfolio Performance
echo -e "${BLUE}5. Testing Portfolio Performance...${NC}"
PERF=$(curl -s "$API_URL/api/investor/portfolio" \
  -H "Authorization: Bearer $TOKEN")

if [ -n "$PERF" ] && ! echo "$PERF" | grep -q "error"; then
  echo -e "${GREEN}✅ Portfolio endpoint accessible${NC}"
else
  echo -e "${YELLOW}⚠️ Portfolio endpoint may need implementation${NC}"
fi

echo ""

# Summary
echo -e "${CYAN}============================================="
echo "PRODUCTION TEST SUMMARY"
echo "=============================================${NC}"
echo ""

if [ "$USER_ID" = "2" ]; then
  echo -e "${GREEN}✅ Authentication: Working (correct user ID)${NC}"
else
  echo -e "${RED}❌ Authentication: Issue with user ID${NC}"
fi

if echo "$DASHBOARD" | jq -e '.data.portfolio' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Dashboard: Working${NC}"
else
  echo -e "${RED}❌ Dashboard: Structure issues${NC}"
fi

if echo "$ANALYTICS" | jq -e '.data' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Analytics: Working${NC}"
else
  echo -e "${RED}❌ Analytics: Not working${NC}"
fi

if echo "$OPP" | jq -e '.data.opportunities' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Opportunities: Working${NC}"
else
  echo -e "${RED}❌ Opportunities: Not working${NC}"
fi

echo ""
echo -e "${CYAN}Test Complete!${NC}"
echo ""
echo "Production API: $API_URL"
echo "Frontend URL: https://pitchey.pages.dev"
echo ""
echo "To test in browser:"
echo "1. Go to https://pitchey.pages.dev"
echo "2. Click 'Investor Portal'"
echo "3. Login with: sarah.investor@demo.com / Demo123"
echo "4. Check dashboard displays correctly"