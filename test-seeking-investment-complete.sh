#!/bin/bash

set -e

API_URL="https://pitchey-production.cavelltheleaddev.workers.dev"
FRONTEND_URL="https://bf53246c.pitchey.pages.dev"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===================================="
echo "Testing Seeking Investment Feature"
echo "=====================================${NC}"
echo ""
echo "API URL: $API_URL"
echo "Frontend URL: $FRONTEND_URL"
echo ""

# Test 1: Check database connection
echo -e "${YELLOW}Test 1: Database Health Check${NC}"
DB_TEST=$(curl -s "$API_URL/api/db-test")
if echo "$DB_TEST" | grep -q "success.*true"; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
    echo "$DB_TEST"
fi
echo ""

# Test 2: Login as creator
echo -e "${YELLOW}Test 2: Creator Authentication${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alex.creator@demo.com",
    "password": "Demo123"
  }')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
USER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2 | head -1)

if [ -n "$TOKEN" ]; then
    echo -e "${GREEN}✅ Creator login successful (ID: $USER_ID)${NC}"
else
    echo -e "${RED}❌ Creator login failed${NC}"
    echo "$LOGIN_RESPONSE"
    exit 1
fi
echo ""

# Test 3: Get existing pitches with seeking investment
echo -e "${YELLOW}Test 3: Query Existing Seeking Investment Pitches${NC}"
SEARCH_RESPONSE=$(curl -s "$API_URL/api/pitches/browse/enhanced?seekingInvestment=true" \
  -H "Authorization: Bearer $TOKEN")

PITCH_COUNT=$(echo "$SEARCH_RESPONSE" | grep -o '"id":[0-9]*' | wc -l)
if [ "$PITCH_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Found $PITCH_COUNT pitches seeking investment${NC}"
    echo "$SEARCH_RESPONSE" | grep -o '"title":"[^"]*' | head -3 | sed 's/"title":"/ - /'
else
    echo -e "${YELLOW}⚠️  No pitches found seeking investment${NC}"
fi
echo ""

# Test 4: Create new pitch with seeking investment
echo -e "${YELLOW}Test 4: Create Pitch with Seeking Investment${NC}"
TIMESTAMP=$(date +%s)
CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/pitches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Seeking Investment '"$TIMESTAMP"'",
    "tagline": "A revolutionary film project",
    "synopsis": "This pitch is testing the seeking investment feature",
    "genre": "action",
    "format": "feature",
    "status": "draft",
    "visibility": "public",
    "seekingInvestment": true,
    "budgetRange": "$1M - $5M",
    "targetAudience": "General",
    "themes": ["adventure", "hope"],
    "logline": "Test logline for seeking investment"
  }')

PITCH_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2 | head -1)

if [ -n "$PITCH_ID" ]; then
    echo -e "${GREEN}✅ Created pitch with seeking investment (ID: $PITCH_ID)${NC}"
else
    echo -e "${RED}❌ Failed to create pitch${NC}"
    echo "$CREATE_RESPONSE"
fi
echo ""

# Test 5: Verify pitch has seeking investment flag
if [ -n "$PITCH_ID" ]; then
    echo -e "${YELLOW}Test 5: Verify Seeking Investment Flag${NC}"
    PITCH_DETAILS=$(curl -s "$API_URL/api/pitches/$PITCH_ID" \
      -H "Authorization: Bearer $TOKEN")
    
    if echo "$PITCH_DETAILS" | grep -q '"seekingInvestment":true'; then
        echo -e "${GREEN}✅ Pitch correctly shows seekingInvestment: true${NC}"
        
        # Check for budget range
        if echo "$PITCH_DETAILS" | grep -q '"budgetRange"'; then
            BUDGET=$(echo "$PITCH_DETAILS" | grep -o '"budgetRange":"[^"]*' | cut -d'"' -f4)
            echo -e "${GREEN}✅ Budget range set to: $BUDGET${NC}"
        fi
    else
        echo -e "${RED}❌ Seeking investment flag not found${NC}"
        echo "$PITCH_DETAILS" | jq '.pitch | {id, title, seekingInvestment, budgetRange}' 2>/dev/null || echo "$PITCH_DETAILS"
    fi
    echo ""
fi

# Test 6: Login as investor
echo -e "${YELLOW}Test 6: Investor Authentication${NC}"
INVESTOR_LOGIN=$(curl -s -X POST "$API_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sarah.investor@demo.com",
    "password": "Demo123"
  }')

