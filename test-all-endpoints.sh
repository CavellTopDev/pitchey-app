#!/bin/bash

echo "🎯 Comprehensive API Endpoint Testing"
echo "======================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_URL="http://localhost:8001"
PASS_COUNT=0
FAIL_COUNT=0

# Test function
test_endpoint() {
    local METHOD=$1
    local ENDPOINT=$2
    local DESCRIPTION=$3
    local DATA=$4
    local TOKEN=$5
    
    if [ -z "$DATA" ]; then
        if [ -z "$TOKEN" ]; then
            RESPONSE=$(curl -s -X $METHOD $API_URL$ENDPOINT -H "Content-Type: application/json" -w "\n%{http_code}")
        else
            RESPONSE=$(curl -s -X $METHOD $API_URL$ENDPOINT -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -w "\n%{http_code}")
        fi
    else
        if [ -z "$TOKEN" ]; then
            RESPONSE=$(curl -s -X $METHOD $API_URL$ENDPOINT -H "Content-Type: application/json" -d "$DATA" -w "\n%{http_code}")
        else
            RESPONSE=$(curl -s -X $METHOD $API_URL$ENDPOINT -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "$DATA" -w "\n%{http_code}")
        fi
    fi
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
    BODY=$(echo "$RESPONSE" | head -n -1)
    
    if [[ "$HTTP_CODE" == "200" ]] || [[ "$HTTP_CODE" == "201" ]]; then
        echo -e "  ${GREEN}✅${NC} $DESCRIPTION"
        ((PASS_COUNT++))
        return 0
    else
        echo -e "  ${RED}❌${NC} $DESCRIPTION (HTTP $HTTP_CODE)"
        if echo "$BODY" | jq -e '.error' > /dev/null 2>&1; then
            ERROR=$(echo "$BODY" | jq -r '.error')
            echo -e "      ${RED}Error: $ERROR${NC}"
        fi
        ((FAIL_COUNT++))
        return 1
    fi
}

# ============================================
# 1. PUBLIC ENDPOINTS
# ============================================
echo -e "\n${BLUE}1. PUBLIC ENDPOINTS${NC}"
echo "--------------------"

test_endpoint "GET" "/api/health" "Health check"
test_endpoint "GET" "/api/version" "Version info"
test_endpoint "GET" "/api/pitches/public" "Public pitches list"
test_endpoint "GET" "/api/pitches/new" "New pitches list"
test_endpoint "GET" "/api/pitches" "All pitches"
test_endpoint "GET" "/api/pitches/7" "Single pitch by ID"

# ============================================
# 2. AUTHENTICATION ENDPOINTS
# ============================================
echo -e "\n${BLUE}2. AUTHENTICATION${NC}"
echo "------------------"

# Creator Login
CREATOR_LOGIN=$(curl -s -X POST $API_URL/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alex.creator@demo.com", "password": "Demo123"}')

if echo "$CREATOR_LOGIN" | jq -e '.token' > /dev/null 2>&1; then
    CREATOR_TOKEN=$(echo "$CREATOR_LOGIN" | jq -r '.token')
    CREATOR_ID=$(echo "$CREATOR_LOGIN" | jq -r '.user.id')
    echo -e "  ${GREEN}✅${NC} Creator login successful (ID: $CREATOR_ID)"
    ((PASS_COUNT++))
else
    echo -e "  ${RED}❌${NC} Creator login failed"
    ((FAIL_COUNT++))
fi

# Investor Login
INVESTOR_LOGIN=$(curl -s -X POST $API_URL/api/auth/investor/login \
  -H "Content-Type: application/json" \
  -d '{"email": "sarah.investor@demo.com", "password": "Demo123"}')

if echo "$INVESTOR_LOGIN" | jq -e '.token' > /dev/null 2>&1; then
    INVESTOR_TOKEN=$(echo "$INVESTOR_LOGIN" | jq -r '.token')
    INVESTOR_ID=$(echo "$INVESTOR_LOGIN" | jq -r '.user.id')
    echo -e "  ${GREEN}✅${NC} Investor login successful (ID: $INVESTOR_ID)"
    ((PASS_COUNT++))
else
    echo -e "  ${RED}❌${NC} Investor login failed"
    ((FAIL_COUNT++))
fi

# Production Login
PRODUCTION_LOGIN=$(curl -s -X POST $API_URL/api/auth/production/login \
  -H "Content-Type: application/json" \
  -d '{"email": "stellar.production@demo.com", "password": "Demo123"}')

if echo "$PRODUCTION_LOGIN" | jq -e '.token' > /dev/null 2>&1; then
    PRODUCTION_TOKEN=$(echo "$PRODUCTION_LOGIN" | jq -r '.token')
    PRODUCTION_ID=$(echo "$PRODUCTION_LOGIN" | jq -r '.user.id')
    echo -e "  ${GREEN}✅${NC} Production login successful (ID: $PRODUCTION_ID)"
    ((PASS_COUNT++))
else
    echo -e "  ${RED}❌${NC} Production login failed"
    ((FAIL_COUNT++))
fi

# ============================================
# 3. CREATOR ENDPOINTS
# ============================================
echo -e "\n${BLUE}3. CREATOR ENDPOINTS${NC}"
echo "---------------------"

test_endpoint "GET" "/api/creator/dashboard" "Creator dashboard" "" "$CREATOR_TOKEN"
test_endpoint "GET" "/api/creator/pitches" "Creator pitches list" "" "$CREATOR_TOKEN"

# Create a new pitch
NEW_PITCH_DATA='{
  "title": "Test Pitch '$(date +%s)'",
  "logline": "A test pitch created for endpoint testing",
  "genre": "action",
  "format": "feature",
  "shortSynopsis": "This is a test pitch",
  "targetAudience": "General audience",
  "estimatedBudget": 1000000
}'

