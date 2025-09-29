#!/bin/bash

API_URL="http://localhost:8001"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== TESTING ALL WORKFLOWS ===${NC}"
echo ""

# 1. Test Creator Login
echo -e "${YELLOW}1. CREATOR LOGIN TEST${NC}"
echo "------------------------"
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}')

if echo "$LOGIN_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')
    USER_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.user.id')
    echo -e "  ${GREEN}✅${NC} Login successful"
    echo "  User ID: $USER_ID"
    echo "  Token: ${TOKEN:0:20}..."
else
    echo -e "  ${RED}❌${NC} Login failed"
    echo "$LOGIN_RESPONSE" | jq
    exit 1
fi
echo ""

# 2. Dashboard Stats (will be retrieved from pitches endpoint)
echo -e "${YELLOW}2. DASHBOARD STATS${NC}"
echo "------------------------"
echo -e "  ${YELLOW}ℹ${NC} Stats will be retrieved from pitches endpoint"
echo ""

# 3. Get Creator's Pitches
echo -e "${YELLOW}3. MANAGE PITCHES - LIST${NC}"
echo "------------------------"
PITCHES_RESPONSE=$(curl -s "${API_URL}/api/creator/pitches" \
  -H "Authorization: Bearer $TOKEN")

if echo "$PITCHES_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    PITCH_COUNT=$(echo "$PITCHES_RESPONSE" | jq '.data.pitches | length')
    echo -e "  ${GREEN}✅${NC} Pitches retrieved: $PITCH_COUNT"
    
    # Get stats from response
    TOTAL_FROM_STATS=$(echo "$PITCHES_RESPONSE" | jq -r '.data.stats.totalPitches // 0')
    PUBLISHED_FROM_STATS=$(echo "$PITCHES_RESPONSE" | jq -r '.data.stats.publishedPitches // 0')
    
    # List first 3 pitches
    echo "  Pitches:"
    for i in 0 1 2; do
        TITLE=$(echo "$PITCHES_RESPONSE" | jq -r ".data.pitches[$i].title" 2>/dev/null)
        ID=$(echo "$PITCHES_RESPONSE" | jq -r ".data.pitches[$i].id" 2>/dev/null)
        STATUS=$(echo "$PITCHES_RESPONSE" | jq -r ".data.pitches[$i].status" 2>/dev/null)
        if [ "$TITLE" != "null" ] && [ ! -z "$TITLE" ]; then
            echo "    • ID: $ID - $TITLE (Status: $STATUS)"
        fi
    done
    
    # Save first pitch ID for editing test
    FIRST_PITCH_ID=$(echo "$PITCHES_RESPONSE" | jq -r '.data.pitches[0].id' 2>/dev/null)
else
    echo -e "  ${RED}❌${NC} Failed to get pitches"
    echo "$PITCHES_RESPONSE" | jq
fi
echo ""

# 4. Create New Pitch
echo -e "${YELLOW}4. CREATE NEW PITCH${NC}"
echo "------------------------"
TIMESTAMP=$(date +%s)
NEW_PITCH=$(cat <<JSON
{
  "title": "Test Pitch Created $TIMESTAMP",
  "logline": "A test pitch to verify the creation workflow is working properly",
  "genre": "drama",
  "format": "feature",
  "shortSynopsis": "This is a comprehensive test of the pitch creation system",
  "themes": ["technology", "testing"],
  "budgetBracket": "low",
  "estimatedBudget": 100000,
  "productionTimeline": "Q2 2025",
  "requireNDA": false
}
JSON
)

CREATE_RESPONSE=$(curl -s -X POST "${API_URL}/api/creator/pitches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$NEW_PITCH")

if echo "$CREATE_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    NEW_PITCH_ID=$(echo "$CREATE_RESPONSE" | jq -r '.data.id')
    echo -e "  ${GREEN}✅${NC} Pitch created successfully"
    echo "  New Pitch ID: $NEW_PITCH_ID"
else
    echo -e "  ${RED}❌${NC} Failed to create pitch"
    echo "$CREATE_RESPONSE" | jq
fi
echo ""

