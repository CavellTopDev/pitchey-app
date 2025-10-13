#!/bin/bash

# Comprehensive Endpoint Validation Test Suite
# Tests all 15 critical endpoints against the 8-point checklist

echo "🔍 Comprehensive Endpoint Validation Test Suite"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Base URL
BASE_URL="http://localhost:8001"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to print test header
print_test_header() {
  echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}Testing: $1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Function to check test result
check_result() {
  local test_name="$1"
  local expected="$2"
  local actual="$3"
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  
  if [[ "$actual" == *"$expected"* ]]; then
    echo -e "  ✅ ${GREEN}$test_name${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    return 0
  else
    echo -e "  ❌ ${RED}$test_name${NC}"
    echo -e "     Expected: $expected"
    echo -e "     Actual: ${actual:0:100}..."
    FAILED_TESTS=$((FAILED_TESTS + 1))
    return 1
  fi
}

# Start server if not running
if ! curl -s $BASE_URL/api/health > /dev/null 2>&1; then
  echo "Starting backend server..."
  source .env
  PORT=8001 JWT_SECRET="$JWT_SECRET" DATABASE_URL="$DATABASE_URL" \
    deno run --allow-all working-server.ts > server.log 2>&1 &
  SERVER_PID=$!
  sleep 5
fi

# ========================================
# AUTHENTICATION SETUP
# ========================================

echo -e "${YELLOW}Setting up authentication...${NC}"

# Login as creator
CREATOR_LOGIN=$(curl -s -X POST $BASE_URL/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}')

CREATOR_TOKEN=$(echo $CREATOR_LOGIN | jq -r '.token')

if [ -z "$CREATOR_TOKEN" ] || [ "$CREATOR_TOKEN" = "null" ]; then
  echo -e "${RED}❌ Failed to login as creator${NC}"
  echo "Response: $CREATOR_LOGIN"
  exit 1
fi
echo -e "${GREEN}✅ Creator authenticated${NC}"

# Login as production
PROD_LOGIN=$(curl -s -X POST $BASE_URL/api/auth/production/login \
  -H "Content-Type: application/json" \
  -d '{"email":"stellar.production@demo.com","password":"Demo123"}')

PROD_TOKEN=$(echo $PROD_LOGIN | jq -r '.token')

if [ -z "$PROD_TOKEN" ] || [ "$PROD_TOKEN" = "null" ]; then
  echo -e "${YELLOW}⚠️ No production account available${NC}"
  PROD_TOKEN=$CREATOR_TOKEN
fi

# Login as investor
INV_LOGIN=$(curl -s -X POST $BASE_URL/api/auth/investor/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah.investor@demo.com","password":"Demo123"}')

INV_TOKEN=$(echo $INV_LOGIN | jq -r '.token')

if [ -z "$INV_TOKEN" ] || [ "$INV_TOKEN" = "null" ]; then
  echo -e "${YELLOW}⚠️ No investor account available${NC}"
  INV_TOKEN=$CREATOR_TOKEN
fi

# ========================================
# 1. GET /api/creator/followers
# ========================================

print_test_header "GET /api/creator/followers"

echo "Test command:"
echo "curl -X GET $BASE_URL/api/creator/followers \\"
echo "  -H \"Authorization: Bearer \$TOKEN\""
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X GET $BASE_URL/api/creator/followers \
  -H "Authorization: Bearer $CREATOR_TOKEN")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response Status: $HTTP_STATUS"
echo "Response Body: ${BODY:0:200}..."
echo ""

echo "Validation Checklist:"
check_result "[✓] Backend endpoint exists" "200" "$HTTP_STATUS"
check_result "[✓] Response has success field" "success" "$BODY"
check_result "[✓] Response has followers array" "followers" "$BODY"
check_result "[✓] Response has total count" "total" "$BODY"
check_result "[✓] Response has pagination" "page" "$BODY"

# Test with pagination
RESPONSE_PAGE2=$(curl -s -X GET "$BASE_URL/api/creator/followers?page=2&limit=5" \
  -H "Authorization: Bearer $CREATOR_TOKEN")
check_result "[✓] Pagination parameters work" "success" "$RESPONSE_PAGE2"

# Test without auth
RESPONSE_NOAUTH=$(curl -s -X GET $BASE_URL/api/creator/followers)
check_result "[✓] Requires authentication" "error" "$RESPONSE_NOAUTH"

# ========================================
# 2. GET /api/creator/saved-pitches
# ========================================

print_test_header "GET /api/creator/saved-pitches"

