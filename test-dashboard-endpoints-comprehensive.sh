#!/bin/bash

echo "🔍 COMPREHENSIVE DASHBOARD ENDPOINT TESTING"
echo "==========================================="
echo ""

BACKEND_URL="http://localhost:8001"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test authentication first
echo -e "${BLUE}🔐 AUTHENTICATION TESTS${NC}"
echo "=============================="

echo "1. Testing Creator Login:"
CREATOR_TOKEN=$(curl -s -X POST "$BACKEND_URL/api/auth/creator/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"alex.creator@demo.com","password":"Demo123"}' | \
    jq -r '.token // empty' 2>/dev/null)

if [ -n "$CREATOR_TOKEN" ] && [ "$CREATOR_TOKEN" != "null" ]; then
    echo -e "${GREEN}✅ Creator login successful${NC}"
    echo "   Token: ${CREATOR_TOKEN:0:20}..."
else
    echo -e "${RED}❌ Creator login failed${NC}"
    echo "   Response: $(curl -s -X POST "$BACKEND_URL/api/auth/creator/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"alex.creator@demo.com","password":"Demo123"}')"
fi

echo ""
echo "2. Testing Investor Login:"
INVESTOR_TOKEN=$(curl -s -X POST "$BACKEND_URL/api/auth/investor/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"sarah.investor@demo.com","password":"Demo123"}' | \
    jq -r '.token // empty' 2>/dev/null)

if [ -n "$INVESTOR_TOKEN" ] && [ "$INVESTOR_TOKEN" != "null" ]; then
    echo -e "${GREEN}✅ Investor login successful${NC}"
    echo "   Token: ${INVESTOR_TOKEN:0:20}..."
else
    echo -e "${RED}❌ Investor login failed${NC}"
fi

echo ""
echo "3. Testing Production Login:"
PRODUCTION_TOKEN=$(curl -s -X POST "$BACKEND_URL/api/auth/production/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"stellar.production@demo.com","password":"Demo123"}' | \
    jq -r '.token // empty' 2>/dev/null)

if [ -n "$PRODUCTION_TOKEN" ] && [ "$PRODUCTION_TOKEN" != "null" ]; then
    echo -e "${GREEN}✅ Production login successful${NC}"
    echo "   Token: ${PRODUCTION_TOKEN:0:20}..."
else
    echo -e "${RED}❌ Production login failed${NC}"
fi

echo ""
echo -e "${BLUE}📊 DASHBOARD ENDPOINT TESTS${NC}"
echo "================================="

# Test Creator Dashboard
if [ -n "$CREATOR_TOKEN" ]; then
    echo ""
    echo -e "${YELLOW}🎨 CREATOR DASHBOARD ENDPOINTS${NC}"
    echo "================================="
    
    echo "1. Creator Dashboard Main:"
    CREATOR_DASH=$(curl -s -H "Authorization: Bearer $CREATOR_TOKEN" "$BACKEND_URL/api/creator/dashboard")
    if echo "$CREATOR_DASH" | jq . >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Creator dashboard endpoint working${NC}"
        echo "   Data keys: $(echo "$CREATOR_DASH" | jq -r 'keys | join(", ")' 2>/dev/null)"
    else
        echo -e "${RED}❌ Creator dashboard endpoint failed${NC}"
        echo "   Response: $CREATOR_DASH"
    fi
    
    echo ""
    echo "2. Creator Pitches:"
    CREATOR_PITCHES=$(curl -s -H "Authorization: Bearer $CREATOR_TOKEN" "$BACKEND_URL/api/creator/pitches")
    if echo "$CREATOR_PITCHES" | jq . >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Creator pitches endpoint working${NC}"
        PITCH_COUNT=$(echo "$CREATOR_PITCHES" | jq '.pitches | length' 2>/dev/null || echo "N/A")
        echo "   Pitch count: $PITCH_COUNT"
    else
        echo -e "${RED}❌ Creator pitches endpoint failed${NC}"
    fi
    
    echo ""
    echo "3. Creator Followers:"
    CREATOR_FOLLOWERS=$(curl -s -H "Authorization: Bearer $CREATOR_TOKEN" "$BACKEND_URL/api/creator/followers")
    if echo "$CREATOR_FOLLOWERS" | jq . >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Creator followers endpoint working${NC}"
        FOLLOWER_COUNT=$(echo "$CREATOR_FOLLOWERS" | jq '.followers | length' 2>/dev/null || echo "N/A")
        echo "   Follower count: $FOLLOWER_COUNT"
    else
        echo -e "${RED}❌ Creator followers endpoint failed${NC}"
    fi
fi

# Test Investor Dashboard
if [ -n "$INVESTOR_TOKEN" ]; then
    echo ""
    echo -e "${YELLOW}💰 INVESTOR DASHBOARD ENDPOINTS${NC}"
    echo "=================================="
    
    echo "1. Investor Dashboard Main:"
    INVESTOR_DASH=$(curl -s -H "Authorization: Bearer $INVESTOR_TOKEN" "$BACKEND_URL/api/investor/dashboard")
    if echo "$INVESTOR_DASH" | jq . >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Investor dashboard endpoint working${NC}"
        echo "   Data keys: $(echo "$INVESTOR_DASH" | jq -r 'keys | join(", ")' 2>/dev/null)"
    else
        echo -e "${RED}❌ Investor dashboard endpoint failed${NC}"
        echo "   Response: $INVESTOR_DASH"
    fi
    
    echo ""
    echo "2. Investor Dashboard Stats:"
    INVESTOR_STATS=$(curl -s -H "Authorization: Bearer $INVESTOR_TOKEN" "$BACKEND_URL/api/investor/dashboard/stats")
    if echo "$INVESTOR_STATS" | jq . >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Investor dashboard stats endpoint working${NC}"
        echo "   Stats keys: $(echo "$INVESTOR_STATS" | jq -r 'keys | join(", ")' 2>/dev/null)"
    else
        echo -e "${RED}❌ Investor dashboard stats endpoint failed${NC}"
    fi
    
    echo ""
    echo "3. Investment Portfolio:"
    PORTFOLIO=$(curl -s -H "Authorization: Bearer $INVESTOR_TOKEN" "$BACKEND_URL/api/investments/portfolio")
    if echo "$PORTFOLIO" | jq . >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Investment portfolio endpoint working${NC}"
    else
        echo -e "${RED}❌ Investment portfolio endpoint failed${NC}"
    fi
    
    echo ""
    echo "4. Investment History:"
    INVEST_HISTORY=$(curl -s -H "Authorization: Bearer $INVESTOR_TOKEN" "$BACKEND_URL/api/investments/history")
    if echo "$INVEST_HISTORY" | jq . >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Investment history endpoint working${NC}"
    else
        echo -e "${RED}❌ Investment history endpoint failed${NC}"
    fi
fi

# Test Production Dashboard
if [ -n "$PRODUCTION_TOKEN" ]; then
    echo ""
    echo -e "${YELLOW}🎬 PRODUCTION DASHBOARD ENDPOINTS${NC}"
    echo "===================================="
    
    echo "1. Production Dashboard Main:"
    PRODUCTION_DASH=$(curl -s -H "Authorization: Bearer $PRODUCTION_TOKEN" "$BACKEND_URL/api/production/dashboard")
    if echo "$PRODUCTION_DASH" | jq . >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Production dashboard endpoint working${NC}"
        echo "   Data keys: $(echo "$PRODUCTION_DASH" | jq -r 'keys | join(", ")' 2>/dev/null)"
    else
        echo -e "${RED}❌ Production dashboard endpoint failed${NC}"
        echo "   Response: $PRODUCTION_DASH"
    fi
fi

echo ""
echo -e "${BLUE}📈 ANALYTICS AND STATS ENDPOINTS${NC}"
echo "====================================="

echo "1. Analytics Dashboard (Creator):"
if [ -n "$CREATOR_TOKEN" ]; then
    ANALYTICS=$(curl -s -H "Authorization: Bearer $CREATOR_TOKEN" "$BACKEND_URL/api/analytics/dashboard")
    if echo "$ANALYTICS" | jq . >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Analytics dashboard endpoint working${NC}"
    else
        echo -e "${RED}❌ Analytics dashboard endpoint failed${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ Skipped (no creator token)${NC}"
fi

echo ""
echo "2. Dashboard Stats (General):"
GENERAL_STATS=$(curl -s "$BACKEND_URL/api/dashboard/stats")
if echo "$GENERAL_STATS" | jq . >/dev/null 2>&1; then
    echo -e "${GREEN}✅ General dashboard stats endpoint working${NC}"
    echo "   Stats keys: $(echo "$GENERAL_STATS" | jq -r 'keys | join(", ")' 2>/dev/null)"
else
    echo -e "${RED}❌ General dashboard stats endpoint failed${NC}"
fi

echo ""
echo "3. Dashboard Recent Pitches:"
RECENT_PITCHES=$(curl -s "$BACKEND_URL/api/dashboard/recent-pitches")
if echo "$RECENT_PITCHES" | jq . >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Dashboard recent pitches endpoint working${NC}"
    RECENT_COUNT=$(echo "$RECENT_PITCHES" | jq '.pitches | length' 2>/dev/null || echo "N/A")
    echo "   Recent pitch count: $RECENT_COUNT"
else
    echo -e "${RED}❌ Dashboard recent pitches endpoint failed${NC}"
fi

echo ""
echo "4. Dashboard Trending:"
TRENDING=$(curl -s "$BACKEND_URL/api/dashboard/trending")
if echo "$TRENDING" | jq . >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Dashboard trending endpoint working${NC}"
    TRENDING_COUNT=$(echo "$TRENDING" | jq '.pitches | length' 2>/dev/null || echo "N/A")
    echo "   Trending pitch count: $TRENDING_COUNT"
else
    echo -e "${RED}❌ Dashboard trending endpoint failed${NC}"
fi

echo ""
echo -e "${BLUE}🔍 SEARCH AND DISCOVERY ENDPOINTS${NC}"
echo "===================================="

echo "1. Public Pitches:"
PUBLIC_PITCHES=$(curl -s "$BACKEND_URL/api/pitches/public")
if echo "$PUBLIC_PITCHES" | jq . >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Public pitches endpoint working${NC}"
    PUBLIC_COUNT=$(echo "$PUBLIC_PITCHES" | jq '.pitches | length' 2>/dev/null || echo "N/A")
    echo "   Public pitch count: $PUBLIC_COUNT"
else
    echo -e "${RED}❌ Public pitches endpoint failed${NC}"
fi

echo ""
echo "2. Trending Pitches:"
TRENDING_PITCHES=$(curl -s "$BACKEND_URL/api/pitches/trending")
if echo "$TRENDING_PITCHES" | jq . >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Trending pitches endpoint working${NC}"
    TRENDING_PITCH_COUNT=$(echo "$TRENDING_PITCHES" | jq '.pitches | length' 2>/dev/null || echo "N/A")
    echo "   Trending count: $TRENDING_PITCH_COUNT"
else
    echo -e "${RED}❌ Trending pitches endpoint failed${NC}"
fi

echo ""
echo "3. Featured Pitches:"
FEATURED_PITCHES=$(curl -s "$BACKEND_URL/api/pitches/featured")
if echo "$FEATURED_PITCHES" | jq . >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Featured pitches endpoint working${NC}"
    FEATURED_COUNT=$(echo "$FEATURED_PITCHES" | jq '.pitches | length' 2>/dev/null || echo "N/A")
    echo "   Featured count: $FEATURED_COUNT"
else
    echo -e "${RED}❌ Featured pitches endpoint failed${NC}"
fi

echo ""
echo "4. Search Pitches (keyword test):"
SEARCH_RESULT=$(curl -s "$BACKEND_URL/api/search/pitches?query=movie")
if echo "$SEARCH_RESULT" | jq . >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Search pitches endpoint working${NC}"
    SEARCH_COUNT=$(echo "$SEARCH_RESULT" | jq '.pitches | length' 2>/dev/null || echo "N/A")
    echo "   Search result count: $SEARCH_COUNT"
else
    echo -e "${RED}❌ Search pitches endpoint failed${NC}"
fi

echo ""
echo -e "${BLUE}🔐 NDA AND BUSINESS LOGIC ENDPOINTS${NC}"
echo "======================================"

if [ -n "$INVESTOR_TOKEN" ]; then
    echo "1. NDA Stats:"
    NDA_STATS=$(curl -s -H "Authorization: Bearer $INVESTOR_TOKEN" "$BACKEND_URL/api/ndas/stats")
    if echo "$NDA_STATS" | jq . >/dev/null 2>&1; then
        echo -e "${GREEN}✅ NDA stats endpoint working${NC}"
        echo "   Stats keys: $(echo "$NDA_STATS" | jq -r 'keys | join(", ")' 2>/dev/null)"
    else
        echo -e "${RED}❌ NDA stats endpoint failed${NC}"
    fi
    
    echo ""
    echo "2. User Notifications:"
    NOTIFICATIONS=$(curl -s -H "Authorization: Bearer $INVESTOR_TOKEN" "$BACKEND_URL/api/user/notifications")
    if echo "$NOTIFICATIONS" | jq . >/dev/null 2>&1; then
        echo -e "${GREEN}✅ User notifications endpoint working${NC}"
        NOTIF_COUNT=$(echo "$NOTIFICATIONS" | jq '.notifications | length' 2>/dev/null || echo "N/A")
        echo "   Notification count: $NOTIF_COUNT"
    else
        echo -e "${RED}❌ User notifications endpoint failed${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ Skipped NDA tests (no investor token)${NC}"
fi

echo ""
echo -e "${BLUE}📊 SUMMARY${NC}"
echo "============="

# Count successful vs failed tests
echo "Test completed! Check the results above for any failing endpoints."
echo ""
echo "Key areas to focus on:"
echo "• Dashboard data richness and completeness"
echo "• Investment tracking and portfolio features"  
echo "• Analytics and metrics calculations"
echo "• Real-time data updates"
echo "• Performance optimization for dashboard queries"

echo ""
echo "Next steps:"
echo "1. Identify missing or incomplete endpoints"
echo "2. Add enhanced analytics and calculations"
echo "3. Implement missing business logic"
echo "4. Add performance optimizations"
echo "5. Wire up frontend components to enhanced backend"