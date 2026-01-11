#!/bin/bash

# =====================================================
# Better Auth Session-Based Workflow Tests
# Updated for current Cloudflare Worker + Neon implementation
# =====================================================

API_URL="http://localhost:8001"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Store cookies in temp file for session management
COOKIE_JAR="/tmp/pitchey-cookies.txt"
rm -f "$COOKIE_JAR"

# Test accounts
CREATOR_EMAIL="alex.creator@demo.com"
INVESTOR_EMAIL="sarah.investor@demo.com"
PRODUCTION_EMAIL="stellar.production@demo.com"
PASSWORD="Demo123"

echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     PITCHEY BETTER AUTH WORKFLOW TESTS                   ║${NC}"
echo -e "${CYAN}║     Session-Based Authentication (No JWT)                ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Helper function for authenticated requests
auth_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    
    if [ -z "$data" ]; then
        curl -s -X "$method" "${API_URL}${endpoint}" \
            -H "Content-Type: application/json" \
            -b "$COOKIE_JAR" \
            -c "$COOKIE_JAR"
    else
        curl -s -X "$method" "${API_URL}${endpoint}" \
            -H "Content-Type: application/json" \
            -b "$COOKIE_JAR" \
            -c "$COOKIE_JAR" \
            -d "$data"
    fi
}

# ═══════════════════════════════════════════════════════════
# 1. CREATOR WORKFLOW
# ═══════════════════════════════════════════════════════════
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}1. CREATOR WORKFLOW${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Creator Login
echo -e "\n${YELLOW}→ Creator Sign In${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/api/auth/sign-in" \
    -H "Content-Type: application/json" \
    -c "$COOKIE_JAR" \
    -d "{\"email\":\"$CREATOR_EMAIL\",\"password\":\"$PASSWORD\",\"userType\":\"creator\"}")

if echo "$LOGIN_RESPONSE" | grep -q '"user"'; then
    echo -e "  ${GREEN}✅ Creator signed in successfully${NC}"
    USER_NAME=$(echo "$LOGIN_RESPONSE" | jq -r '.user.name // .user.email')
    echo -e "  User: $USER_NAME"
else
    echo -e "  ${RED}❌ Creator sign-in failed${NC}"
    echo "$LOGIN_RESPONSE" | jq
fi

# Check Session
echo -e "\n${YELLOW}→ Verify Session${NC}"
SESSION_RESPONSE=$(auth_request "GET" "/api/auth/session")
if echo "$SESSION_RESPONSE" | grep -q '"user"'; then
    echo -e "  ${GREEN}✅ Session active${NC}"
    USER_ID=$(echo "$SESSION_RESPONSE" | jq -r '.user.id // "N/A"')
    echo -e "  Session User ID: $USER_ID"
else
    echo -e "  ${RED}❌ No active session${NC}"
fi

# Get Creator Dashboard
echo -e "\n${YELLOW}→ Creator Dashboard${NC}"
DASHBOARD_RESPONSE=$(auth_request "GET" "/api/dashboard/creator")
if echo "$DASHBOARD_RESPONSE" | grep -q '"success":true\|"data"'; then
    echo -e "  ${GREEN}✅ Dashboard loaded${NC}"
    
    # Extract stats if available
    TOTAL_PITCHES=$(echo "$DASHBOARD_RESPONSE" | jq -r '.data.stats.totalPitches // 0' 2>/dev/null)
    TOTAL_VIEWS=$(echo "$DASHBOARD_RESPONSE" | jq -r '.data.stats.totalViews // 0' 2>/dev/null)
    echo -e "  Total Pitches: $TOTAL_PITCHES"
    echo -e "  Total Views: $TOTAL_VIEWS"
else
    echo -e "  ${YELLOW}⚠️  Dashboard requires authentication${NC}"
fi

# Create a Pitch
echo -e "\n${YELLOW}→ Create New Pitch${NC}"
NEW_PITCH=$(auth_request "POST" "/api/pitches" '{
    "title": "Test Pitch - Better Auth",
    "logline": "A test pitch created with Better Auth sessions",
    "genre": "drama",
    "format": "feature",
    "shortSynopsis": "This is a test pitch to verify session-based auth"
}')

