#!/bin/bash

# Verify Quick Wins Implementation
# Run this script to check all security and performance improvements

echo "======================================"
echo "🔍 Verifying Quick Wins Implementation"
echo "======================================"
echo

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Backend URL
BACKEND_URL="http://localhost:8001"
FRONTEND_URL="http://localhost:5173"

echo "1️⃣  Testing Backend Security Headers..."
echo "----------------------------------------"

# Test backend health endpoint
HEADERS=$(curl -I -s "$BACKEND_URL/api/health" 2>/dev/null)

# Check each security header
check_header() {
    local header_name="$1"
    local header_pattern="$2"
    local description="$3"
    
    if echo "$HEADERS" | grep -qi "$header_pattern"; then
        echo -e "${GREEN}✅ $description${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ $description${NC}"
        ((FAILED++))
    fi
}

check_header "X-Content-Type-Options" "x-content-type-options: nosniff" "X-Content-Type-Options: nosniff"
check_header "X-Frame-Options" "x-frame-options: SAMEORIGIN" "X-Frame-Options: SAMEORIGIN"
check_header "X-XSS-Protection" "x-xss-protection: 1; mode=block" "X-XSS-Protection header"
check_header "Strict-Transport-Security" "strict-transport-security:" "Strict-Transport-Security (HSTS)"
check_header "Cache-Control" "cache-control:" "Cache-Control header"
check_header "Content-Security-Policy" "content-security-policy:" "Content-Security-Policy"
check_header "Permissions-Policy" "permissions-policy:" "Permissions-Policy header"

echo
echo "2️⃣  Testing Frontend Headers File..."
echo "-------------------------------------"

if [ -f "frontend/public/_headers" ]; then
    echo -e "${GREEN}✅ Cloudflare Pages _headers file exists${NC}"
    ((PASSED++))
    
    # Check for key security directives
    if grep -q "X-Frame-Options" frontend/public/_headers; then
        echo -e "${GREEN}✅ X-Frame-Options configured${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ X-Frame-Options not configured${NC}"
        ((FAILED++))
    fi
    
    if grep -q "Content-Security-Policy" frontend/public/_headers; then
        echo -e "${GREEN}✅ Content-Security-Policy configured${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ Content-Security-Policy not configured${NC}"
        ((FAILED++))
    fi
    
    if grep -q "Cache-Control" frontend/public/_headers; then
        echo -e "${GREEN}✅ Cache-Control rules configured${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ Cache-Control rules not configured${NC}"
        ((FAILED++))
    fi
else
    echo -e "${RED}❌ Cloudflare Pages _headers file not found${NC}"
    ((FAILED++))
fi

echo
echo "3️⃣  Testing API Response Times..."
echo "----------------------------------"

# Test API response time
START_TIME=$(date +%s%N)
curl -s "$BACKEND_URL/api/health" > /dev/null 2>&1
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))

if [ $RESPONSE_TIME -lt 500 ]; then
    echo -e "${GREEN}✅ API response time: ${RESPONSE_TIME}ms (< 500ms)${NC}"
    ((PASSED++))
elif [ $RESPONSE_TIME -lt 1000 ]; then
    echo -e "${YELLOW}⚠️  API response time: ${RESPONSE_TIME}ms (< 1000ms)${NC}"
    ((WARNINGS++))
else
    echo -e "${RED}❌ API response time: ${RESPONSE_TIME}ms (> 1000ms)${NC}"
    ((FAILED++))
fi

echo
echo "4️⃣  Checking Monitoring Setup Guides..."
echo "---------------------------------------"

# Check for monitoring documentation
check_file() {
    local file_path="$1"
    local description="$2"
    
    if [ -f "$file_path" ]; then
        echo -e "${GREEN}✅ $description exists${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ $description missing${NC}"
        ((FAILED++))
    fi
}

check_file "monitoring/uptime-robot-setup.md" "UptimeRobot setup guide"
check_file "monitoring/sentry-alerts-setup.md" "Sentry alerts guide"
check_file "monitoring/health-check.sh" "Health check script"

echo
echo "5️⃣  Testing CORS Configuration..."
echo "---------------------------------"

# Test CORS headers
CORS_HEADERS=$(curl -I -H "Origin: https://pitchey-5o8.pages.dev" -s "$BACKEND_URL/api/health" 2>/dev/null)

if echo "$CORS_HEADERS" | grep -qi "access-control-allow-origin:"; then
    echo -e "${GREEN}✅ CORS headers present${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ CORS headers missing${NC}"
    ((FAILED++))
fi

echo
echo "6️⃣  Checking Environment Files..."
echo "---------------------------------"

# Check for production environment files
check_file ".env.deploy" "Production environment file"
check_file ".env.local.secrets" "Local secrets file"

# Verify secrets are NOT in git
if git ls-files | grep -q ".env.local.secrets"; then
    echo -e "${RED}❌ WARNING: .env.local.secrets is tracked by git!${NC}"
    ((FAILED++))
else
    echo -e "${GREEN}✅ .env.local.secrets is properly gitignored${NC}"
    ((PASSED++))
fi

echo
echo "7️⃣  Testing Sentry Integration..."
echo "----------------------------------"

# Check if Sentry DSN is configured
if [ -f ".env.deploy" ] && grep -q "SENTRY_DSN" .env.deploy; then
    echo -e "${GREEN}✅ Sentry DSN configured in backend${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Sentry DSN not configured in backend${NC}"
    ((FAILED++))
fi

if [ -f "frontend/.env" ] && grep -q "VITE_SENTRY_DSN" frontend/.env; then
    echo -e "${GREEN}✅ Sentry DSN configured in frontend${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Sentry DSN not configured in frontend${NC}"
    ((FAILED++))
fi

echo
echo "======================================"
echo "📊 RESULTS SUMMARY"
echo "======================================"
echo

TOTAL=$((PASSED + FAILED + WARNINGS))

echo -e "${GREEN}✅ Passed: $PASSED${NC}"
[ $WARNINGS -gt 0 ] && echo -e "${YELLOW}⚠️  Warnings: $WARNINGS${NC}"
[ $FAILED -gt 0 ] && echo -e "${RED}❌ Failed: $FAILED${NC}"

echo
echo "Score: $PASSED/$((PASSED + FAILED)) tests passed"

if [ $FAILED -eq 0 ]; then
    echo
    echo -e "${GREEN}🎉 All quick wins successfully implemented!${NC}"
    echo
    echo "Next steps:"
    echo "1. Go to https://uptimerobot.com and set up monitors"
    echo "2. Go to https://pitchey.sentry.io and configure alerts"
    echo "3. Deploy to production with: ./deploy-secure.sh"
    exit 0
else
    echo
    echo -e "${YELLOW}⚠️  Some quick wins need attention${NC}"
    echo
    echo "Please review the failed items above and:"
    echo "1. Fix any missing configurations"
    echo "2. Run this script again to verify"
    echo "3. Check PRODUCTION_NEXT_STEPS.md for detailed instructions"
    exit 1
fi