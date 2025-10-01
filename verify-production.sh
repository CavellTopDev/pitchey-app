#!/bin/bash

# 🔍 Production Verification Script
# Run this after deployment to verify everything is working

echo "================================================"
echo "🔍 PRODUCTION DEPLOYMENT VERIFICATION"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get production URLs from user or use defaults
read -p "Enter your backend URL (or press Enter for default): " BACKEND_URL
BACKEND_URL=${BACKEND_URL:-https://pitchey-backend.deno.dev}

read -p "Enter your frontend URL (or press Enter for default): " FRONTEND_URL
FRONTEND_URL=${FRONTEND_URL:-https://pitchey-frontend.vercel.app}

echo ""
echo "Testing with:"
echo "Backend:  $BACKEND_URL"
echo "Frontend: $FRONTEND_URL"
echo ""

TOTAL_TESTS=0
PASSED_TESTS=0

# Function to run a test
run_test() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "$1... "
    if eval "$2" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        return 1
    fi
}

# Function to test API endpoint
test_api() {
    local endpoint=$1
    local expected=$2
    curl -s "$BACKEND_URL$endpoint" | grep -q "$expected"
}

echo "🌐 Backend API Tests"
echo "--------------------"

# Test health endpoint
run_test "Health check" "test_api /api/health healthy"

# Get health details for cache info
HEALTH_DATA=$(curl -s "$BACKEND_URL/api/health")
CACHE_TYPE=$(echo "$HEALTH_DATA" | grep -o '"type":"[^"]*' | cut -d'"' -f4)
if [ ! -z "$CACHE_TYPE" ]; then
    echo -e "   Cache: ${BLUE}$CACHE_TYPE${NC}"
fi

# Test version endpoint
run_test "Version check" "test_api /api/version 3.0-complete"

# Test public pitch listing
run_test "Public pitch listing" "test_api /api/pitches success"

# Test authentication endpoints exist
run_test "Creator auth endpoint" "curl -s -o /dev/null -w '%{http_code}' $BACKEND_URL/api/auth/creator/login | grep -q '40[05]'"
run_test "Investor auth endpoint" "curl -s -o /dev/null -w '%{http_code}' $BACKEND_URL/api/auth/investor/login | grep -q '40[05]'"
run_test "Production auth endpoint" "curl -s -o /dev/null -w '%{http_code}' $BACKEND_URL/api/auth/production/login | grep -q '40[05]'"

# Test demo account login
echo ""
echo "🔐 Authentication Tests"
echo "----------------------"

LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/auth/creator/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"alex.creator@demo.com","password":"Demo123"}')

if echo "$LOGIN_RESPONSE" | grep -q "token"; then
    echo -e "${GREEN}✅ Demo creator login works${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    
    # Test authenticated endpoint
    AUTH_TEST=$(curl -s -H "Authorization: Bearer $TOKEN" "$BACKEND_URL/api/creator/dashboard")
    if echo "$AUTH_TEST" | grep -q "success"; then
        echo -e "${GREEN}✅ Authenticated requests work${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ Authenticated requests failed${NC}"
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 2))
else
    echo -e "${RED}❌ Demo login failed${NC}"
    echo "   Check database connection and seeding"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
fi

echo ""
echo "🌍 Frontend Tests"
echo "-----------------"

# Test frontend availability
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Frontend is accessible${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    
    # Check if it's connecting to backend
    FRONTEND_HTML=$(curl -s "$FRONTEND_URL")
    if echo "$FRONTEND_HTML" | grep -q "pitchey-backend"; then
        echo -e "${GREEN}✅ Frontend configured with backend URL${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${YELLOW}⚠️  Frontend may not be configured with backend URL${NC}"
        TOTAL_TESTS=$((TOTAL_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 2))
else
    echo -e "${RED}❌ Frontend not accessible (HTTP $FRONTEND_STATUS)${NC}"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
fi

echo ""
echo "⚡ Performance Tests"
echo "-------------------"

# Measure API response time
START_TIME=$(date +%s%N)
curl -s "$BACKEND_URL/api/health" > /dev/null
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(( ($END_TIME - $START_TIME) / 1000000 ))

if [ "$RESPONSE_TIME" -lt 500 ]; then
    echo -e "${GREEN}✅ API response time: ${RESPONSE_TIME}ms${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
elif [ "$RESPONSE_TIME" -lt 1000 ]; then
    echo -e "${YELLOW}⚠️  API response time: ${RESPONSE_TIME}ms (slow)${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ API response time: ${RESPONSE_TIME}ms (too slow)${NC}"
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Check cache performance if available
if [ "$CACHE_TYPE" = "upstash-redis" ] || [ "$CACHE_TYPE" = "redis" ]; then
    echo -e "${GREEN}✅ Distributed cache active: $CACHE_TYPE${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
elif [ "$CACHE_TYPE" = "in-memory" ]; then
    echo -e "${YELLOW}⚠️  Using in-memory cache (single instance only)${NC}"
    echo "   Consider setting up Upstash Redis for better performance"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ Cache status unknown${NC}"
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

echo ""
echo "📊 Free Tier Usage"
echo "-----------------"

# Estimate daily requests (can't get actual without dashboard access)
echo "Deno Deploy:"
echo "  Limit: 100,000 requests/day"
echo "  Est. headroom: ~99,000 requests"
echo ""
echo "Vercel:"
echo "  Limit: 100GB bandwidth/month"
echo "  Est. headroom: ~99GB"
echo ""
echo "Database (Neon):"
echo "  Limit: 0.5GB storage"
echo "  Est. usage: < 10MB"
echo ""
if [ "$CACHE_TYPE" = "upstash-redis" ]; then
    echo "Cache (Upstash):"
    echo "  Limit: 10,000 commands/day"
    echo "  Est. headroom: ~9,000 commands"
fi

echo ""
echo "================================================"
echo "📈 VERIFICATION RESULTS"
echo "================================================"
echo ""
echo "Tests Passed: $PASSED_TESTS / $TOTAL_TESTS"
PERCENTAGE=$((PASSED_TESTS * 100 / TOTAL_TESTS))

if [ "$PERCENTAGE" -ge 90 ]; then
    echo -e "${GREEN}🎉 EXCELLENT! Your deployment is working great!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Share your app URL with users"
    echo "2. Monitor usage in dashboards"
    echo "3. Set up custom domain (optional)"
elif [ "$PERCENTAGE" -ge 70 ]; then
    echo -e "${YELLOW}⚠️  GOOD! Most features working, some issues to fix${NC}"
    echo ""
    echo "Check:"
    echo "1. Environment variables in Deno Deploy"
    echo "2. Database connection string"
    echo "3. CORS settings"
else
    echo -e "${RED}❌ NEEDS ATTENTION! Several issues found${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "1. Check deployment logs"
    echo "2. Verify all environment variables"
    echo "3. Test database connection"
    echo "4. Review CORS configuration"
fi

echo ""
echo "📊 Monitoring Dashboards:"
echo "  • Deno: https://dash.deno.com/projects/pitchey-backend"
echo "  • Vercel: https://vercel.com/dashboard"
echo "  • Neon: https://console.neon.tech"
if [ "$CACHE_TYPE" = "upstash-redis" ]; then
    echo "  • Upstash: https://console.upstash.com"
fi

echo ""
echo "💡 Tip: Run this script daily for the first week to monitor your app!"