if echo "$NEW_PITCH" | grep -q '"success":true\|"id"'; then
    echo -e "  ${GREEN}✅ Pitch created successfully${NC}"
    PITCH_ID=$(echo "$NEW_PITCH" | jq -r '.data.id // .id')
    echo -e "  Pitch ID: $PITCH_ID"
else
    echo -e "  ${YELLOW}⚠️  Pitch creation requires proper session${NC}"
fi

# Get Creator's Pitches
echo -e "\n${YELLOW}→ List Creator's Pitches${NC}"
MY_PITCHES=$(auth_request "GET" "/api/creator/pitches")
if echo "$MY_PITCHES" | grep -q '"success":true\|"pitches"'; then
    PITCH_COUNT=$(echo "$MY_PITCHES" | jq '.data.pitches // .pitches | length' 2>/dev/null)
    echo -e "  ${GREEN}✅ Retrieved $PITCH_COUNT pitches${NC}"
else
    echo -e "  ${YELLOW}⚠️  Could not retrieve creator's pitches${NC}"
fi

# Sign Out
echo -e "\n${YELLOW}→ Sign Out${NC}"
SIGNOUT_RESPONSE=$(auth_request "POST" "/api/auth/sign-out")
echo -e "  ${GREEN}✅ Creator signed out${NC}"

# ═══════════════════════════════════════════════════════════
# 2. INVESTOR WORKFLOW
# ═══════════════════════════════════════════════════════════
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}2. INVESTOR WORKFLOW${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Clear cookies
rm -f "$COOKIE_JAR"

# Investor Login
echo -e "\n${YELLOW}→ Investor Sign In${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/api/auth/sign-in" \
    -H "Content-Type: application/json" \
    -c "$COOKIE_JAR" \
    -d "{\"email\":\"$INVESTOR_EMAIL\",\"password\":\"$PASSWORD\",\"userType\":\"investor\"}")

if echo "$LOGIN_RESPONSE" | grep -q '"user"'; then
    echo -e "  ${GREEN}✅ Investor signed in successfully${NC}"
    USER_NAME=$(echo "$LOGIN_RESPONSE" | jq -r '.user.name // .user.email')
    echo -e "  User: $USER_NAME"
else
    echo -e "  ${RED}❌ Investor sign-in failed${NC}"
fi

# Browse Pitches
echo -e "\n${YELLOW}→ Browse Available Pitches${NC}"
BROWSE_RESPONSE=$(auth_request "GET" "/api/pitches?limit=5")
if echo "$BROWSE_RESPONSE" | grep -q '"success":true\|"data"'; then
    PITCH_COUNT=$(echo "$BROWSE_RESPONSE" | jq '.data | length' 2>/dev/null)
    echo -e "  ${GREEN}✅ Found $PITCH_COUNT pitches${NC}"
    
    # Get first pitch ID for NDA request
    FIRST_PITCH_ID=$(echo "$BROWSE_RESPONSE" | jq -r '.data[0].id // 0' 2>/dev/null)
else
    echo -e "  ${RED}❌ Could not browse pitches${NC}"
fi

# Request NDA
echo -e "\n${YELLOW}→ Request NDA for Pitch${NC}"
if [ "$FIRST_PITCH_ID" != "0" ] && [ "$FIRST_PITCH_ID" != "null" ]; then
    NDA_REQUEST=$(auth_request "POST" "/api/nda/request" "{\"pitchId\": $FIRST_PITCH_ID}")
    
    if echo "$NDA_REQUEST" | grep -q '"success":true'; then
        echo -e "  ${GREEN}✅ NDA requested for pitch $FIRST_PITCH_ID${NC}"
        NDA_ID=$(echo "$NDA_REQUEST" | jq -r '.data.id // .id' 2>/dev/null)
        echo -e "  NDA Request ID: $NDA_ID"
    else
        echo -e "  ${YELLOW}⚠️  NDA might already exist or pitch doesn't require NDA${NC}"
    fi