# 5. Edit Existing Pitch
if [ ! -z "$FIRST_PITCH_ID" ] && [ "$FIRST_PITCH_ID" != "null" ]; then
    echo -e "${YELLOW}5. EDIT PITCH${NC}"
    echo "------------------------"
    EDIT_DATA=$(cat <<JSON
{
  "tagline": "Updated tagline at $(date)"
}
JSON
)
    
    EDIT_RESPONSE=$(curl -s -X PUT "${API_URL}/api/creator/pitches/${FIRST_PITCH_ID}" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$EDIT_DATA")
    
    if echo "$EDIT_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
        echo -e "  ${GREEN}✅${NC} Pitch edited successfully"
        echo "  Edited Pitch ID: $FIRST_PITCH_ID"
    else
        echo -e "  ${RED}❌${NC} Failed to edit pitch"
        echo "$EDIT_RESPONSE" | jq
    fi
else
    echo -e "${YELLOW}5. EDIT PITCH${NC}"
    echo "------------------------"
    echo -e "  ${YELLOW}⚠${NC} No pitch available to edit"
fi
echo ""

# 6. Check NDA Requests for a published pitch
echo -e "${YELLOW}6. NDA REQUESTS - LIST${NC}"
echo "------------------------"
# Find a published pitch that requires NDA
PUBLISHED_PITCH_ID=$(echo "$PITCHES_RESPONSE" | jq -r '.data.pitches[] | select(.status == "published" and .requireNDA == true) | .id' 2>/dev/null | head -1)

if [ ! -z "$PUBLISHED_PITCH_ID" ] && [ "$PUBLISHED_PITCH_ID" != "null" ]; then
    NDA_LIST_RESPONSE=$(curl -s "${API_URL}/api/nda-requests/creator/${PUBLISHED_PITCH_ID}" \
      -H "Authorization: Bearer $TOKEN")
    
    if echo "$NDA_LIST_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
        NDA_COUNT=$(echo "$NDA_LIST_RESPONSE" | jq '.data | length')
        echo -e "  ${GREEN}✅${NC} NDA requests retrieved: $NDA_COUNT"
        if [ "$NDA_COUNT" -gt 0 ]; then
            echo "  NDA Requests:"
            for i in 0 1 2; do
                REQUESTER=$(echo "$NDA_LIST_RESPONSE" | jq -r ".data[$i].requesterName" 2>/dev/null)
                STATUS=$(echo "$NDA_LIST_RESPONSE" | jq -r ".data[$i].status" 2>/dev/null)
                if [ "$REQUESTER" != "null" ] && [ ! -z "$REQUESTER" ]; then
                    echo "    • $REQUESTER (Status: $STATUS)"
                fi
            done
        fi
    else
        echo -e "  ${RED}❌${NC} Failed to get NDA requests"
        echo "$NDA_LIST_RESPONSE" | jq
    fi
else
    echo -e "  ${YELLOW}⚠${NC} No published pitch available for NDA check"
fi
echo ""

# 7. Test Investor Login and NDA Request
echo -e "${YELLOW}7. INVESTOR NDA REQUEST${NC}"
echo "------------------------"
INVESTOR_LOGIN=$(curl -s -X POST "${API_URL}/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah.investor@demo.com","password":"Demo123"}')

if echo "$INVESTOR_LOGIN" | jq -e '.success' > /dev/null 2>&1; then
    INVESTOR_TOKEN=$(echo "$INVESTOR_LOGIN" | jq -r '.token')
    INVESTOR_ID=$(echo "$INVESTOR_LOGIN" | jq -r '.user.id')
    echo -e "  ${GREEN}✅${NC} Investor login successful"
    
    # Request NDA for a published pitch
    if [ ! -z "$PUBLISHED_PITCH_ID" ] && [ "$PUBLISHED_PITCH_ID" != "null" ]; then
        NDA_REQUEST_DATA=$(cat <<JSON
{
  "pitchId": $PUBLISHED_PITCH_ID,
  "requesterId": $INVESTOR_ID,
  "requesterName": "Jordan Investor",
  "requesterEmail": "jordan.investor@demo.com",
  "companyInfo": {
    "name": "Test Investment Corp",
    "role": "Investment Manager"
  },
  "message": "Interested in reviewing this pitch"
}
JSON
)
        
        NDA_REQUEST_RESPONSE=$(curl -s -X POST "${API_URL}/api/nda-requests" \
          -H "Authorization: Bearer $INVESTOR_TOKEN" \
          -H "Content-Type: application/json" \
          -d "$NDA_REQUEST_DATA")
        
        if echo "$NDA_REQUEST_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
            NDA_REQUEST_ID=$(echo "$NDA_REQUEST_RESPONSE" | jq -r '.data.id')
            echo -e "  ${GREEN}✅${NC} NDA request created"
            echo "  NDA Request ID: $NDA_REQUEST_ID"
        else
            echo -e "  ${RED}❌${NC} Failed to create NDA request"
            echo "$NDA_REQUEST_RESPONSE" | jq
        fi
    fi
else
    echo -e "  ${RED}❌${NC} Investor login failed"
fi
echo ""

# 8. Summary
echo -e "${BLUE}=== WORKFLOW TEST SUMMARY ===${NC}"
echo "Stats from API: $TOTAL_FROM_STATS total pitches ($PUBLISHED_FROM_STATS published)"
echo "Actual pitches returned: $PITCH_COUNT"
if [ "$TOTAL_FROM_STATS" = "$PITCH_COUNT" ]; then
    echo -e "${GREEN}✅ Dashboard count matches actual pitches${NC}"
else
    echo -e "${YELLOW}⚠ Note: Stats show $TOTAL_FROM_STATS but returned $PITCH_COUNT pitches${NC}"
fi

