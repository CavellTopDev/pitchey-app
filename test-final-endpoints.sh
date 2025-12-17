#!/bin/bash

# Test script for final serverless worker endpoints
# Tests all 30 implemented endpoints

API_URL="https://pitchey-production.cavelltheleaddev.workers.dev"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "\n${YELLOW}=== CLOUDFLARE WORKER ENDPOINT TESTS - FINAL VERSION ===${NC}\n"

# Test counters
TOTAL=0
PASSED=0
FAILED=0

# Function to test endpoint
test_endpoint() {
  local method=$1
  local endpoint=$2
  local data=$3
  local description=$4
  local auth_token=$5
  
  TOTAL=$((TOTAL + 1))
  
  echo -n "[$TOTAL] Testing $description... "
  
  if [[ -z "$data" ]]; then
    if [[ -z "$auth_token" ]]; then
      response=$(curl -s -X $method "$API_URL$endpoint" -H "Content-Type: application/json" -w "\n%{http_code}")
    else
      response=$(curl -s -X $method "$API_URL$endpoint" -H "Content-Type: application/json" -H "Authorization: Bearer $auth_token" -w "\n%{http_code}")
    fi
  else
    if [[ -z "$auth_token" ]]; then
      response=$(curl -s -X $method "$API_URL$endpoint" -H "Content-Type: application/json" -d "$data" -w "\n%{http_code}")
    else
      response=$(curl -s -X $method "$API_URL$endpoint" -H "Content-Type: application/json" -H "Authorization: Bearer $auth_token" -d "$data" -w "\n%{http_code}")
    fi
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  
  if [[ "$http_code" -ge 200 && "$http_code" -lt 300 ]]; then
    echo -e "${GREEN}✓${NC} ($http_code)"
    PASSED=$((PASSED + 1))
    
    # Extract tokens and IDs for subsequent tests
    if [[ "$endpoint" == "/api/auth/creator/login" ]]; then
      CREATOR_TOKEN=$(echo "$body" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
      CREATOR_ID=$(echo "$body" | grep -o '"id":[0-9]*' | cut -d':' -f2)
      echo "  → Extracted creator token"
    elif [[ "$endpoint" == "/api/auth/investor/login" ]]; then
      INVESTOR_TOKEN=$(echo "$body" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
      INVESTOR_ID=$(echo "$body" | grep -o '"id":[0-9]*' | cut -d':' -f2)
      echo "  → Extracted investor token"
    elif [[ "$endpoint" == "/api/auth/production/login" ]]; then
      PRODUCTION_TOKEN=$(echo "$body" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
      PRODUCTION_ID=$(echo "$body" | grep -o '"id":[0-9]*' | cut -d':' -f2)
      echo "  → Extracted production token"
    elif [[ "$endpoint" == "/api/pitches" && "$method" == "POST" ]]; then
      PITCH_ID=$(echo "$body" | grep -o '"id":[0-9]*' | cut -d':' -f2 | head -1)
      echo "  → Created pitch ID: $PITCH_ID"
    fi
  else
    echo -e "${RED}✗${NC} ($http_code)"
    FAILED=$((FAILED + 1))
    if [[ "$http_code" -ge 500 ]]; then
      echo "  Error: $(echo "$body" | grep -o '"message":"[^"]*' | cut -d'"' -f4)"
    fi
  fi
}

# 1. Test health check
echo -e "\n${BLUE}1. HEALTH & INFO${NC}"
test_endpoint "GET" "/api/health" "" "Health Check"

# 2. Test authentication
echo -e "\n${BLUE}2. AUTHENTICATION (3 endpoints)${NC}"
test_endpoint "POST" "/api/auth/creator/login" '{"email":"alex.creator@demo.com","password":"Demo123"}' "Creator Login"
test_endpoint "POST" "/api/auth/investor/login" '{"email":"sarah.investor@demo.com","password":"Demo123"}' "Investor Login"
test_endpoint "POST" "/api/auth/production/login" '{"email":"stellar.production@demo.com","password":"Demo123"}' "Production Login"

# 3. Test dashboards with correct paths
echo -e "\n${BLUE}3. DASHBOARDS (3 endpoints)${NC}"
test_endpoint "GET" "/api/creator/dashboard" "" "Creator Dashboard" "$CREATOR_TOKEN"
test_endpoint "GET" "/api/investor/dashboard" "" "Investor Dashboard" "$INVESTOR_TOKEN"
test_endpoint "GET" "/api/production/dashboard" "" "Production Dashboard" "$PRODUCTION_TOKEN"

# 4. Test pitch CRUD
echo -e "\n${BLUE}4. PITCH CRUD (5 endpoints)${NC}"
test_endpoint "POST" "/api/pitches" '{
  "title":"Test Serverless Pitch",
  "logline":"A test pitch for the serverless worker",
  "genre":"Action",
  "format":"Feature Film",
  "synopsis":"Test synopsis for serverless",
  "status":"draft"
}' "Create Pitch" "$CREATOR_TOKEN"

test_endpoint "GET" "/api/pitches" "" "List Creator Pitches" "$CREATOR_TOKEN"
test_endpoint "GET" "/api/pitches/$PITCH_ID" "" "Get Single Pitch"
test_endpoint "PUT" "/api/pitches/$PITCH_ID" '{"title":"Updated Serverless Pitch","status":"published"}' "Update Pitch" "$CREATOR_TOKEN"

# Create another pitch for saving
test_endpoint "POST" "/api/pitches" '{
  "title":"Pitch for Saving",
  "logline":"A pitch to test save functionality",
  "genre":"Drama",
  "format":"TV Series",
  "status":"published"
}' "Create Published Pitch" "$CREATOR_TOKEN"

# 5. Test saved pitches
echo -e "\n${BLUE}5. SAVED PITCHES (3 endpoints)${NC}"
test_endpoint "POST" "/api/saved-pitches" "{\"pitchId\":$PITCH_ID}" "Save Pitch" "$INVESTOR_TOKEN"
test_endpoint "GET" "/api/saved-pitches" "" "List Saved Pitches" "$INVESTOR_TOKEN"
test_endpoint "DELETE" "/api/saved-pitches/$PITCH_ID" "" "Unsave Pitch" "$INVESTOR_TOKEN"

# 6. Test NDA system
echo -e "\n${BLUE}6. NDA SYSTEM (7 endpoints)${NC}"
test_endpoint "POST" "/api/nda/request" "{\"pitchId\":$PITCH_ID,\"message\":\"I would like to review this pitch\"}" "Request NDA" "$INVESTOR_TOKEN"
test_endpoint "GET" "/api/nda/requests?pitchId=$PITCH_ID" "" "List NDA Requests" "$CREATOR_TOKEN"
test_endpoint "GET" "/api/nda/stats" "" "NDA Stats" "$CREATOR_TOKEN"

# Approve the first NDA request (ID 1 for testing)
test_endpoint "PUT" "/api/nda/approve/1" "" "Approve NDA" "$CREATOR_TOKEN"
test_endpoint "GET" "/api/nda/signed" "" "List Signed NDAs" "$INVESTOR_TOKEN"
test_endpoint "GET" "/api/nda/check?pitchId=$PITCH_ID" "" "Check NDA Status" "$INVESTOR_TOKEN"

# Reject test
test_endpoint "PUT" "/api/nda/reject/2" '{"reason":"Not a good fit"}' "Reject NDA" "$CREATOR_TOKEN"

# 7. Test browse and search
echo -e "\n${BLUE}7. BROWSE & SEARCH (6 endpoints)${NC}"
test_endpoint "GET" "/api/pitches/browse/enhanced" "" "Browse All Pitches"
test_endpoint "GET" "/api/pitches/browse/enhanced?genre=Action" "" "Browse by Genre"
test_endpoint "GET" "/api/pitches/trending" "" "Trending Pitches"
test_endpoint "GET" "/api/pitches/new" "" "New Releases"
test_endpoint "GET" "/api/pitches/featured" "" "Featured Pitches"
test_endpoint "GET" "/api/search?q=test" "" "Search Pitches"

# 8. Test config endpoints
echo -e "\n${BLUE}8. CONFIG (2 endpoints)${NC}"
test_endpoint "GET" "/api/config/genres" "" "Get Genres"
test_endpoint "GET" "/api/config/formats" "" "Get Formats"

# 9. Delete test pitch
echo -e "\n${BLUE}9. CLEANUP${NC}"
test_endpoint "DELETE" "/api/pitches/$PITCH_ID" "" "Delete Test Pitch" "$CREATOR_TOKEN"

# Print summary
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}TEST SUMMARY${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Total Tests: ${BLUE}$TOTAL${NC}"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [[ $FAILED -eq 0 ]]; then
  echo -e "\n${GREEN}✨ All tests passed successfully!${NC}"
  echo -e "${GREEN}Worker version: serverless-final-v2.0${NC}"
  echo -e "${GREEN}Deployment ID: 6c3b0ee1-8c4b-47ab-8f15-4ee3ad27b936${NC}"
  exit 0
else
  echo -e "\n${RED}⚠ Some tests failed. Check the output above for details.${NC}"
  exit 1
fi