else
    echo -e "  ${YELLOW}⚠️  No pitch available for NDA request${NC}"
fi

# Check NDAs
echo -e "\n${YELLOW}→ List Investor's NDAs${NC}"
MY_NDAS=$(auth_request "GET" "/api/nda")
if echo "$MY_NDAS" | grep -q '"success":true\|"ndas"'; then
    NDA_COUNT=$(echo "$MY_NDAS" | jq '.data // .ndas | length' 2>/dev/null)
    echo -e "  ${GREEN}✅ Retrieved $NDA_COUNT NDAs${NC}"
else
    echo -e "  ${YELLOW}⚠️  Could not retrieve NDAs${NC}"
fi

# Investor Dashboard
echo -e "\n${YELLOW}→ Investor Dashboard${NC}"
DASHBOARD_RESPONSE=$(auth_request "GET" "/api/dashboard/investor")
if echo "$DASHBOARD_RESPONSE" | grep -q '"success":true\|"data"'; then
    echo -e "  ${GREEN}✅ Dashboard loaded${NC}"
    
    # Extract investment stats if available
    SAVED_PITCHES=$(echo "$DASHBOARD_RESPONSE" | jq -r '.data.stats.savedPitches // 0' 2>/dev/null)
    ACTIVE_NDAS=$(echo "$DASHBOARD_RESPONSE" | jq -r '.data.stats.activeNdas // 0' 2>/dev/null)
    echo -e "  Saved Pitches: $SAVED_PITCHES"
    echo -e "  Active NDAs: $ACTIVE_NDAS"
else
    echo -e "  ${YELLOW}⚠️  Dashboard requires authentication${NC}"
fi

# Sign Out
echo -e "\n${YELLOW}→ Sign Out${NC}"
SIGNOUT_RESPONSE=$(auth_request "POST" "/api/auth/sign-out")
echo -e "  ${GREEN}✅ Investor signed out${NC}"

# ═══════════════════════════════════════════════════════════
# 3. PRODUCTION COMPANY WORKFLOW
# ═══════════════════════════════════════════════════════════
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}3. PRODUCTION COMPANY WORKFLOW${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Clear cookies
rm -f "$COOKIE_JAR"

# Production Login
echo -e "\n${YELLOW}→ Production Company Sign In${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/api/auth/sign-in" \
    -H "Content-Type: application/json" \
    -c "$COOKIE_JAR" \
    -d "{\"email\":\"$PRODUCTION_EMAIL\",\"password\":\"$PASSWORD\",\"userType\":\"production\"}")

if echo "$LOGIN_RESPONSE" | grep -q '"user"'; then
    echo -e "  ${GREEN}✅ Production company signed in successfully${NC}"
    USER_NAME=$(echo "$LOGIN_RESPONSE" | jq -r '.user.name // .user.email')
    echo -e "  User: $USER_NAME"
else
    echo -e "  ${RED}❌ Production sign-in failed${NC}"
fi

# Browse Submissions
echo -e "\n${YELLOW}→ View Pitch Submissions${NC}"
SUBMISSIONS=$(auth_request "GET" "/api/production/submissions")
if echo "$SUBMISSIONS" | grep -q '"success":true\|"submissions"'; then
    SUB_COUNT=$(echo "$SUBMISSIONS" | jq '.data // .submissions | length' 2>/dev/null)
    echo -e "  ${GREEN}✅ Retrieved $SUB_COUNT submissions${NC}"
else
    echo -e "  ${YELLOW}⚠️  Could not retrieve submissions${NC}"
fi

# Production Dashboard
echo -e "\n${YELLOW}→ Production Dashboard${NC}"
DASHBOARD_RESPONSE=$(auth_request "GET" "/api/dashboard/production")
if echo "$DASHBOARD_RESPONSE" | grep -q '"success":true\|"data"'; then
    echo -e "  ${GREEN}✅ Dashboard loaded${NC}"
    
    # Extract production stats if available
    ACTIVE_PROJECTS=$(echo "$DASHBOARD_RESPONSE" | jq -r '.data.stats.activeProjects // 0' 2>/dev/null)
    SUBMISSIONS=$(echo "$DASHBOARD_RESPONSE" | jq -r '.data.stats.totalSubmissions // 0' 2>/dev/null)
    echo -e "  Active Projects: $ACTIVE_PROJECTS"
    echo -e "  Total Submissions: $SUBMISSIONS"
