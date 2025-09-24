#!/bin/bash

echo "════════════════════════════════════════════════════════════════"
echo "         COMPLETE PITCHEY INTEGRATION TEST"
echo "════════════════════════════════════════════════════════════════"
echo ""

FRONTEND="https://pitchey-frontend.deno.dev"
BACKEND="https://pitchey-backend.deno.dev"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Test counter
PASSED=0
FAILED=0

test_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

test_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

echo -e "${CYAN}📡 CHECKING INFRASTRUCTURE${NC}"
echo "─────────────────────────────"

# 1. Frontend Status
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND")
if [ "$FRONTEND_STATUS" = "200" ]; then
    test_pass "Frontend online at $FRONTEND"
else
    test_fail "Frontend not responding (HTTP $FRONTEND_STATUS)"
fi

# 2. Backend Status
BACKEND_TEST=$(curl -s -X POST "$BACKEND/api/auth/creator/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test","password":"test"}' | jq -r '.success')
if [ "$BACKEND_TEST" = "false" ]; then
    test_pass "Backend online at $BACKEND"
else
    test_fail "Backend not responding properly"
fi

# 3. Check Frontend API Configuration
FRONTEND_JS=$(curl -s "$FRONTEND/assets/index-F10_WScS.js" | head -5000)
if echo "$FRONTEND_JS" | grep -q "https://pitchey-backend.deno.dev"; then
    test_pass "Frontend configured with correct backend URL"
elif echo "$FRONTEND_JS" | grep -q "pitchey-backend-62414fc1npma"; then
    test_fail "Frontend still using OLD backend URL!"
else
    test_fail "Could not determine frontend API configuration"
fi

echo ""
echo -e "${CYAN}🔐 TESTING AUTHENTICATION${NC}"
echo "────────────────────────"

