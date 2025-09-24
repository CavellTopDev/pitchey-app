#!/bin/bash

echo "🔍 Testing Demo Account Workflows"
echo "=================================="
echo ""

BASE_URL="https://pitchey-backend.deno.dev"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
    local METHOD=$1
    local ENDPOINT=$2
    local TOKEN=$3
    local DATA=$4
    local DESC=$5
    
    echo -n "  $DESC: "
    
    if [ "$METHOD" = "GET" ]; then
        RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL$ENDPOINT" \
            -H "Authorization: Bearer $TOKEN")
    elif [ "$METHOD" = "POST" ]; then
        if [ -z "$DATA" ]; then
            RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$ENDPOINT" \
                -H "Authorization: Bearer $TOKEN" \
                -H "Content-Type: application/json")
        else
            RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$ENDPOINT" \
                -H "Authorization: Bearer $TOKEN" \
                -H "Content-Type: application/json" \
                -d "$DATA")
        fi
    fi
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    SUCCESS=$(echo "$BODY" | jq -r '.success' 2>/dev/null)
    
    if [ "$HTTP_CODE" = "200" ] && [ "$SUCCESS" = "true" ]; then
        echo -e "${GREEN}✓ WORKS${NC}"
        return 0
    elif [ "$HTTP_CODE" = "200" ]; then
        ERROR=$(echo "$BODY" | jq -r '.error // "Unknown error"' 2>/dev/null)
        echo -e "${RED}✗ FAILS${NC} - $ERROR"
        return 1
    else
        echo -e "${RED}✗ HTTP $HTTP_CODE${NC}"
        return 1
    fi
}

echo "1️⃣ TESTING CREATOR ACCOUNT (alex.creator@demo.com)"
echo "---------------------------------------------------"

# Login as creator
CREATOR_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/creator/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"alex.creator@demo.com","password":"Demo123"}')

CREATOR_TOKEN=$(echo "$CREATOR_RESPONSE" | jq -r '.token')
CREATOR_ID=$(echo "$CREATOR_RESPONSE" | jq -r '.user.id')

if [ -z "$CREATOR_TOKEN" ] || [ "$CREATOR_TOKEN" = "null" ]; then
    echo -e "${RED}Failed to login as creator${NC}"
else
    echo -e "${GREEN}✓ Login successful${NC} (User ID: $CREATOR_ID)"
    echo ""
    echo "Testing endpoints:"
    
    # Test various endpoints
    test_endpoint "GET" "/api/creator/dashboard" "$CREATOR_TOKEN" "" "Dashboard"
    test_endpoint "GET" "/api/auth/me" "$CREATOR_TOKEN" "" "Get profile"
    test_endpoint "GET" "/api/pitches" "$CREATOR_TOKEN" "" "List pitches"
    test_endpoint "GET" "/api/creator/pitches" "$CREATOR_TOKEN" "" "Creator's pitches"
    test_endpoint "POST" "/api/pitches/create" "$CREATOR_TOKEN" '{"title":"Test Pitch","logline":"Test","genre":"drama","format":"feature"}' "Create pitch"
    test_endpoint "GET" "/api/notifications" "$CREATOR_TOKEN" "" "Notifications"
    test_endpoint "GET" "/api/credits" "$CREATOR_TOKEN" "" "Credits balance"
    test_endpoint "GET" "/api/analytics/overview" "$CREATOR_TOKEN" "" "Analytics"
fi

echo ""
echo "2️⃣ TESTING INVESTOR ACCOUNT (sarah.investor@demo.com)"
echo "-----------------------------------------------------"

# Login as investor
INVESTOR_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/investor/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"sarah.investor@demo.com","password":"Demo123"}')

INVESTOR_TOKEN=$(echo "$INVESTOR_RESPONSE" | jq -r '.token')
INVESTOR_ID=$(echo "$INVESTOR_RESPONSE" | jq -r '.user.id')