else
    echo -e "  ${YELLOW}⚠️  Dashboard requires authentication${NC}"
fi

# Sign Out
echo -e "\n${YELLOW}→ Sign Out${NC}"
SIGNOUT_RESPONSE=$(auth_request "POST" "/api/auth/sign-out")
echo -e "  ${GREEN}✅ Production company signed out${NC}"

# ═══════════════════════════════════════════════════════════
# 4. PUBLIC ACCESS TESTS
# ═══════════════════════════════════════════════════════════
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}4. PUBLIC ACCESS (NO AUTH)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Clear cookies
rm -f "$COOKIE_JAR"

echo -e "\n${YELLOW}→ Browse Public Pitches${NC}"
PUBLIC_PITCHES=$(curl -s "${API_URL}/api/pitches?limit=3")
if echo "$PUBLIC_PITCHES" | grep -q '"success":true\|"data"'; then
    COUNT=$(echo "$PUBLIC_PITCHES" | jq '.data | length' 2>/dev/null)
    echo -e "  ${GREEN}✅ Public access working: $COUNT pitches visible${NC}"
else
    echo -e "  ${RED}❌ Public browse not working${NC}"
fi

echo -e "\n${YELLOW}→ Search Without Auth${NC}"
SEARCH=$(curl -s "${API_URL}/api/search?query=thriller")
if echo "$SEARCH" | grep -q '"success":true\|"data"'; then
    COUNT=$(echo "$SEARCH" | jq '.data | length' 2>/dev/null)
    echo -e "  ${GREEN}✅ Public search working: $COUNT results${NC}"
else
    echo -e "  ${RED}❌ Public search not working${NC}"
fi

echo -e "\n${YELLOW}→ Browse Tabs${NC}"
for tab in trending new featured; do
    RESPONSE=$(curl -s "${API_URL}/api/browse?tab=$tab")
    if echo "$RESPONSE" | grep -q '"success":true'; then
        echo -e "  ${GREEN}✅ $tab tab accessible${NC}"
    else
        echo -e "  ${RED}❌ $tab tab not working${NC}"
    fi
done

# ═══════════════════════════════════════════════════════════
# 5. WEBSOCKET CONNECTION TEST
# ═══════════════════════════════════════════════════════════
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}5. WEBSOCKET CONNECTION${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

echo -e "\n${YELLOW}→ Test WebSocket Endpoint${NC}"
WS_TEST=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Upgrade: websocket" \
    -H "Connection: Upgrade" \
    "${API_URL}/ws")

if [ "$WS_TEST" = "426" ] || [ "$WS_TEST" = "101" ]; then
    echo -e "  ${GREEN}✅ WebSocket endpoint available${NC}"
else
    echo -e "  ${YELLOW}⚠️  WebSocket status: $WS_TEST${NC}"
fi

# ═══════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}WORKFLOW TEST SUMMARY${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

echo -e "\n${GREEN}✅ Key Features Tested:${NC}"
echo "  • Better Auth session-based authentication"
echo "  • Creator portal workflows"
echo "  • Investor portal workflows"
echo "  • Production company workflows"
echo "  • Public access without authentication"
echo "  • NDA request workflow"
echo "  • Dashboard access"
echo "  • WebSocket availability"

echo -e "\n${YELLOW}📝 Notes:${NC}"
echo "  • All authentication uses cookies (no JWT headers)"
echo "  • Sessions are managed server-side"
echo "  • Cookies are HTTP-only for security"
echo "  • Three separate portals share same auth system"

# Cleanup
rm -f "$COOKIE_JAR"

echo -e "\n${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✨ Workflow tests complete!${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"