# Test Creator Login
echo -e "\n${BLUE}Creator Portal:${NC}"
CREATOR_RESPONSE=$(curl -s -X POST "$BACKEND/api/auth/creator/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"alex.creator@demo.com","password":"Demo123"}')

CREATOR_SUCCESS=$(echo "$CREATOR_RESPONSE" | jq -r '.success')
if [ "$CREATOR_SUCCESS" = "true" ]; then
    CREATOR_TOKEN=$(echo "$CREATOR_RESPONSE" | jq -r '.token')
    CREATOR_ID=$(echo "$CREATOR_RESPONSE" | jq -r '.user.id')
    test_pass "Creator login successful (ID: $CREATOR_ID)"
    
    # Check if using real ID (1) not mock (1001)
    if [ "$CREATOR_ID" = "1" ]; then
        test_pass "Using REAL user ID (not mock 1001)"
    else
        test_fail "Still using mock user ID: $CREATOR_ID"
    fi
else
    test_fail "Creator login failed"
    CREATOR_TOKEN=""
fi

# Test Investor Login
echo -e "\n${BLUE}Investor Portal:${NC}"
INVESTOR_RESPONSE=$(curl -s -X POST "$BACKEND/api/auth/investor/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"sarah.investor@demo.com","password":"Demo123"}')

INVESTOR_SUCCESS=$(echo "$INVESTOR_RESPONSE" | jq -r '.success')
if [ "$INVESTOR_SUCCESS" = "true" ]; then
    INVESTOR_TOKEN=$(echo "$INVESTOR_RESPONSE" | jq -r '.token')
    INVESTOR_ID=$(echo "$INVESTOR_RESPONSE" | jq -r '.user.id')
    test_pass "Investor login successful (ID: $INVESTOR_ID)"
else
    test_fail "Investor login failed"
    INVESTOR_TOKEN=""
fi

# Test Production Login
echo -e "\n${BLUE}Production Portal:${NC}"
PRODUCTION_RESPONSE=$(curl -s -X POST "$BACKEND/api/auth/production/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"stellar.production@demo.com","password":"Demo123"}')

PRODUCTION_SUCCESS=$(echo "$PRODUCTION_RESPONSE" | jq -r '.success')
if [ "$PRODUCTION_SUCCESS" = "true" ]; then
    PRODUCTION_TOKEN=$(echo "$PRODUCTION_RESPONSE" | jq -r '.token')
    PRODUCTION_ID=$(echo "$PRODUCTION_RESPONSE" | jq -r '.user.id')
    test_pass "Production login successful (ID: $PRODUCTION_ID)"
else
    test_fail "Production login failed"
    PRODUCTION_TOKEN=""
fi

echo ""
echo -e "${CYAN}📊 TESTING DATA ENDPOINTS${NC}"
echo "──────────────────────"

if [ -n "$CREATOR_TOKEN" ]; then
    echo -e "\n${BLUE}Creator Dashboard:${NC}"
    
    # Test profile endpoint
    PROFILE=$(curl -s "$BACKEND/api/auth/me" -H "Authorization: Bearer $CREATOR_TOKEN" | jq -r '.success')
    if [ "$PROFILE" = "true" ]; then
        test_pass "Profile endpoint working"
    else
        test_fail "Profile endpoint failed"
    fi
    
    # Test dashboard
    DASHBOARD=$(curl -s "$BACKEND/api/creator/dashboard" -H "Authorization: Bearer $CREATOR_TOKEN")
    DASH_SUCCESS=$(echo "$DASHBOARD" | jq -r '.success')
    if [ "$DASH_SUCCESS" = "true" ]; then
        test_pass "Creator dashboard accessible"
        
        # Check for mock data
        VIEWS=$(echo "$DASHBOARD" | jq -r '.data.stats.totalViews' 2>/dev/null)
        if [ "$VIEWS" = "1250" ]; then
            test_fail "MOCK DATA DETECTED! Still showing 1250 views"
        elif [ -n "$VIEWS" ] && [ "$VIEWS" != "null" ]; then
            test_pass "Real data returned (Views: $VIEWS)"
        fi
    else
        DASH_ERROR=$(echo "$DASHBOARD" | jq -r '.error')
        test_fail "Dashboard failed: $DASH_ERROR"
    fi
    
    # Test pitches
    PITCHES=$(curl -s "$BACKEND/api/creator/pitches" -H "Authorization: Bearer $CREATOR_TOKEN" | jq -r '.success')
    if [ "$PITCHES" = "true" ]; then
        test_pass "Creator pitches endpoint working"
    else
        test_fail "Creator pitches endpoint failed"
    fi
fi

if [ -n "$INVESTOR_TOKEN" ]; then
    echo -e "\n${BLUE}Investor Endpoints:${NC}"
    
    # Test portfolio
    PORTFOLIO=$(curl -s "$BACKEND/api/investor/portfolio" -H "Authorization: Bearer $INVESTOR_TOKEN" | jq -r '.success')
    if [ "$PORTFOLIO" = "true" ]; then
        test_pass "Investor portfolio accessible"
    else
        test_fail "Investor portfolio failed"
    fi
fi

if [ -n "$PRODUCTION_TOKEN" ]; then
    echo -e "\n${BLUE}Production Endpoints:${NC}"
    
    # Test dashboard
    PROD_DASH=$(curl -s "$BACKEND/api/production/dashboard" -H "Authorization: Bearer $PRODUCTION_TOKEN" | jq -r '.success')
    if [ "$PROD_DASH" = "true" ]; then
        test_pass "Production dashboard accessible"
    else
        test_fail "Production dashboard failed"
    fi
    
    # Test projects
    PROJECTS=$(curl -s "$BACKEND/api/production/projects" -H "Authorization: Bearer $PRODUCTION_TOKEN" | jq -r '.success')
    if [ "$PROJECTS" = "true" ]; then
        test_pass "Production projects accessible"
    else
        test_fail "Production projects failed"
    fi
fi

echo ""
echo -e "${CYAN}🌐 TESTING FRONTEND PAGES${NC}"
echo "──────────────────────"

# Check key frontend routes
test_url() {
    local URL=$1
    local DESC=$2
    local STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
    if [ "$STATUS" = "200" ]; then
        test_pass "$DESC"
    else
        test_fail "$DESC (HTTP $STATUS)"
    fi
}

test_url "$FRONTEND/" "Homepage"
test_url "$FRONTEND/creator/login" "Creator login page"
test_url "$FRONTEND/investor/login" "Investor login page"
test_url "$FRONTEND/production/login" "Production login page"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo -e "${CYAN}TEST SUMMARY${NC}"
echo "────────────────────────────────────────────────────────────────"
echo -e "Tests Passed: ${GREEN}$PASSED${NC}"
echo -e "Tests Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED! EVERYTHING IS CONNECTED!${NC}"
    echo ""
    echo "Your Pitchey platform is fully operational:"
    echo "• Frontend and backend are connected"
    echo "• All three portals can authenticate"
    echo "• Real data is being served (no mock data)"
    echo "• All major endpoints are accessible"
    echo ""
    echo "Ready for testing at: $FRONTEND"
else
    echo -e "${YELLOW}⚠ SOME TESTS FAILED${NC}"
    echo ""
    echo "Review the failed tests above to identify issues."
fi
echo "════════════════════════════════════════════════════════════════"