CREATE_PITCH=$(curl -s -X POST $API_URL/api/creator/pitches \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -d "$NEW_PITCH_DATA")

if echo "$CREATE_PITCH" | jq -e '.data.pitch.id' > /dev/null 2>&1; then
    NEW_PITCH_ID=$(echo "$CREATE_PITCH" | jq -r '.data.pitch.id')
    echo -e "  ${GREEN}✅${NC} Create pitch (ID: $NEW_PITCH_ID)"
    ((PASS_COUNT++))
    
    # Test update
    UPDATE_DATA='{"title": "Updated Test Pitch"}'
    test_endpoint "PUT" "/api/creator/pitches/$NEW_PITCH_ID" "Update pitch" "$UPDATE_DATA" "$CREATOR_TOKEN"
    
    # Test publish
    test_endpoint "POST" "/api/creator/pitches/$NEW_PITCH_ID/publish" "Publish pitch" "{}" "$CREATOR_TOKEN"
    
    # Test delete
    test_endpoint "DELETE" "/api/creator/pitches/$NEW_PITCH_ID" "Delete pitch" "" "$CREATOR_TOKEN"
else
    echo -e "  ${RED}❌${NC} Create pitch failed"
    ((FAIL_COUNT++))
fi

# ============================================
# 4. INVESTOR ENDPOINTS
# ============================================
echo -e "\n${BLUE}4. INVESTOR ENDPOINTS${NC}"
echo "----------------------"

test_endpoint "GET" "/api/investor/dashboard" "Investor dashboard" "" "$INVESTOR_TOKEN"
test_endpoint "GET" "/api/investor/portfolio" "Investor portfolio" "" "$INVESTOR_TOKEN"
test_endpoint "GET" "/api/investor/watchlist" "Investor watchlist" "" "$INVESTOR_TOKEN"

# Add to watchlist
test_endpoint "POST" "/api/investor/watchlist" "Add to watchlist" '{"pitchId": 7}' "$INVESTOR_TOKEN"

# Remove from watchlist
test_endpoint "DELETE" "/api/investor/watchlist/7" "Remove from watchlist" "" "$INVESTOR_TOKEN"

# ============================================
# 5. PRODUCTION ENDPOINTS
# ============================================
echo -e "\n${BLUE}5. PRODUCTION ENDPOINTS${NC}"
echo "------------------------"

test_endpoint "GET" "/api/production/dashboard" "Production dashboard" "" "$PRODUCTION_TOKEN"
test_endpoint "GET" "/api/production/projects" "Production projects" "" "$PRODUCTION_TOKEN"
test_endpoint "GET" "/api/production/submissions" "Production submissions" "" "$PRODUCTION_TOKEN"

# Create a project
PROJECT_DATA='{
  "title": "Production Project '$(date +%s)'",
  "logline": "A production company project",
  "genre": "drama",
  "format": "tv",
  "shortSynopsis": "Production project test"
}'

