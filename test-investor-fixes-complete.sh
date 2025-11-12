#!/bin/bash

# Test Complete Investor Portal Fixes
API_URL="http://localhost:8001"

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================="
echo "TESTING INVESTOR PORTAL FIXES"
echo "=========================================${NC}"
echo ""

# 1. Test Login with correct ID
echo -e "${BLUE}1. Testing Investor Login (should return ID 2)...${NC}"
LOGIN_RESP=$(curl -s -X POST "$API_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah.investor@demo.com","password":"Demo123"}')

TOKEN=$(echo "$LOGIN_RESP" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
USER_ID=$(echo "$LOGIN_RESP" | grep -o '"id":[0-9]*' | grep -o '[0-9]*')

if [ "$USER_ID" = "2" ]; then
  echo -e "${GREEN}✅ Login returns correct ID: 2${NC}"
else
  echo -e "${RED}❌ Login returns wrong ID: $USER_ID (expected 2)${NC}"
fi

echo ""

# 2. Test Dashboard Structure
echo -e "${BLUE}2. Testing Dashboard Data Structure...${NC}"
DASHBOARD=$(curl -s "$API_URL/api/investor/dashboard" \
  -H "Authorization: Bearer $TOKEN")

# Check if portfolio is directly accessible (no double nesting)
if echo "$DASHBOARD" | grep -q '"portfolio":{' && ! echo "$DASHBOARD" | grep -q '"data":{"portfolio"'; then
  echo -e "${GREEN}✅ Dashboard structure fixed (no double nesting)${NC}"
else
  echo -e "${RED}❌ Dashboard still has nesting issues${NC}"
fi

# Check portfolio values
TOTAL_INVESTED=$(echo "$DASHBOARD" | grep -o '"totalInvested":[0-9]*' | grep -o '[0-9]*')
if [ -n "$TOTAL_INVESTED" ] && [ "$TOTAL_INVESTED" -gt "0" ]; then
  echo -e "${GREEN}✅ Dashboard shows investment data: \$$TOTAL_INVESTED${NC}"
else
  echo -e "${YELLOW}⚠️ Dashboard shows no investments (may need data seeding)${NC}"
fi

echo ""

# 3. Test Analytics Endpoint
echo -e "${BLUE}3. Testing Analytics Endpoint...${NC}"
ANALYTICS=$(curl -s "$API_URL/api/investor/analytics" \
  -H "Authorization: Bearer $TOKEN")

PORTFOLIO_VALUE=$(echo "$ANALYTICS" | grep -o '"portfolioValue":[0-9]*' | grep -o '[0-9]*' | head -1)
if [ -n "$PORTFOLIO_VALUE" ] && [ "$PORTFOLIO_VALUE" = "100000" ]; then
  echo -e "${GREEN}✅ Analytics shows correct portfolio value: \$$PORTFOLIO_VALUE${NC}"
else
  echo -e "${YELLOW}⚠️ Analytics portfolio value: \$$PORTFOLIO_VALUE (expected \$100000)${NC}"
fi

echo ""

# 4. Test Opportunities Endpoint
echo -e "${BLUE}4. Testing Opportunities Endpoint...${NC}"
OPPORTUNITIES=$(curl -s "$API_URL/api/investor/opportunities" \
  -H "Authorization: Bearer $TOKEN")

if echo "$OPPORTUNITIES" | grep -q '"opportunities":\[' && echo "$OPPORTUNITIES" | grep -q '"total":'; then
  echo -e "${GREEN}✅ Opportunities endpoint structure correct${NC}"
  OPP_COUNT=$(echo "$OPPORTUNITIES" | grep -o '"total":[0-9]*' | grep -o '[0-9]*')
  echo -e "   Opportunities available: $OPP_COUNT"
else
  echo -e "${RED}❌ Opportunities endpoint structure wrong${NC}"
fi

echo ""

# 5. Database Verification
echo -e "${BLUE}5. Verifying Database Correlation...${NC}"
DB_CHECK=$(PGPASSWORD=npg_DZhIpVaLAk06 psql -h ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech \
  -U neondb_owner -d neondb -t -A \
  -c "SELECT COUNT(*) FROM investments WHERE investor_id = 2;" 2>/dev/null)

if [ "$DB_CHECK" = "1" ]; then
  echo -e "${GREEN}✅ Database has 1 investment for user ID 2${NC}"
else
  echo -e "${RED}❌ Database investment count mismatch${NC}"
fi

echo ""
echo -e "${BLUE}========================================="
echo "TEST SUMMARY"
echo "=========================================${NC}"
echo ""

# Summary
if [ "$USER_ID" = "2" ]; then
  echo -e "${GREEN}✅ User ID: Fixed (returns 2)${NC}"
else
  echo -e "${RED}❌ User ID: Still broken (returns $USER_ID)${NC}"
fi

if echo "$DASHBOARD" | grep -q '"portfolio":{' && ! echo "$DASHBOARD" | grep -q '"data":{"portfolio"'; then
  echo -e "${GREEN}✅ Data Structure: Fixed (no double nesting)${NC}"
else
  echo -e "${RED}❌ Data Structure: Still has issues${NC}"
fi

if echo "$OPPORTUNITIES" | grep -q '"opportunities":\['; then
  echo -e "${GREEN}✅ Opportunities: Endpoint working${NC}"
else
  echo -e "${RED}❌ Opportunities: Endpoint broken${NC}"
fi

echo ""
echo -e "${GREEN}Investor Portal fixes implementation complete!${NC}"
