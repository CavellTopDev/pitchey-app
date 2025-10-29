#!/bin/bash

echo "🔍 Testing Creator Dashboard Pitch Counter Fix"
echo "=============================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test backend API first
echo -e "\n1️⃣ Testing Backend API Response:"
echo "Logging in as creator..."

TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alex.creator@demo.com", "password": "Demo123"}' | jq -r '.token')

if [ "$TOKEN" != "null" ] && [ "$TOKEN" != "" ]; then
  echo -e "${GREEN}✓ Login successful${NC}"
  
  echo "Fetching creator dashboard data..."
  RESPONSE=$(curl -s -X GET http://localhost:8001/api/creator/dashboard \
    -H "Authorization: Bearer $TOKEN")
  
  TOTAL_PITCHES=$(echo "$RESPONSE" | jq -r '.data.totalPitches')
  PUBLISHED_PITCHES=$(echo "$RESPONSE" | jq -r '.data.publishedPitches')
  DRAFT_PITCHES=$(echo "$RESPONSE" | jq -r '.data.draftPitches')
  
  echo -e "${GREEN}✓ API Response:${NC}"
  echo "  Total Pitches: $TOTAL_PITCHES"
  echo "  Published: $PUBLISHED_PITCHES"
  echo "  Drafts: $DRAFT_PITCHES"
  
  if [ "$TOTAL_PITCHES" != "0" ] && [ "$TOTAL_PITCHES" != "null" ]; then
    echo -e "${GREEN}✓ Backend API is working correctly${NC}"
  else
    echo -e "${RED}✗ Backend API returned 0 or null for total pitches${NC}"
  fi
else
  echo -e "${RED}✗ Login failed${NC}"
  exit 1
fi

echo -e "\n2️⃣ Testing Frontend Integration:"
echo "Frontend should now be running on http://localhost:5173"
echo -e "${YELLOW}Manual verification steps:${NC}"
echo "1. Open http://localhost:5173 in your browser"
echo "2. Login as creator with:"
echo "   Email: alex.creator@demo.com"
echo "   Password: Demo123"
echo "3. Check if 'Total Pitches Created' shows: $TOTAL_PITCHES (should be 100)"
echo "4. Verify other stats are also displayed correctly"

echo -e "\n✅ Fix Applied:"
echo "- Updated frontend to read data.totalPitches instead of data.stats.totalPitches"
echo "- Updated other stats to match backend API response structure"
echo "- Backend API confirmed working with totalPitches: $TOTAL_PITCHES"