INVESTOR_TOKEN=$(echo "$INVESTOR_LOGIN" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
INVESTOR_ID=$(echo "$INVESTOR_LOGIN" | grep -o '"id":[0-9]*' | cut -d':' -f2 | head -1)

if [ -n "$INVESTOR_TOKEN" ]; then
    echo -e "${GREEN}✅ Investor login successful (ID: $INVESTOR_ID)${NC}"
else
    echo -e "${RED}❌ Investor login failed${NC}"
    echo "$INVESTOR_LOGIN"
fi
echo ""

# Test 7: Check investor dashboard
echo -e "${YELLOW}Test 7: Investor Dashboard Seeking Investment Count${NC}"
DASHBOARD=$(curl -s "$API_URL/api/investor/dashboard" \
  -H "Authorization: Bearer $INVESTOR_TOKEN")

if echo "$DASHBOARD" | grep -q "success.*true"; then
    echo -e "${GREEN}✅ Investor dashboard loaded successfully${NC}"
    
    # Extract metrics
    ACTIVE_INVESTMENTS=$(echo "$DASHBOARD" | grep -o '"activeInvestments":[0-9]*' | cut -d':' -f2)
    SAVED_PITCHES=$(echo "$DASHBOARD" | grep -o '"savedPitches":[0-9]*' | cut -d':' -f2)
    PENDING_NDAS=$(echo "$DASHBOARD" | grep -o '"pendingNDAs":[0-9]*' | cut -d':' -f2)
    
    echo "  - Active Investments: ${ACTIVE_INVESTMENTS:-0}"
    echo "  - Saved Pitches: ${SAVED_PITCHES:-0}"
    echo "  - Pending NDAs: ${PENDING_NDAS:-0}"
    
    # Check for seeking investment specific data
    if echo "$DASHBOARD" | grep -q "seekingInvestment"; then
        echo -e "${GREEN}✅ Dashboard includes seeking investment data${NC}"
    fi
else
    echo -e "${RED}❌ Failed to load investor dashboard${NC}"
    echo "$DASHBOARD"
fi
echo ""

# Test 8: Search with seeking investment filter
echo -e "${YELLOW}Test 8: Search API with Seeking Investment Filter${NC}"
FILTERED_SEARCH=$(curl -s "$API_URL/api/pitches/search?seekingInvestment=true&limit=5")

if echo "$FILTERED_SEARCH" | grep -q '"pitches":\['; then
    FILTERED_COUNT=$(echo "$FILTERED_SEARCH" | grep -o '"id":[0-9]*' | wc -l)
    echo -e "${GREEN}✅ Search returned $FILTERED_COUNT pitches seeking investment${NC}"
    
    # Show first few titles
    echo "$FILTERED_SEARCH" | grep -o '"title":"[^"]*' | head -3 | sed 's/"title":"/ - /'
else
    echo -e "${YELLOW}⚠️  Search endpoint may need adjustment${NC}"
fi
echo ""

# Test 9: Browse enhanced with seeking investment
echo -e "${YELLOW}Test 9: Browse Enhanced Endpoint${NC}"
BROWSE_RESPONSE=$(curl -s "$API_URL/api/pitches/browse/enhanced?page=1&limit=10&seekingInvestment=true")

if echo "$BROWSE_RESPONSE" | grep -q "success.*true"; then
    BROWSE_COUNT=$(echo "$BROWSE_RESPONSE" | grep -o '"id":[0-9]*' | wc -l)
    TOTAL=$(echo "$BROWSE_RESPONSE" | grep -o '"total":[0-9]*' | cut -d':' -f2 | head -1)
    
    echo -e "${GREEN}✅ Browse endpoint working${NC}"
    echo "  - Showing: $BROWSE_COUNT pitches"
    echo "  - Total available: ${TOTAL:-unknown}"
else
    echo -e "${YELLOW}⚠️  Browse enhanced endpoint needs checking${NC}"
fi
echo ""

# Clean up test pitch
if [ -n "$PITCH_ID" ] && [ -n "$TOKEN" ]; then
    echo -e "${YELLOW}Test 10: Cleanup${NC}"
    DELETE_RESPONSE=$(curl -s -X DELETE "$API_URL/api/pitches/$PITCH_ID" \
      -H "Authorization: Bearer $TOKEN")
    
    if echo "$DELETE_RESPONSE" | grep -q "success.*true"; then
        echo -e "${GREEN}✅ Test pitch deleted${NC}"
    else
        echo -e "${YELLOW}⚠️  Could not delete test pitch${NC}"
    fi
fi

echo ""
echo -e "${BLUE}===================================="
echo "Test Summary"
echo "=====================================${NC}"
echo ""
echo -e "${GREEN}Frontend URLs to Test:${NC}"
echo "1. Main site: $FRONTEND_URL"
echo "2. Create pitch: $FRONTEND_URL/creator/pitches/new"
echo "3. Browse: $FRONTEND_URL/marketplace"
echo ""
echo -e "${GREEN}Key Features to Verify:${NC}"
echo "✓ Create pitch form has 'Seeking Investment' checkbox"
echo "✓ Budget range dropdown appears when checkbox is checked"
echo "✓ Pitch detail pages show green 'Seeking Investment' badge"
echo "✓ Browse/Marketplace filter includes 'Seeking Investment' option"
echo "✓ Investor dashboard highlights investment opportunities"
echo ""
echo -e "${BLUE}=====================================${NC}"

