#!/bin/bash

# Test script for Cloudflare Worker serverless endpoints
# Tests all 25 implemented endpoints with proper authentication

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
LOCAL_URL="http://localhost:8787"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Use production URL by default, allow override with --local flag
BASE_URL=$API_URL
if [[ "$1" == "--local" ]]; then
  BASE_URL=$LOCAL_URL
  echo "Testing against local worker: $BASE_URL"
else
  echo "Testing against production: $BASE_URL"
fi

echo -e "\n${YELLOW}=== CLOUDFLARE WORKER SERVERLESS ENDPOINT TESTS ===${NC}\n"

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
  
  echo -n "Testing $description... "
  
  if [[ -z "$data" ]]; then
    if [[ -z "$auth_token" ]]; then
      response=$(curl -s -X $method "$BASE_URL$endpoint" -H "Content-Type: application/json" -w "\n%{http_code}")
    else
      response=$(curl -s -X $method "$BASE_URL$endpoint" -H "Content-Type: application/json" -H "Authorization: Bearer $auth_token" -w "\n%{http_code}")
    fi
  else
    if [[ -z "$auth_token" ]]; then
      response=$(curl -s -X $method "$BASE_URL$endpoint" -H "Content-Type: application/json" -d "$data" -w "\n%{http_code}")
    else
      response=$(curl -s -X $method "$BASE_URL$endpoint" -H "Content-Type: application/json" -H "Authorization: Bearer $auth_token" -d "$data" -w "\n%{http_code}")
    fi
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  
  if [[ "$http_code" -ge 200 && "$http_code" -lt 300 ]]; then
    echo -e "${GREEN}✓${NC} ($http_code)"
    PASSED=$((PASSED + 1))
    if [[ "$endpoint" == "/api/auth/creator/login" ]]; then
      CREATOR_TOKEN=$(echo "$body" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
      CREATOR_ID=$(echo "$body" | grep -o '"id":[0-9]*' | cut -d':' -f2)
    elif [[ "$endpoint" == "/api/auth/investor/login" ]]; then
      INVESTOR_TOKEN=$(echo "$body" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
      INVESTOR_ID=$(echo "$body" | grep -o '"id":[0-9]*' | cut -d':' -f2)
    elif [[ "$endpoint" == "/api/auth/production/login" ]]; then
      PRODUCTION_TOKEN=$(echo "$body" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
      PRODUCTION_ID=$(echo "$body" | grep -o '"id":[0-9]*' | cut -d':' -f2)
    elif [[ "$endpoint" == "/api/pitches" && "$method" == "POST" ]]; then
      PITCH_ID=$(echo "$body" | grep -o '"id":[0-9]*' | cut -d':' -f2 | head -1)
    fi
  else
    echo -e "${RED}✗${NC} ($http_code)"
    FAILED=$((FAILED + 1))
    echo "  Response: $(echo "$body" | head -100)"
  fi
}

# 1. Test health endpoint
echo -e "\n${YELLOW}1. HEALTH CHECK${NC}"
test_endpoint "GET" "/api/health" "" "Health Check"

# 2. Test authentication endpoints
echo -e "\n${YELLOW}2. AUTHENTICATION (3 endpoints)${NC}"
test_endpoint "POST" "/api/auth/creator/login" '{"email":"alex.creator@demo.com","password":"Demo123"}' "Creator Login"
test_endpoint "POST" "/api/auth/investor/login" '{"email":"sarah.investor@demo.com","password":"Demo123"}' "Investor Login"
test_endpoint "POST" "/api/auth/production/login" '{"email":"stellar.production@demo.com","password":"Demo123"}' "Production Login"

# 3. Test dashboard endpoints (requires auth)
echo -e "\n${YELLOW}3. DASHBOARDS (3 endpoints)${NC}"
test_endpoint "GET" "/api/dashboard/creator" "" "Creator Dashboard" "$CREATOR_TOKEN"
test_endpoint "GET" "/api/dashboard/investor" "" "Investor Dashboard" "$INVESTOR_TOKEN"
test_endpoint "GET" "/api/dashboard/production" "" "Production Dashboard" "$PRODUCTION_TOKEN"

# 4. Test pitch CRUD operations
echo -e "\n${YELLOW}4. PITCH CRUD (5 endpoints)${NC}"
test_endpoint "POST" "/api/pitches" '{
  "title":"Test Pitch from Worker",
  "logline":"A test pitch created via serverless worker",
  "genre":"Action",
  "format":"Feature Film",
  "pages":120,
  "synopsis":"Test synopsis",
  "status":"draft"
}' "Create Pitch" "$CREATOR_TOKEN"

test_endpoint "GET" "/api/pitches" "" "List Pitches" "$CREATOR_TOKEN"
test_endpoint "GET" "/api/pitches/$PITCH_ID" "" "Get Single Pitch" "$CREATOR_TOKEN"
test_endpoint "PUT" "/api/pitches/$PITCH_ID" '{"title":"Updated Test Pitch","status":"published"}' "Update Pitch" "$CREATOR_TOKEN"
test_endpoint "DELETE" "/api/pitches/$PITCH_ID" "" "Delete Pitch" "$CREATOR_TOKEN"

# 5. Test saved pitches
echo -e "\n${YELLOW}5. SAVED PITCHES (3 endpoints)${NC}"
# First create a new pitch to save
test_endpoint "POST" "/api/pitches" '{
  "title":"Pitch to Save",
  "logline":"A pitch for testing saved functionality",
  "genre":"Drama",
  "format":"TV Series",
  "status":"published"
}' "Create Pitch for Saving" "$CREATOR_TOKEN"