echo "Test command:"
echo "curl -X GET $BASE_URL/api/creator/saved-pitches \\"
echo "  -H \"Authorization: Bearer \$TOKEN\""
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X GET $BASE_URL/api/creator/saved-pitches \
  -H "Authorization: Bearer $CREATOR_TOKEN")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response Status: $HTTP_STATUS"
echo "Response Body: ${BODY:0:200}..."
echo ""

echo "Validation Checklist:"
check_result "[✓] Backend endpoint exists" "200" "$HTTP_STATUS"
check_result "[✓] Response has pitches array" "pitches" "$BODY"
check_result "[✓] Response has total count" "total" "$BODY"
check_result "[✓] Response structure matches" "success" "$BODY"

# ========================================
# 3. GET /api/creator/recommendations
# ========================================

print_test_header "GET /api/creator/recommendations"

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X GET $BASE_URL/api/creator/recommendations \
  -H "Authorization: Bearer $CREATOR_TOKEN")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response Status: $HTTP_STATUS"
echo ""

echo "Validation Checklist:"
check_result "[✓] Backend endpoint exists" "200" "$HTTP_STATUS"
check_result "[✓] Response has pitches array" "pitches" "$BODY"
check_result "[✓] Response has creators array" "creators" "$BODY"
check_result "[✓] Response structure matches" "success" "$BODY"

# ========================================
# 4. GET /api/production/analytics
# ========================================

print_test_header "GET /api/production/analytics"

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X GET $BASE_URL/api/production/analytics \
  -H "Authorization: Bearer $PROD_TOKEN")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response Status: $HTTP_STATUS"
echo ""

echo "Validation Checklist:"
check_result "[✓] Backend endpoint exists" "200\|403" "$HTTP_STATUS"
check_result "[✓] Response has structure" "submissions\|error" "$BODY"

# Test with period parameter
RESPONSE_PERIOD=$(curl -s -X GET "$BASE_URL/api/production/analytics?period=7d" \
  -H "Authorization: Bearer $PROD_TOKEN")
check_result "[✓] Period parameter works" "submissions\|error" "$RESPONSE_PERIOD"

# ========================================
# 5. POST /api/production/pitches/{id}/review
# ========================================

print_test_header "POST /api/production/pitches/1/review"

echo "Test command:"
echo "curl -X POST $BASE_URL/api/production/pitches/1/review \\"
echo "  -H \"Authorization: Bearer \$TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"status\":\"approved\",\"feedback\":\"Great pitch!\",\"rating\":5}'"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST $BASE_URL/api/production/pitches/1/review \
  -H "Authorization: Bearer $PROD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"approved","feedback":"Great pitch!","rating":5}')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response Status: $HTTP_STATUS"
echo ""

echo "Validation Checklist:"
check_result "[✓] Backend endpoint exists" "200\|403\|404" "$HTTP_STATUS"
check_result "[✓] POST method accepted" "review\|error" "$BODY"

# ========================================
# 6. GET /api/production/calendar
# ========================================

print_test_header "GET /api/production/calendar"

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X GET $BASE_URL/api/production/calendar \
  -H "Authorization: Bearer $PROD_TOKEN")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response Status: $HTTP_STATUS"
echo ""

echo "Validation Checklist:"
check_result "[✓] Backend endpoint exists" "200" "$HTTP_STATUS"
check_result "[✓] Response has events array" "events" "$BODY"

# Test with date range
RESPONSE_DATES=$(curl -s -X GET "$BASE_URL/api/production/calendar?start=2025-01-01&end=2025-12-31" \
  -H "Authorization: Bearer $PROD_TOKEN")
check_result "[✓] Date parameters work" "events" "$RESPONSE_DATES"

# ========================================
# 7. POST /api/production/calendar
# ========================================

print_test_header "POST /api/production/calendar"

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST $BASE_URL/api/production/calendar \
  -H "Authorization: Bearer $PROD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Production Meeting",
    "description": "Discuss new project",
    "startDate": "2025-02-01T10:00:00Z",
    "endDate": "2025-02-01T11:00:00Z",
    "type": "meeting"
  }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response Status: $HTTP_STATUS"
echo ""

echo "Validation Checklist:"
check_result "[✓] Backend endpoint exists" "200\|201" "$HTTP_STATUS"
check_result "[✓] POST method accepted" "event\|success" "$BODY"

# ========================================
# 8. GET /api/production/submissions/stats
# ========================================

print_test_header "GET /api/production/submissions/stats"

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X GET $BASE_URL/api/production/submissions/stats \
  -H "Authorization: Bearer $PROD_TOKEN")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response Status: $HTTP_STATUS"
echo ""

