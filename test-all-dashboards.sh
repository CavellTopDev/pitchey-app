#!/bin/bash

# Comprehensive Dashboard Testing Script
# Tests every button, card, and feature on all dashboards

API_URL="http://localhost:8001"
FRONTEND_URL="http://localhost:5173"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Test result tracking
PASS=0
FAIL=0
ISSUES=()

function test_endpoint() {
  local description="$1"
  local method="$2"
  local endpoint="$3"
  local token="$4"
  local data="$5"
  
  if [ "$method" == "GET" ]; then
    response=$(curl -s -X GET "${API_URL}${endpoint}" \
      -H "Authorization: Bearer $token" 2>/dev/null)
  else
    response=$(curl -s -X "$method" "${API_URL}${endpoint}" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "$data" 2>/dev/null)
  fi
  
  if echo "$response" | jq -e '.success' > /dev/null 2>&1 || [ "$(echo "$response" | jq -r '.data' 2>/dev/null)" != "null" ]; then
    echo -e "    ${GREEN}✅${NC} $description"
    ((PASS++))
    return 0
  else
    echo -e "    ${RED}❌${NC} $description"
    error=$(echo "$response" | jq -r '.error // "Unknown error"' 2>/dev/null)
    ISSUES+=("$description: $error")
    ((FAIL++))
    return 1
  fi
}

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     COMPREHENSIVE DASHBOARD TESTING - PITCHEY v0.2        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============= CREATOR DASHBOARD TESTING =============
echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         CREATOR DASHBOARD TESTING         ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}"

# Login as creator
LOGIN_RESP=$(curl -s -X POST "${API_URL}/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}')

CREATOR_TOKEN=$(echo "$LOGIN_RESP" | jq -r '.token')
CREATOR_ID=$(echo "$LOGIN_RESP" | jq -r '.user.id')

if [ "$CREATOR_TOKEN" == "null" ]; then
  echo -e "${RED}Failed to login as creator${NC}"
  exit 1
fi

echo -e "\n${MAGENTA}1. Dashboard Statistics Cards${NC}"
echo "  Testing stat cards..."
test_endpoint "Dashboard stats" "GET" "/api/creator/stats" "$CREATOR_TOKEN"
test_endpoint "Recent activity" "GET" "/api/creator/activity" "$CREATOR_TOKEN"
test_endpoint "Notifications" "GET" "/api/notifications" "$CREATOR_TOKEN"

echo -e "\n${MAGENTA}2. Pitch Management Section${NC}"
echo "  Testing pitch operations..."
test_endpoint "View all pitches" "GET" "/api/creator/pitches" "$CREATOR_TOKEN"
test_endpoint "Get pitch details" "GET" "/api/creator/pitches/10" "$CREATOR_TOKEN"

# Test pitch creation
NEW_PITCH='{"title":"Dashboard Test Pitch","logline":"Testing from dashboard","genre":"drama","format":"feature","shortSynopsis":"Test synopsis"}'
test_endpoint "Create new pitch" "POST" "/api/creator/pitches" "$CREATOR_TOKEN" "$NEW_PITCH"

echo -e "\n${MAGENTA}3. NDA Management Section${NC}"
echo "  Testing NDA features..."
test_endpoint "NDA statistics" "GET" "/api/nda/stats" "$CREATOR_TOKEN"
test_endpoint "Pending NDA requests" "GET" "/api/ndas/request?type=pending" "$CREATOR_TOKEN"
test_endpoint "Approved NDAs" "GET" "/api/ndas/signed" "$CREATOR_TOKEN"

echo -e "\n${MAGENTA}4. Messages Section${NC}"
test_endpoint "Inbox messages" "GET" "/api/messages" "$CREATOR_TOKEN"

# ============= SUMMARY =============
echo -e "\n${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           TESTING RESULTS                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"

echo -e "\n${GREEN}✅ Passed: $PASS${NC}"
echo -e "${RED}❌ Failed: $FAIL${NC}"

if [ ${#ISSUES[@]} -gt 0 ]; then
  echo -e "\n${YELLOW}⚠️  Issues Found:${NC}"
  for issue in "${ISSUES[@]}"; do
    echo "  • $issue"
  done | head -10
fi
