#!/bin/bash

# Production Worker Test Script
# Tests critical endpoints with fixed SQL queries

API_URL="https://pitchey-production.cavelltheleaddev.workers.dev"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "\n${YELLOW}=== PRODUCTION WORKER TEST - v3.0 ===${NC}\n"

# 1. Health check
echo -e "${BLUE}Testing Health Endpoint...${NC}"
curl -s "$API_URL/api/health" | jq -r '.version, .status, .services'

# 2. Authentication
echo -e "\n${BLUE}Testing Authentication...${NC}"
CREATOR_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}')

CREATOR_TOKEN=$(echo "$CREATOR_RESPONSE" | jq -r '.token')
echo "Creator login: $(echo "$CREATOR_RESPONSE" | jq -r '.success')"

INVESTOR_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah.investor@demo.com","password":"Demo123"}')

INVESTOR_TOKEN=$(echo "$INVESTOR_RESPONSE" | jq -r '.token')
echo "Investor login: $(echo "$INVESTOR_RESPONSE" | jq -r '.success')"

# 3. Test dashboards (previously failing)
echo -e "\n${BLUE}Testing Fixed Dashboard Endpoints...${NC}"
echo -n "Creator Dashboard: "
CREATOR_DASH=$(curl -s "$API_URL/api/creator/dashboard" \
  -H "Authorization: Bearer $CREATOR_TOKEN")
echo "$CREATOR_DASH" | jq -r '.success'

echo -n "Investor Dashboard: "
INVESTOR_DASH=$(curl -s "$API_URL/api/investor/dashboard" \
  -H "Authorization: Bearer $INVESTOR_TOKEN")
echo "$INVESTOR_DASH" | jq -r '.success'

# 4. Test browse (previously failing)
echo -e "\n${BLUE}Testing Fixed Browse Endpoint...${NC}"
BROWSE_RESPONSE=$(curl -s "$API_URL/api/pitches/browse/enhanced?limit=5")
echo "Browse pitches: $(echo "$BROWSE_RESPONSE" | jq -r '.success')"
echo "Pitches returned: $(echo "$BROWSE_RESPONSE" | jq '.data | length')"

# 5. Test pitch creation and retrieval
echo -e "\n${BLUE}Testing Pitch Operations...${NC}"
PITCH_RESPONSE=$(curl -s -X POST "$API_URL/api/pitches" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Production Test Pitch",
    "logline":"Testing the production worker",
    "genre":"Action",
    "format":"Feature Film",
    "status":"published"
  }')

PITCH_ID=$(echo "$PITCH_RESPONSE" | jq -r '.data.id')
echo "Created pitch ID: $PITCH_ID"

# Get single pitch with counts (previously failing)
echo -n "Get pitch with stats: "
PITCH_DETAILS=$(curl -s "$API_URL/api/pitches/$PITCH_ID")
echo "$PITCH_DETAILS" | jq -r '.success'
echo "View count: $(echo "$PITCH_DETAILS" | jq -r '.data.viewCount')"
echo "Save count: $(echo "$PITCH_DETAILS" | jq -r '.data.saveCount')"

# 6. Test saved pitches (previously failing)
echo -e "\n${BLUE}Testing Fixed Saved Pitches...${NC}"
SAVE_RESPONSE=$(curl -s -X POST "$API_URL/api/saved-pitches" \
  -H "Authorization: Bearer $INVESTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"pitchId\":$PITCH_ID}")
echo "Save pitch: $(echo "$SAVE_RESPONSE" | jq -r '.success')"

SAVED_LIST=$(curl -s "$API_URL/api/saved-pitches" \
  -H "Authorization: Bearer $INVESTOR_TOKEN")
echo "List saved: $(echo "$SAVED_LIST" | jq -r '.success')"
echo "Saved count: $(echo "$SAVED_LIST" | jq '.data | length')"

# 7. Test NDA system
echo -e "\n${BLUE}Testing NDA System...${NC}"
NDA_RESPONSE=$(curl -s -X POST "$API_URL/api/nda/request" \
  -H "Authorization: Bearer $INVESTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"pitchId\":$PITCH_ID,\"message\":\"Interested in this project\"}")
echo "Request NDA: $(echo "$NDA_RESPONSE" | jq -r '.success')"

# 8. Test new endpoints
echo -e "\n${BLUE}Testing New Endpoints...${NC}"
echo -n "User profile: "
curl -s "$API_URL/api/profile" \
  -H "Authorization: Bearer $CREATOR_TOKEN" | jq -r '.success'

echo -n "Analytics tracking: "
curl -s -X POST "$API_URL/api/analytics/track" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event":"page_view","metadata":{"page":"/dashboard"}}' | jq -r '.success'

# 9. Clean up
echo -e "\n${BLUE}Cleaning up...${NC}"
curl -s -X DELETE "$API_URL/api/pitches/$PITCH_ID" \
  -H "Authorization: Bearer $CREATOR_TOKEN" | jq -r '.success'

# Summary
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ Production Worker Test Complete${NC}"
echo -e "Version: production-final-v3.0"
echo -e "Deployment: f3341bc3-1788-45b5-92dc-3dc1c6eeacf5"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"