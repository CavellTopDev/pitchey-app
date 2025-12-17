#!/bin/bash

# Test demo account login on production API
# Tests all three portal types: creator, investor, production

set -e

BASE_URL="https://pitchey-production.cavelltheleaddev.workers.dev"
PASSWORD="Demo123"

echo "==========================================="
echo "    Testing Demo Account Authentication    "
echo "==========================================="
echo ""
echo "API: $BASE_URL"
echo "Password: $PASSWORD"
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test Creator login
echo -e "${BLUE}1. Testing Creator Login...${NC}"
echo "   Email: alex.creator@demo.com"
CREATOR_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"alex.creator@demo.com\",\"password\":\"$PASSWORD\"}" 2>/dev/null)

if echo "$CREATOR_RESPONSE" | grep -q '"success":true\|"token"'; then
  echo -e "   ${GREEN}✅ Creator login successful${NC}"
  CREATOR_TOKEN=$(echo "$CREATOR_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  if [ -n "$CREATOR_TOKEN" ]; then
    echo "   Token: ${CREATOR_TOKEN:0:20}..."
  fi
else
  echo -e "   ${RED}❌ Creator login failed${NC}"
  echo "   Response: $CREATOR_RESPONSE"
fi
echo ""

# Test Investor login
echo -e "${BLUE}2. Testing Investor Login...${NC}"
echo "   Email: sarah.investor@demo.com"
INVESTOR_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"sarah.investor@demo.com\",\"password\":\"$PASSWORD\"}" 2>/dev/null)

if echo "$INVESTOR_RESPONSE" | grep -q '"success":true\|"token"'; then
  echo -e "   ${GREEN}✅ Investor login successful${NC}"
  INVESTOR_TOKEN=$(echo "$INVESTOR_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  if [ -n "$INVESTOR_TOKEN" ]; then
    echo "   Token: ${INVESTOR_TOKEN:0:20}..."
  fi
else
  echo -e "   ${RED}❌ Investor login failed${NC}"
  echo "   Response: $INVESTOR_RESPONSE"
fi
echo ""

# Test Production Company login
echo -e "${BLUE}3. Testing Production Company Login...${NC}"
echo "   Email: stellar.production@demo.com"
PRODUCTION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/production/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"stellar.production@demo.com\",\"password\":\"$PASSWORD\"}" 2>/dev/null)

if echo "$PRODUCTION_RESPONSE" | grep -q '"success":true\|"token"'; then
  echo -e "   ${GREEN}✅ Production login successful${NC}"
  PRODUCTION_TOKEN=$(echo "$PRODUCTION_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  if [ -n "$PRODUCTION_TOKEN" ]; then
    echo "   Token: ${PRODUCTION_TOKEN:0:20}..."
  fi
else
  echo -e "   ${RED}❌ Production login failed${NC}"
  echo "   Response: $PRODUCTION_RESPONSE"
fi
echo ""

# Test authenticated endpoints if we have a token
if [ -n "$CREATOR_TOKEN" ]; then
  echo -e "${BLUE}4. Testing Authenticated Endpoints...${NC}"
  
  # Test profile endpoint
  echo "   Testing /api/user/profile..."
  PROFILE_RESPONSE=$(curl -s "$BASE_URL/api/user/profile" \
    -H "Authorization: Bearer $CREATOR_TOKEN" 2>/dev/null)
  
  if echo "$PROFILE_RESPONSE" | grep -q '"success":true\|"email"'; then
    echo -e "   ${GREEN}✅ Profile endpoint working${NC}"
  else
    echo -e "   ${RED}❌ Profile endpoint failed${NC}"
  fi
  
  # Test creator dashboard
  echo "   Testing /api/creator/dashboard..."
  DASHBOARD_RESPONSE=$(curl -s "$BASE_URL/api/creator/dashboard" \
    -H "Authorization: Bearer $CREATOR_TOKEN" 2>/dev/null)
  
  if echo "$DASHBOARD_RESPONSE" | grep -q '"success":true\|"stats"\|"pitches"'; then
    echo -e "   ${GREEN}✅ Dashboard endpoint working${NC}"
  else
    echo -e "   ${RED}❌ Dashboard endpoint failed${NC}"
  fi
fi
echo ""

# Test public endpoints
echo -e "${BLUE}5. Testing Public Endpoints...${NC}"

# Browse endpoint
echo "   Testing /api/pitches/browse/enhanced..."
BROWSE_RESPONSE=$(curl -s "$BASE_URL/api/pitches/browse/enhanced?limit=1" 2>/dev/null)
if echo "$BROWSE_RESPONSE" | grep -q '"success":true'; then
  echo -e "   ${GREEN}✅ Browse endpoint working${NC}"
else
  echo -e "   ${RED}❌ Browse endpoint failed${NC}"
fi

# Public pitches
echo "   Testing /api/pitches/public..."
PUBLIC_RESPONSE=$(curl -s "$BASE_URL/api/pitches/public?limit=1" 2>/dev/null)
if echo "$PUBLIC_RESPONSE" | grep -q '"success":true\|"pitches"'; then
  echo -e "   ${GREEN}✅ Public pitches endpoint working${NC}"
else
  echo -e "   ${RED}❌ Public pitches endpoint failed${NC}"
fi

echo ""
echo "==========================================="
echo "              Test Summary                 "
echo "==========================================="
echo ""

# Generate summary
SUCCESS_COUNT=0
FAIL_COUNT=0

[ -n "$CREATOR_TOKEN" ] && SUCCESS_COUNT=$((SUCCESS_COUNT + 1)) || FAIL_COUNT=$((FAIL_COUNT + 1))
[ -n "$INVESTOR_TOKEN" ] && SUCCESS_COUNT=$((SUCCESS_COUNT + 1)) || FAIL_COUNT=$((FAIL_COUNT + 1))
[ -n "$PRODUCTION_TOKEN" ] && SUCCESS_COUNT=$((SUCCESS_COUNT + 1)) || FAIL_COUNT=$((FAIL_COUNT + 1))

echo -e "Authentication Tests: ${GREEN}$SUCCESS_COUNT passed${NC}, ${RED}$FAIL_COUNT failed${NC}"

if [ $SUCCESS_COUNT -eq 3 ]; then
  echo -e "\n${GREEN}✅ All demo accounts are working!${NC}"
else
  echo -e "\n${RED}⚠️  Some demo accounts are not working.${NC}"
  echo "This might indicate:"
  echo "- Database connection issues"
  echo "- Missing demo account data"
  echo "- Authentication service problems"
fi

echo ""
echo "Test completed at: $(date)"