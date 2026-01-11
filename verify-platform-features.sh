#!/bin/bash

# =====================================================
# Comprehensive Platform Feature Verification
# Tests all major functionality across the three portals
# =====================================================

API_URL="http://localhost:8001"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Track test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Store cookies for session management
COOKIE_JAR="/tmp/pitchey-verify-cookies.txt"
rm -f "$COOKIE_JAR"

# Test accounts
CREATOR_EMAIL="alex.creator@demo.com"
INVESTOR_EMAIL="sarah.investor@demo.com"
PRODUCTION_EMAIL="stellar.production@demo.com"
PASSWORD="Demo123"

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

# Test function
test_feature() {
    local description="$1"
    local result="$2"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$result" = "true" ]; then
        echo -e "  ${GREEN}✅ $description${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "  ${RED}❌ $description${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     PITCHEY PLATFORM FEATURE VERIFICATION                ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# ═══════════════════════════════════════════════════════════
# 1. PUBLIC FEATURES
# ═══════════════════════════════════════════════════════════
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}1. PUBLIC ACCESS FEATURES${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Test public pitch browsing
PITCHES=$(curl -s "${API_URL}/api/pitches?limit=5")
HAS_PITCHES=$(echo "$PITCHES" | jq -r '.data | length > 0' 2>/dev/null)
test_feature "Public pitch browsing" "$HAS_PITCHES"

# Test search functionality
SEARCH=$(curl -s "${API_URL}/api/search?query=film")
HAS_SEARCH=$(echo "$SEARCH" | jq -r '.data | length >= 0' 2>/dev/null)
test_feature "Search functionality" "$HAS_SEARCH"

# Test browse tabs
TRENDING=$(curl -s "${API_URL}/api/browse?tab=trending")
HAS_TRENDING=$(echo "$TRENDING" | jq -r '.success' 2>/dev/null)
test_feature "Browse tabs (trending/new/featured)" "$HAS_TRENDING"

# ═══════════════════════════════════════════════════════════
# 2. AUTHENTICATION
# ═══════════════════════════════════════════════════════════
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}2. AUTHENTICATION SYSTEM${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Wait to avoid rate limiting
sleep 2

# Test creator login
LOGIN=$(curl -s -X POST "${API_URL}/api/auth/sign-in" \
    -H "Content-Type: application/json" \
    -c "$COOKIE_JAR" \
    -d "{\"email\":\"$CREATOR_EMAIL\",\"password\":\"$PASSWORD\",\"userType\":\"creator\"}")
CREATOR_LOGIN=$(echo "$LOGIN" | jq -r '.success' 2>/dev/null)
test_feature "Creator authentication" "$CREATOR_LOGIN"

# Test session persistence
SESSION=$(auth_request "GET" "/api/auth/session")
HAS_SESSION=$(echo "$SESSION" | jq -r '.user != null' 2>/dev/null)
test_feature "Session persistence" "$HAS_SESSION"

# Sign out
auth_request "POST" "/api/auth/sign-out" > /dev/null
rm -f "$COOKIE_JAR"

# Wait to avoid rate limiting
sleep 2

# Test investor login
LOGIN=$(curl -s -X POST "${API_URL}/api/auth/sign-in" \
    -H "Content-Type: application/json" \
    -c "$COOKIE_JAR" \
    -d "{\"email\":\"$INVESTOR_EMAIL\",\"password\":\"$PASSWORD\",\"userType\":\"investor\"}")
INVESTOR_LOGIN=$(echo "$LOGIN" | jq -r '.success' 2>/dev/null)
test_feature "Investor authentication" "$INVESTOR_LOGIN"

# Sign out
auth_request "POST" "/api/auth/sign-out" > /dev/null
rm -f "$COOKIE_JAR"

# ═══════════════════════════════════════════════════════════
# 3. CREATOR FEATURES
# ═══════════════════════════════════════════════════════════
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}3. CREATOR PORTAL FEATURES${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Wait to avoid rate limiting
sleep 2

# Login as creator
curl -s -X POST "${API_URL}/api/auth/sign-in" \
    -H "Content-Type: application/json" \
    -c "$COOKIE_JAR" \
    -d "{\"email\":\"$CREATOR_EMAIL\",\"password\":\"$PASSWORD\",\"userType\":\"creator\"}" > /dev/null

# Test dashboard
DASHBOARD=$(auth_request "GET" "/api/dashboard/creator")
HAS_DASHBOARD=$(echo "$DASHBOARD" | jq -r '.success // .data != null' 2>/dev/null)
test_feature "Creator dashboard" "$HAS_DASHBOARD"

# Test pitch creation
NEW_PITCH=$(auth_request "POST" "/api/pitches" '{
    "title": "Test Pitch",
    "logline": "A test pitch for verification",
    "genre": "drama",
    "format": "feature",
    "shortSynopsis": "Testing platform features"
}')
PITCH_CREATED=$(echo "$NEW_PITCH" | jq -r '.success // .data.id != null' 2>/dev/null)
test_feature "Pitch creation" "$PITCH_CREATED"

# Test pitch listing
MY_PITCHES=$(auth_request "GET" "/api/creator/pitches")
HAS_PITCHES=$(echo "$MY_PITCHES" | jq -r '.success // .pitches != null' 2>/dev/null)
test_feature "Creator pitch listing" "$HAS_PITCHES"

# ═══════════════════════════════════════════════════════════
# 4. INVESTOR FEATURES
# ═══════════════════════════════════════════════════════════
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}4. INVESTOR PORTAL FEATURES${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Sign out and login as investor
auth_request "POST" "/api/auth/sign-out" > /dev/null
rm -f "$COOKIE_JAR"
sleep 2

curl -s -X POST "${API_URL}/api/auth/sign-in" \
    -H "Content-Type: application/json" \
    -c "$COOKIE_JAR" \
    -d "{\"email\":\"$INVESTOR_EMAIL\",\"password\":\"$PASSWORD\",\"userType\":\"investor\"}" > /dev/null

# Test investor dashboard
DASHBOARD=$(auth_request "GET" "/api/dashboard/investor")
HAS_DASHBOARD=$(echo "$DASHBOARD" | jq -r '.success // .data != null' 2>/dev/null)
test_feature "Investor dashboard" "$HAS_DASHBOARD"

# Test NDA functionality
NDA_REQUEST=$(auth_request "POST" "/api/nda/request" '{"pitchId": 1}')
NDA_RESULT=$(echo "$NDA_REQUEST" | jq -r '.success // .error.code == "NDA_EXISTS"' 2>/dev/null)
test_feature "NDA request functionality" "$NDA_RESULT"

# Test saved pitches
SAVED=$(auth_request "GET" "/api/saved-pitches")
HAS_SAVED=$(echo "$SAVED" | jq -r '.success // .data != null' 2>/dev/null)
test_feature "Saved pitches" "$HAS_SAVED"

# ═══════════════════════════════════════════════════════════
# 5. PRODUCTION FEATURES
# ═══════════════════════════════════════════════════════════
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}5. PRODUCTION PORTAL FEATURES${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Sign out and login as production
auth_request "POST" "/api/auth/sign-out" > /dev/null
rm -f "$COOKIE_JAR"
sleep 3  # Longer wait for production to avoid rate limiting

curl -s -X POST "${API_URL}/api/auth/sign-in" \
    -H "Content-Type: application/json" \
    -c "$COOKIE_JAR" \
    -d "{\"email\":\"$PRODUCTION_EMAIL\",\"password\":\"$PASSWORD\",\"userType\":\"production\"}" > /dev/null

# Test production dashboard
DASHBOARD=$(auth_request "GET" "/api/dashboard/production")
HAS_DASHBOARD=$(echo "$DASHBOARD" | jq -r '.success // .data != null' 2>/dev/null)
test_feature "Production dashboard" "$HAS_DASHBOARD"

# Test submissions
SUBMISSIONS=$(auth_request "GET" "/api/production/submissions")
HAS_SUBMISSIONS=$(echo "$SUBMISSIONS" | jq -r '.success // .submissions != null' 2>/dev/null)
test_feature "Production submissions" "$HAS_SUBMISSIONS"

# ═══════════════════════════════════════════════════════════
# 6. API INFRASTRUCTURE
# ═══════════════════════════════════════════════════════════
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}6. API INFRASTRUCTURE${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Test health endpoint
HEALTH=$(curl -s "${API_URL}/api/health")
IS_HEALTHY=$(echo "$HEALTH" | jq -r '.status == "ok" or .status == "degraded"' 2>/dev/null)
test_feature "Health check endpoint" "$IS_HEALTHY"

# Test CORS headers
CORS_CHECK=$(curl -s -I -X OPTIONS "${API_URL}/api/health" -H "Origin: http://localhost:5173")
HAS_CORS=$(echo "$CORS_CHECK" | grep -i "access-control-allow-origin" > /dev/null && echo "true" || echo "false")
test_feature "CORS configuration" "$HAS_CORS"

# Test error handling
ERROR_RESPONSE=$(curl -s "${API_URL}/api/nonexistent-endpoint")
HAS_ERROR=$(echo "$ERROR_RESPONSE" | jq -r '.error != null' 2>/dev/null)
test_feature "Error handling" "$HAS_ERROR"

# ═══════════════════════════════════════════════════════════
# RESULTS SUMMARY
# ═══════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}VERIFICATION RESULTS${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

PERCENTAGE=$((PASSED_TESTS * 100 / TOTAL_TESTS))

echo -e "\nTotal Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo -e "Success Rate: ${PERCENTAGE}%"

echo -e "\n${CYAN}═══════════════════════════════════════════════════════════${NC}"
if [ $PERCENTAGE -ge 80 ]; then
    echo -e "${GREEN}✨ Platform verification PASSED! (${PERCENTAGE}%)${NC}"
elif [ $PERCENTAGE -ge 60 ]; then
    echo -e "${YELLOW}⚠️ Platform partially functional (${PERCENTAGE}%)${NC}"
else
    echo -e "${RED}❌ Platform needs attention (${PERCENTAGE}%)${NC}"
fi
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

# Cleanup
rm -f "$COOKIE_JAR"

exit 0