#!/bin/bash

echo "🔍 Testing Pitch Display with Drizzle Integration"
echo "================================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test 1: Get public pitches and check data structure
echo -e "\n📊 Test 1: Fetching public pitches..."
RESPONSE=$(curl -s http://localhost:8001/api/public/pitches)

# Check if we have pitches
if echo "$RESPONSE" | jq -e '.pitches' > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Pitches array found${NC}"
  
  # Get first pitch
  FIRST_PITCH=$(echo "$RESPONSE" | jq '.pitches[0]')
  
  # Check for required fields
  echo -e "\n📝 Checking first pitch data:"
  
  # Title
  if echo "$FIRST_PITCH" | jq -e '.title' > /dev/null 2>&1; then
    TITLE=$(echo "$FIRST_PITCH" | jq -r '.title')
    echo -e "${GREEN}✓ Title: $TITLE${NC}"
  else
    echo -e "${RED}✗ Title missing${NC}"
  fi
  
  # Logline
  if echo "$FIRST_PITCH" | jq -e '.logline' > /dev/null 2>&1; then
    LOGLINE=$(echo "$FIRST_PITCH" | jq -r '.logline // "N/A"' | head -c 50)
    echo -e "${GREEN}✓ Logline: $LOGLINE...${NC}"
  else
    echo -e "${RED}✗ Logline missing${NC}"
  fi
  
  # Creator info
  if echo "$FIRST_PITCH" | jq -e '.creator' > /dev/null 2>&1; then
    CREATOR_NAME=$(echo "$FIRST_PITCH" | jq -r '.creator.username // .creator.companyName // "Unknown"')
    CREATOR_TYPE=$(echo "$FIRST_PITCH" | jq -r '.creator.userType // "unknown"')
    echo -e "${GREEN}✓ Creator: $CREATOR_NAME (Type: $CREATOR_TYPE)${NC}"
  else
    echo -e "${RED}✗ Creator info missing${NC}"
  fi
  
  # View count
  if echo "$FIRST_PITCH" | jq -e '.viewCount' > /dev/null 2>&1; then
    VIEWS=$(echo "$FIRST_PITCH" | jq -r '.viewCount')
    echo -e "${GREEN}✓ View Count: $VIEWS${NC}"
  else
    echo -e "${RED}✗ View count missing${NC}"
  fi
  
  # Like count
  if echo "$FIRST_PITCH" | jq -e '.likeCount' > /dev/null 2>&1; then
    LIKES=$(echo "$FIRST_PITCH" | jq -r '.likeCount')
    echo -e "${GREEN}✓ Like Count: $LIKES${NC}"
  else
    echo -e "${RED}✗ Like count missing${NC}"
  fi
  
  # Status
  if echo "$FIRST_PITCH" | jq -e '.status' > /dev/null 2>&1; then
    STATUS=$(echo "$FIRST_PITCH" | jq -r '.status')
    echo -e "${GREEN}✓ Status: $STATUS${NC}"
  else
    echo -e "${RED}✗ Status missing${NC}"
  fi
  
else
  echo -e "${RED}✗ No pitches array found in response${NC}"
fi

# Test 2: Check creator dashboard pitches
echo -e "\n\n📊 Test 2: Fetching creator dashboard pitches..."
TOKEN=$(cat /tmp/test-token.txt 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}✗ No auth token found${NC}"
else
  DASHBOARD_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8001/api/creator/pitches)
  
  if echo "$DASHBOARD_RESPONSE" | jq -e '.pitches' > /dev/null 2>&1; then
    PITCH_COUNT=$(echo "$DASHBOARD_RESPONSE" | jq '.pitches | length')
    echo -e "${GREEN}✓ Found $PITCH_COUNT pitches in creator dashboard${NC}"
    
    # Check first pitch in dashboard
    DASHBOARD_PITCH=$(echo "$DASHBOARD_RESPONSE" | jq '.pitches[0]')
    
    if [ "$DASHBOARD_PITCH" != "null" ]; then
      echo -e "\n📝 First dashboard pitch:"
      echo "$DASHBOARD_PITCH" | jq '{title, logline, viewCount, likeCount, status}'
    fi
  else
    echo -e "${RED}✗ No pitches found in dashboard${NC}"
  fi
fi

# Test 3: Check published pitches only
echo -e "\n\n📊 Test 3: Checking published pitches..."
PUBLISHED_COUNT=$(echo "$RESPONSE" | jq '[.pitches[] | select(.status == "published")] | length')
TOTAL_COUNT=$(echo "$RESPONSE" | jq '.pitches | length')

echo -e "Published: $PUBLISHED_COUNT / Total: $TOTAL_COUNT"

if [ "$PUBLISHED_COUNT" -gt 0 ]; then
  echo -e "${GREEN}✓ Published pitches are visible${NC}"
else
  echo -e "${RED}✗ No published pitches found${NC}"
fi

echo -e "\n\n✅ Pitch display test complete!"
echo "================================================"