if [ -z "$INVESTOR_TOKEN" ] || [ "$INVESTOR_TOKEN" = "null" ]; then
    echo -e "${RED}Failed to login as investor${NC}"
else
    echo -e "${GREEN}✓ Login successful${NC} (User ID: $INVESTOR_ID)"
    echo ""
    echo "Testing endpoints:"
    
    test_endpoint "GET" "/api/investor/dashboard" "$INVESTOR_TOKEN" "" "Dashboard"
    test_endpoint "GET" "/api/auth/me" "$INVESTOR_TOKEN" "" "Get profile"
    test_endpoint "GET" "/api/pitches" "$INVESTOR_TOKEN" "" "Browse pitches"
    test_endpoint "POST" "/api/pitches/1/like" "$INVESTOR_TOKEN" "" "Like pitch"
    test_endpoint "GET" "/api/investor/portfolio" "$INVESTOR_TOKEN" "" "Portfolio"
    test_endpoint "GET" "/api/investor/saved" "$INVESTOR_TOKEN" "" "Saved pitches"
fi

echo ""
echo "3️⃣ TESTING PRODUCTION ACCOUNT (stellar.production@demo.com)"
echo "-----------------------------------------------------------"

# Login as production
PRODUCTION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/production/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"stellar.production@demo.com","password":"Demo123"}')

PRODUCTION_TOKEN=$(echo "$PRODUCTION_RESPONSE" | jq -r '.token')
PRODUCTION_ID=$(echo "$PRODUCTION_RESPONSE" | jq -r '.user.id')

if [ -z "$PRODUCTION_TOKEN" ] || [ "$PRODUCTION_TOKEN" = "null" ]; then
    echo -e "${RED}Failed to login as production${NC}"
else
    echo -e "${GREEN}✓ Login successful${NC} (User ID: $PRODUCTION_ID)"
    echo ""
    echo "Testing endpoints:"
    
    test_endpoint "GET" "/api/production/dashboard" "$PRODUCTION_TOKEN" "" "Dashboard"
    test_endpoint "GET" "/api/auth/me" "$PRODUCTION_TOKEN" "" "Get profile"
    test_endpoint "GET" "/api/pitches" "$PRODUCTION_TOKEN" "" "Browse pitches"
    test_endpoint "GET" "/api/production/projects" "$PRODUCTION_TOKEN" "" "Projects"
    test_endpoint "POST" "/api/ndas/sign" "$PRODUCTION_TOKEN" '{"pitchId":1}' "Sign NDA"
fi

echo ""
echo "4️⃣ TESTING PUBLIC ENDPOINTS (No Auth)"
echo "-------------------------------------"
echo -n "  Public pitches: "
PUBLIC_RESPONSE=$(curl -s "$BASE_URL/api/public/pitches")
PUBLIC_SUCCESS=$(echo "$PUBLIC_RESPONSE" | jq -r '.success' 2>/dev/null)
if [ "$PUBLIC_SUCCESS" = "true" ]; then
    PITCH_COUNT=$(echo "$PUBLIC_RESPONSE" | jq -r '.pitches | length' 2>/dev/null)
    echo -e "${GREEN}✓ WORKS${NC} ($PITCH_COUNT pitches)"
else
    ERROR=$(echo "$PUBLIC_RESPONSE" | jq -r '.error' 2>/dev/null)
    echo -e "${RED}✗ FAILS${NC} - $ERROR"
fi

echo ""
echo "=================================="
echo "SUMMARY:"
echo ""

# Summary analysis
echo "Demo accounts can successfully login and receive JWT tokens."
echo "However, most authenticated endpoints fail with 'Invalid session'"
echo "because they expect database sessions, not just JWT tokens."
echo ""
echo "This means demo accounts currently CANNOT:"
echo "  - View dashboards"
echo "  - Create or manage pitches"
echo "  - Access analytics"
echo "  - Use most application features"
echo ""
echo "RECOMMENDATION: Update authentication to support JWT-only validation"
echo "for demo accounts, or create database sessions on demo login."
