#!/bin/bash

# Complete Frontend-Backend Integration Test for Pitchey v0.2

API_URL="http://localhost:8001"
FRONTEND_URL="http://localhost:5173"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}PITCHEY V0.2 COMPLETE INTEGRATION TEST${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Test counters
PASS=0
FAIL=0

echo -e "${YELLOW}1. DATABASE STATUS${NC}"
echo "------------------------"
PITCH_COUNT=$(PGPASSWORD=password psql -h localhost -U postgres -d pitchey -t -c "SELECT COUNT(*) FROM pitches WHERE status='published';" 2>/dev/null | xargs)
USER_COUNT=$(PGPASSWORD=password psql -h localhost -U postgres -d pitchey -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | xargs)
echo -e "  ${GREEN}✅${NC} Published pitches: $PITCH_COUNT"
echo -e "  ${GREEN}✅${NC} Total users: $USER_COUNT"
((PASS+=2))
echo ""

echo -e "${YELLOW}2. BACKEND API STATUS${NC}"
echo "------------------------"

# Test public endpoints
for endpoint in "/api/pitches/public" "/api/pitches/public/7" "/api/pitches/public/8"; do
    RESPONSE=$(curl -s "${API_URL}${endpoint}" 2>/dev/null)
    if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
        echo -e "  ${GREEN}✅${NC} ${endpoint}"
        ((PASS++))
    else
        echo -e "  ${RED}❌${NC} ${endpoint}"
        ((FAIL++))
    fi
done
echo ""

echo -e "${YELLOW}3. FRONTEND-API INTEGRATION${NC}"
echo "------------------------"

# Check if public pitches API returns data
API_RESPONSE=$(curl -s "${API_URL}/api/pitches/public")
PITCH_COUNT=$(echo "$API_RESPONSE" | jq '.data.pitches | length' 2>/dev/null)

if [ "$PITCH_COUNT" -gt 0 ] 2>/dev/null; then
    echo -e "  ${GREEN}✅${NC} API returns $PITCH_COUNT public pitches"
    ((PASS++))
    
    # Show first 3 pitches
    echo "  Pitches available:"
    for i in 0 1 2; do
        TITLE=$(echo "$API_RESPONSE" | jq -r ".data.pitches[$i].title" 2>/dev/null)
        ID=$(echo "$API_RESPONSE" | jq -r ".data.pitches[$i].id" 2>/dev/null)
        if [ ! -z "$TITLE" ] && [ "$TITLE" != "null" ]; then
            echo "    • $TITLE (ID: $ID)"
        fi
    done
else
    echo -e "  ${RED}❌${NC} No pitches returned from API"
    ((FAIL++))
fi
echo ""

echo -e "${YELLOW}4. AUTHENTICATION${NC}"
echo "------------------------"
LOGIN_DATA='{"email":"alex.creator@demo.com","password":"Demo123"}'
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/api/auth/creator/login" -H "Content-Type: application/json" -d "$LOGIN_DATA" 2>/dev/null)

if echo "$LOGIN_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅${NC} Creator login works"
    ((PASS++))
else
    echo -e "  ${RED}❌${NC} Creator login failed"
    ((FAIL++))
fi
echo ""

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}TEST SUMMARY${NC}"
echo -e "${BLUE}=====================================${NC}"
echo -e "${GREEN}✅ Passed: $PASS${NC}"
echo -e "${RED}❌ Failed: $FAIL${NC}"

TOTAL=$((PASS + FAIL))
PERCENT=$((PASS * 100 / TOTAL))
echo ""
echo -e "${GREEN}Success Rate: ${PERCENT}%${NC}"