CREATE_PROJECT=$(curl -s -X POST $API_URL/api/production/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PRODUCTION_TOKEN" \
  -d "$PROJECT_DATA")

if echo "$CREATE_PROJECT" | jq -e '.data.project.id' > /dev/null 2>&1; then
    PROJECT_ID=$(echo "$CREATE_PROJECT" | jq -r '.data.project.id')
    echo -e "  ${GREEN}✅${NC} Create project (ID: $PROJECT_ID)"
    ((PASS_COUNT++))
    
    # Update and delete
    test_endpoint "PUT" "/api/production/projects/$PROJECT_ID" "Update project" '{"title": "Updated Project"}' "$PRODUCTION_TOKEN"
    test_endpoint "DELETE" "/api/production/projects/$PROJECT_ID" "Delete project" "" "$PRODUCTION_TOKEN"
else
    echo -e "  ${RED}❌${NC} Create project failed"
    ((FAIL_COUNT++))
fi

# ============================================
# 6. PAYMENT ENDPOINTS
# ============================================
echo -e "\n${BLUE}6. PAYMENT ENDPOINTS${NC}"
echo "---------------------"

test_endpoint "GET" "/api/payments/credits/balance" "Credits balance" "" "$CREATOR_TOKEN"
test_endpoint "GET" "/api/payments/subscription-status" "Subscription status" "" "$CREATOR_TOKEN"

# ============================================
# 7. NDA ENDPOINTS
# ============================================
echo -e "\n${BLUE}7. NDA ENDPOINTS${NC}"
echo "-----------------"

# Create NDA request
NDA_REQUEST_DATA='{
  "pitchId": 8,
  "ndaType": "basic",
  "requestMessage": "I would like to view the full pitch details",
  "companyInfo": {
    "companyName": "Test Investment Corp",
    "position": "Investment Manager",
    "intendedUse": "Investment evaluation"
  }
}'

CREATE_NDA=$(curl -s -X POST $API_URL/api/nda/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $INVESTOR_TOKEN" \
  -d "$NDA_REQUEST_DATA")

if echo "$CREATE_NDA" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅${NC} Create NDA request"
    ((PASS_COUNT++))
else
    echo -e "  ${RED}❌${NC} Create NDA request"
    echo "$CREATE_NDA" | jq '.'
    ((FAIL_COUNT++))
fi

test_endpoint "GET" "/api/nda/pending" "Get pending NDAs" "" "$CREATOR_TOKEN"
test_endpoint "GET" "/api/nda/active" "Get active NDAs" "" "$CREATOR_TOKEN"

# ============================================
# 8. MESSAGING ENDPOINTS
# ============================================
echo -e "\n${BLUE}8. MESSAGING ENDPOINTS${NC}"
echo "-----------------------"

test_endpoint "GET" "/api/messages/conversations" "Get conversations" "" "$CREATOR_TOKEN"

# Create conversation
CONV_DATA='{
  "participantIds": ['"$INVESTOR_ID"'],
  "title": "Test Conversation",
  "type": "direct"
}'

CREATE_CONV=$(curl -s -X POST $API_URL/api/messages/conversations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -d "$CONV_DATA")

if echo "$CREATE_CONV" | jq -e '.conversationId' > /dev/null 2>&1; then
    CONV_ID=$(echo "$CREATE_CONV" | jq -r '.conversationId')
    echo -e "  ${GREEN}✅${NC} Create conversation (ID: $CONV_ID)"
    ((PASS_COUNT++))
    
    # Send message
    MSG_DATA='{"content": "Test message", "type": "text"}'
    test_endpoint "POST" "/api/messages/conversations/$CONV_ID/messages" "Send message" "$MSG_DATA" "$CREATOR_TOKEN"
    
    # Get messages
    test_endpoint "GET" "/api/messages/conversations/$CONV_ID/messages" "Get messages" "" "$CREATOR_TOKEN"
else
    echo -e "  ${RED}❌${NC} Create conversation"
    ((FAIL_COUNT++))
fi

# ============================================
# 9. SEARCH ENDPOINTS
# ============================================
echo -e "\n${BLUE}9. SEARCH ENDPOINTS${NC}"
echo "--------------------"

test_endpoint "GET" "/api/search?q=test" "Search pitches" "" "$CREATOR_TOKEN"
test_endpoint "GET" "/api/search/users?q=alex" "Search users" "" "$CREATOR_TOKEN"

# ============================================
# 10. ANALYTICS ENDPOINTS
# ============================================
echo -e "\n${BLUE}10. ANALYTICS ENDPOINTS${NC}"
echo "------------------------"

test_endpoint "POST" "/api/analytics/track" "Track event" '{"event": "page_view", "data": {"page": "/test"}}' "$CREATOR_TOKEN"
test_endpoint "GET" "/api/analytics/events" "Get analytics events" "" "$CREATOR_TOKEN"

# ============================================
# SUMMARY
# ============================================
echo -e "\n${BLUE}=====================================${NC}"
echo -e "${BLUE}TEST SUMMARY${NC}"
echo -e "${BLUE}=====================================${NC}"
echo -e "${GREEN}✅ Passed: $PASS_COUNT${NC}"
echo -e "${RED}❌ Failed: $FAIL_COUNT${NC}"

TOTAL=$((PASS_COUNT + FAIL_COUNT))
if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All $TOTAL tests passed!${NC}"
else
    PERCENTAGE=$((PASS_COUNT * 100 / TOTAL))
    echo -e "\n${YELLOW}⚠️  $PERCENTAGE% tests passed ($PASS_COUNT/$TOTAL)${NC}"
fi