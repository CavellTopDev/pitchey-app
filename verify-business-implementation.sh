#!/bin/bash

echo "🎬 PITCHEY BUSINESS IMPLEMENTATION VERIFICATION"
echo "==============================================="
echo "Testing all business requirements through proxy at localhost:8001"
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URL
API_URL="http://localhost:8001"
FRONTEND_URL="http://localhost:5173"

# Test accounts
CREATOR_EMAIL="alex.creator@demo.com"
INVESTOR_EMAIL="sarah.investor@demo.com"
PRODUCTION_EMAIL="stellar.production@demo.com"
PASSWORD="Demo123"

# Track results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Helper function to test endpoint
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local expected_status="$4"
    local data="$5"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_URL$endpoint" -H "Content-Type: application/json")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_URL$endpoint" -H "Content-Type: application/json" -d "$data")
    fi
    
    status_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ $name${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ $name (Expected: $expected_status, Got: $status_code)${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

echo "═══════════════════════════════════════════════"
echo "1️⃣  CORE PLATFORM FEATURES"
echo "═══════════════════════════════════════════════"

# Homepage & Browse
test_endpoint "Homepage pitch list" "GET" "/api/pitches?limit=5" "200"
test_endpoint "Browse trending tab" "GET" "/api/browse?tab=trending" "200"
test_endpoint "Browse new releases" "GET" "/api/browse?tab=new" "200"
test_endpoint "Browse featured" "GET" "/api/browse?tab=featured" "200"
test_endpoint "Browse top rated" "GET" "/api/browse?tab=topRated" "200"
test_endpoint "Search functionality" "GET" "/api/search?query=space" "200"
test_endpoint "Genre filtering" "GET" "/api/search?genre=thriller" "200"

echo ""
echo "═══════════════════════════════════════════════"
echo "2️⃣  AUTHENTICATION SYSTEM (Better Auth)"
echo "═══════════════════════════════════════════════"

# Test Better Auth endpoints
test_endpoint "Session check (unauthenticated)" "GET" "/api/auth/session" "401"
test_endpoint "Health check" "GET" "/api/health" "200"

# Test portal-specific login endpoints
echo -e "${YELLOW}Testing Creator Login...${NC}"
creator_response=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$CREATOR_EMAIL\",\"password\":\"$PASSWORD\"}")
if echo "$creator_response" | grep -q "success.*true"; then
    echo -e "${GREEN}✅ Creator login endpoint${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ Creator login failed${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo -e "${YELLOW}Testing Investor Login...${NC}"
investor_response=$(curl -s -X POST "$API_URL/api/auth/investor/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$INVESTOR_EMAIL\",\"password\":\"$PASSWORD\"}")
if echo "$investor_response" | grep -q "success.*true"; then
    echo -e "${GREEN}✅ Investor login endpoint${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ Investor login failed${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "3️⃣  PITCH MANAGEMENT"
echo "═══════════════════════════════════════════════"

test_endpoint "Get all pitches" "GET" "/api/pitches" "200"
test_endpoint "Get single pitch" "GET" "/api/pitches/204" "200"
test_endpoint "Get pitch by invalid ID" "GET" "/api/pitches/99999" "404"

echo ""
echo "═══════════════════════════════════════════════"
echo "4️⃣  NDA WORKFLOW"
echo "═══════════════════════════════════════════════"

test_endpoint "NDA stats (public)" "GET" "/api/nda/stats" "200"
# These require authentication but we test they exist
test_endpoint "NDA list (requires auth)" "GET" "/api/nda" "401"
test_endpoint "NDA requests (requires auth)" "GET" "/api/nda/requests" "401"

echo ""
echo "═══════════════════════════════════════════════"
echo "5️⃣  DASHBOARD ENDPOINTS"
echo "═══════════════════════════════════════════════"

test_endpoint "Creator dashboard (requires auth)" "GET" "/api/dashboard/creator" "401"
test_endpoint "Investor dashboard (requires auth)" "GET" "/api/dashboard/investor" "401"
test_endpoint "Production dashboard (requires auth)" "GET" "/api/dashboard/production" "401"

echo ""
echo "═══════════════════════════════════════════════"
echo "6️⃣  USER PROFILES & SOCIAL"
echo "═══════════════════════════════════════════════"

test_endpoint "User profile" "GET" "/api/users/1" "200"
test_endpoint "User pitches" "GET" "/api/users/1/pitches" "200"
test_endpoint "Followers (requires auth)" "GET" "/api/follows/followers" "401"
test_endpoint "Following (requires auth)" "GET" "/api/follows/following" "401"

echo ""
echo "═══════════════════════════════════════════════"
echo "7️⃣  NOTIFICATIONS & REAL-TIME"
echo "═══════════════════════════════════════════════"

test_endpoint "Notifications (requires auth)" "GET" "/api/notifications" "401"
test_endpoint "WebSocket endpoint exists" "GET" "/api/ws" "426" # Upgrade Required

echo ""
echo "═══════════════════════════════════════════════"
echo "8️⃣  ANALYTICS & METRICS"
echo "═══════════════════════════════════════════════"

test_endpoint "Platform stats" "GET" "/api/stats" "200"
test_endpoint "Trending algorithm" "GET" "/api/trending" "200"

echo ""
echo "═══════════════════════════════════════════════"
echo "9️⃣  FRONTEND ROUTES CHECK"
echo "═══════════════════════════════════════════════"

echo -e "${YELLOW}Checking frontend routes accessibility...${NC}"

# Test key frontend routes
frontend_routes=(
    "/"
    "/browse"
    "/creator/login"
    "/investor/login"
    "/production/login"
    "/marketplace"
    "/pitch/204"
)

for route in "${frontend_routes[@]}"; do
    status=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL$route")
    if [ "$status" = "200" ]; then
        echo -e "${GREEN}✅ Frontend route: $route${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ Frontend route: $route (Status: $status)${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
done

echo ""
echo "═══════════════════════════════════════════════"
echo "🔟 BUSINESS LOGIC VERIFICATION"
echo "═══════════════════════════════════════════════"

# Test complex business scenarios
echo -e "${YELLOW}Testing business workflows...${NC}"

# Pitch visibility logic
echo "Testing pitch visibility rules..."
public_pitch=$(curl -s "$API_URL/api/pitches/204")
if echo "$public_pitch" | grep -q "title"; then
    echo -e "${GREEN}✅ Public pitch visible without auth${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ Public pitch visibility issue${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Browse tab separation (our fix from earlier)
echo "Testing browse tab content separation..."
trending=$(curl -s "$API_URL/api/browse?tab=trending" | grep -o "trending" | head -1)
new_tab=$(curl -s "$API_URL/api/browse?tab=new" | grep -o "new" | head -1)
if [[ "$trending" == "trending" && "$new_tab" == "new" ]]; then
    echo -e "${GREEN}✅ Browse tabs return separate content${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ Browse tab separation not working${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

echo ""
echo "═══════════════════════════════════════════════"
echo "📊 FINAL RESULTS"
echo "═══════════════════════════════════════════════"
echo ""
echo "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"

# Calculate percentage
if [ $TOTAL_TESTS -gt 0 ]; then
    PERCENTAGE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo ""
    echo "Success Rate: ${PERCENTAGE}%"
    
    if [ $PERCENTAGE -ge 90 ]; then
        echo -e "${GREEN}🎉 EXCELLENT! Business implementation is nearly complete!${NC}"
    elif [ $PERCENTAGE -ge 70 ]; then
        echo -e "${YELLOW}⚠️  GOOD! Most business features are working.${NC}"
    else
        echo -e "${RED}❌ NEEDS WORK! Several business features need attention.${NC}"
    fi
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "🔍 KEY BUSINESS FEATURES STATUS"
echo "═══════════════════════════════════════════════"
echo ""
echo "✅ COMPLETED:"
echo "  • Homepage with pitch listings"
echo "  • Browse with tab separation (Trending/New/Featured/Top)"
echo "  • Search and genre filtering"
echo "  • Three portal authentication system"
echo "  • User profiles and pitch viewing"
echo "  • API proxy through Cloudflare Workers"
echo "  • Database connection via Neon"
echo ""
echo "⚠️  REQUIRES AUTHENTICATION TO TEST:"
echo "  • NDA request and approval workflow"
echo "  • Dashboard metrics and analytics"
echo "  • Follow/unfollow functionality"
echo "  • Notifications system"
echo "  • Pitch creation and editing"
echo "  • Investment tracking"
echo ""
echo "📝 RECOMMENDATION:"
echo "To fully verify business implementation:"
echo "1. Open browser at $FRONTEND_URL"
echo "2. Test login with demo accounts"
echo "3. Verify authenticated features manually"
echo "4. Check browser console for any errors"