test_endpoint "POST" "/api/saved-pitches" "{\"pitchId\":$PITCH_ID}" "Save Pitch" "$INVESTOR_TOKEN"
test_endpoint "GET" "/api/saved-pitches" "" "List Saved Pitches" "$INVESTOR_TOKEN"
test_endpoint "DELETE" "/api/saved-pitches/$PITCH_ID" "" "Unsave Pitch" "$INVESTOR_TOKEN"

# 6. Test NDA system
echo -e "\n${YELLOW}6. NDA SYSTEM (5 endpoints)${NC}"
test_endpoint "POST" "/api/nda/request" "{\"pitchId\":$PITCH_ID}" "Request NDA" "$INVESTOR_TOKEN"
test_endpoint "GET" "/api/nda/requests?pitchId=$PITCH_ID" "" "List NDA Requests" "$CREATOR_TOKEN"

# Get NDA request ID for approval
NDA_REQUEST_ID=1 # Placeholder, would parse from response

test_endpoint "PUT" "/api/nda/approve/$NDA_REQUEST_ID" "" "Approve NDA" "$CREATOR_TOKEN"
test_endpoint "GET" "/api/nda/signed" "" "List Signed NDAs" "$INVESTOR_TOKEN"
test_endpoint "GET" "/api/nda/check?pitchId=$PITCH_ID" "" "Check NDA Status" "$INVESTOR_TOKEN"

# 7. Test search and browse
echo -e "\n${YELLOW}7. SEARCH & BROWSE (3 endpoints)${NC}"
test_endpoint "GET" "/api/pitches/browse/enhanced" "" "Browse Pitches"
test_endpoint "GET" "/api/pitches/search?q=test" "" "Search Pitches"
test_endpoint "GET" "/api/pitches/featured" "" "Featured Pitches"

# Print summary
echo -e "\n${YELLOW}=== TEST SUMMARY ===${NC}"
echo -e "Total Tests: $TOTAL"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [[ $FAILED -eq 0 ]]; then
  echo -e "\n${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "\n${RED}✗ Some tests failed${NC}"
  exit 1
fi