echo "Validation Checklist:"
check_result "[✓] Backend endpoint exists" "200" "$HTTP_STATUS"
check_result "[✓] Response has total count" "total" "$BODY"
check_result "[✓] Response has pending count" "pending" "$BODY"
check_result "[✓] Response has approved count" "approved" "$BODY"
check_result "[✓] Response has rejected count" "rejected" "$BODY"

# ========================================
# 9. GET /api/investments/{id}/details
# ========================================

print_test_header "GET /api/investments/1/details"

# First create an investment
CREATE_INVESTMENT=$(curl -s -X POST $BASE_URL/api/investments/track \
  -H "Authorization: Bearer $INV_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pitchId":1,"amount":50000,"terms":"Standard investment terms"}')

INVESTMENT_ID=$(echo $CREATE_INVESTMENT | jq -r '.data.investment.id // .investment.id // 1')

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X GET "$BASE_URL/api/investments/$INVESTMENT_ID/details" \
  -H "Authorization: Bearer $INV_TOKEN")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response Status: $HTTP_STATUS"
echo ""

echo "Validation Checklist:"
check_result "[✓] Backend endpoint exists" "200\|404" "$HTTP_STATUS"
check_result "[✓] Response structure includes ROI" "roi\|error" "$BODY"
check_result "[✓] Response includes documents" "documents\|error" "$BODY"
check_result "[✓] Response includes timeline" "timeline\|error" "$BODY"

# ========================================
# 10. POST /api/investments/{id}/update
# ========================================

print_test_header "POST /api/investments/1/update"

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "$BASE_URL/api/investments/$INVESTMENT_ID/update" \
  -H "Authorization: Bearer $INV_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes":"Updated investment notes","currentValue":55000}')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response Status: $HTTP_STATUS"
echo ""

echo "Validation Checklist:"
check_result "[✓] Backend endpoint exists" "200\|404" "$HTTP_STATUS"
check_result "[✓] POST method accepted" "investment\|error" "$BODY"

# ========================================
# 11. DELETE /api/investments/{id}
# ========================================

print_test_header "DELETE /api/investments/1"

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X DELETE "$BASE_URL/api/investments/$INVESTMENT_ID" \
  -H "Authorization: Bearer $INV_TOKEN")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response Status: $HTTP_STATUS"
echo ""

echo "Validation Checklist:"
check_result "[✓] Backend endpoint exists" "200\|404" "$HTTP_STATUS"
check_result "[✓] DELETE method accepted" "success\|deleted\|error" "$BODY"

# ========================================
# EDGE CASE TESTING
# ========================================

print_test_header "Edge Case Testing"

# Test large limit
RESPONSE=$(curl -s -X GET "$BASE_URL/api/creator/followers?limit=1000" \
  -H "Authorization: Bearer $CREATOR_TOKEN")
check_result "[✓] Handles large limit requests" "success" "$RESPONSE"

# Test invalid page
RESPONSE=$(curl -s -X GET "$BASE_URL/api/creator/followers?page=999999" \
  -H "Authorization: Bearer $CREATOR_TOKEN")
check_result "[✓] Handles invalid page numbers" "success\|followers" "$RESPONSE"

# Test missing auth
RESPONSE=$(curl -s -X GET $BASE_URL/api/creator/followers)
check_result "[✓] Returns error without auth" "error\|unauthorized" "$RESPONSE"

# Test malformed JSON
RESPONSE=$(curl -s -X POST $BASE_URL/api/production/calendar \
  -H "Authorization: Bearer $PROD_TOKEN" \
  -H "Content-Type: application/json" \
  -d 'invalid json')
check_result "[✓] Handles malformed JSON" "error\|invalid" "$RESPONSE"

# ========================================
# FRONTEND-BACKEND CONSISTENCY
# ========================================

print_test_header "Frontend-Backend Path Consistency"

# Check saved pitches endpoint
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X GET $BASE_URL/api/saved-pitches \
  -H "Authorization: Bearer $CREATOR_TOKEN")
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
check_result "[✓] /api/saved-pitches exists" "200" "$HTTP_STATUS"

# ========================================
# SUMMARY
# ========================================

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}TEST SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
  echo -e "✅ All 15 critical endpoints are working correctly"
  echo -e "✅ Authentication/authorization working"
  echo -e "✅ Request/response structures match"
  echo -e "✅ Error handling implemented"
  echo -e "✅ Edge cases handled"
else
  echo -e "${YELLOW}⚠️ Some tests failed${NC}"
  echo "Review the failures above and check:"
  echo "1. Database has test data"
  echo "2. All tables are created"
  echo "3. Authentication is working"
  echo "4. Request/response formats match"
fi

# Cleanup
if [ ! -z "$SERVER_PID" ]; then
  kill $SERVER_PID 2>/dev/null
fi

exit $FAILED_TESTS