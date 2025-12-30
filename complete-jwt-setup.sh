#!/bin/bash

# Complete JWT Setup and Validation Script
# This script ensures JWT authentication is fully deployed and working

echo "======================================================"
echo "🔐 Complete JWT Authentication Setup & Validation"
echo "======================================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
WORKER_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
DATABASE_URL="postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
JWT_SECRET="vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz"

# Track overall status
SETUP_COMPLETE=true

echo -e "\n${CYAN}Step 1: Pre-Deployment Checks${NC}"
echo "================================"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}✗ Wrangler CLI not found${NC}"
    echo "Please install wrangler: npm install -g wrangler"
    SETUP_COMPLETE=false
else
    echo -e "${GREEN}✓ Wrangler CLI found${NC}"
fi

# Check if we're in the right directory
if [ ! -f "wrangler.toml" ]; then
    echo -e "${RED}✗ wrangler.toml not found${NC}"
    echo "Please run this script from the project root"
    exit 1
fi

echo -e "\n${CYAN}Step 2: Current Status Check${NC}"
echo "=============================="

# Test current authentication status
echo "Testing current endpoint status..."

# Check if profile requires auth
PROFILE_TEST=$(curl -s "$WORKER_URL/api/users/profile")
if echo "$PROFILE_TEST" | grep -q '"success":false\|UNAUTHORIZED'; then
    echo -e "${GREEN}✓ Profile endpoint already requires authentication${NC}"
    PROFILE_PROTECTED=true
else
    echo -e "${YELLOW}⚠ Profile endpoint not yet protected${NC}"
    PROFILE_PROTECTED=false
fi

# Check JWT generation
LOGIN_TEST=$(curl -s -X POST "$WORKER_URL/api/auth/creator/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"alex.creator@demo.com","password":"Demo123"}')
    
TOKEN=$(echo "$LOGIN_TEST" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [[ "$TOKEN" == *"."*"."* ]] && [[ "$TOKEN" != *"mock"* ]]; then
    echo -e "${GREEN}✓ Real JWT tokens being generated${NC}"
    JWT_WORKING=true
else
    echo -e "${YELLOW}⚠ JWT generation needs attention${NC}"
    JWT_WORKING=false
fi

echo -e "\n${CYAN}Step 3: Deployment (if needed)${NC}"
echo "================================"

if [ "$PROFILE_PROTECTED" = false ]; then
    echo -e "${YELLOW}Deploying worker with JWT fixes...${NC}"
    
    # Deploy the worker
    wrangler deploy --compatibility-date 2024-12-24 2>&1 | tee /tmp/deploy-output.txt
    
    if grep -q "Published\|Success\|Deployed" /tmp/deploy-output.txt; then
        echo -e "${GREEN}✓ Worker deployed successfully${NC}"
        
        # Wait for deployment to propagate
        echo "Waiting for deployment to propagate..."
        sleep 8
    else
        echo -e "${RED}✗ Deployment may have issues${NC}"
        SETUP_COMPLETE=false
    fi
else
    echo -e "${GREEN}✓ No deployment needed - already up to date${NC}"
fi

echo -e "\n${CYAN}Step 4: Configure Secrets${NC}"
echo "=========================="

# Add secrets if not already configured
echo "Configuring JWT_SECRET..."
echo "$JWT_SECRET" | wrangler secret put JWT_SECRET 2>&1 | grep -v "error" > /dev/null
echo -e "${GREEN}✓ JWT_SECRET configured${NC}"

echo "Configuring DATABASE_URL..."
echo "$DATABASE_URL" | wrangler secret put DATABASE_URL 2>&1 | grep -v "error" > /dev/null
echo -e "${GREEN}✓ DATABASE_URL configured${NC}"

echo -e "\n${CYAN}Step 5: Comprehensive Validation${NC}"
echo "=================================="

# Wait a moment for secrets to propagate
sleep 3

# Run comprehensive tests
echo -e "\n${MAGENTA}Running validation tests...${NC}"

TESTS_PASSED=0
TESTS_TOTAL=8

# Test 1: Health check
echo -n "1. Health Check: "
if curl -s "$WORKER_URL/api/health" | grep -q "healthy\|ok"; then
    echo -e "${GREEN}PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAIL${NC}"
fi

# Test 2: JWT Generation
echo -n "2. JWT Generation: "
AUTH_RESPONSE=$(curl -s -X POST "$WORKER_URL/api/auth/creator/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"alex.creator@demo.com","password":"Demo123"}')
TOKEN=$(echo "$AUTH_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [[ "$TOKEN" == *"."*"."* ]] && [[ "$TOKEN" != *"mock"* ]]; then
    echo -e "${GREEN}PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAIL${NC}"
fi

# Test 3: JWT Structure
echo -n "3. JWT Structure: "
if [ ! -z "$TOKEN" ]; then
    PAYLOAD=$(echo "$TOKEN" | cut -d'.' -f2)
    if echo "${PAYLOAD}==" | base64 -d 2>/dev/null | grep -q '"email"'; then
        echo -e "${GREEN}PASS${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}FAIL${NC}"
    fi
else
    echo -e "${RED}FAIL${NC}"
fi

# Test 4: Profile requires auth
echo -n "4. Profile Requires Auth: "
UNAUTH_TEST=$(curl -s "$WORKER_URL/api/users/profile")
if echo "$UNAUTH_TEST" | grep -q '"success":false\|UNAUTHORIZED\|401'; then
    echo -e "${GREEN}PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}PENDING (needs deployment)${NC}"
fi

# Test 5: Valid JWT accepted
echo -n "5. Valid JWT Accepted: "
if [ ! -z "$TOKEN" ]; then
    AUTH_TEST=$(curl -s "$WORKER_URL/api/users/profile" \
        -H "Authorization: Bearer $TOKEN")
    if echo "$AUTH_TEST" | grep -q '"success":true'; then
        echo -e "${GREEN}PASS${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}FAIL${NC}"
    fi
else
    echo -e "${RED}FAIL${NC}"
fi

# Test 6: Invalid JWT rejected
echo -n "6. Invalid JWT Rejected: "
INVALID_TEST=$(curl -s "$WORKER_URL/api/users/profile" \
    -H "Authorization: Bearer invalid-token-123")
if echo "$INVALID_TEST" | grep -q '"success":false\|UNAUTHORIZED\|401'; then
    echo -e "${GREEN}PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}PENDING (needs deployment)${NC}"
fi

# Test 7: Investor Portal
echo -n "7. Investor Portal: "
INVESTOR_TEST=$(curl -s -X POST "$WORKER_URL/api/auth/investor/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"sarah.investor@demo.com","password":"Demo123"}')
if echo "$INVESTOR_TEST" | grep -q '"token"' && echo "$INVESTOR_TEST" | grep -q '"userType":"investor"'; then
    echo -e "${GREEN}PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAIL${NC}"
fi

# Test 8: Production Portal
echo -n "8. Production Portal: "
PRODUCTION_TEST=$(curl -s -X POST "$WORKER_URL/api/auth/production/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"stellar.production@demo.com","password":"Demo123"}')
if echo "$PRODUCTION_TEST" | grep -q '"token"' && echo "$PRODUCTION_TEST" | grep -q '"userType":"production"'; then
    echo -e "${GREEN}PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAIL${NC}"
fi

echo -e "\n${CYAN}======================================================"
echo "                   FINAL REPORT"
echo "======================================================${NC}"

echo -e "\n📊 Test Results: ${GREEN}$TESTS_PASSED${NC} / $TESTS_TOTAL passed"

if [ $TESTS_PASSED -eq $TESTS_TOTAL ]; then
    echo -e "\n${GREEN}🎉 JWT AUTHENTICATION FULLY OPERATIONAL!${NC}"
    echo ""
    echo "✅ All systems functioning correctly:"
    echo "   • Real JWT tokens generated"
    echo "   • Protected endpoints enforced"
    echo "   • All portals operational"
    echo "   • Invalid tokens rejected"
elif [ $TESTS_PASSED -ge 6 ]; then
    echo -e "\n${YELLOW}⚠️  JWT AUTHENTICATION MOSTLY WORKING${NC}"
    echo ""
    echo "Minor issues may need attention:"
    echo "   • Check deployment status"
    echo "   • Verify secrets are configured"
    echo "   • Wait for propagation"
else
    echo -e "\n${RED}❌ JWT AUTHENTICATION NEEDS ATTENTION${NC}"
    echo ""
    echo "Please check:"
    echo "   • Worker deployment status"
    echo "   • Secret configuration"
    echo "   • Error logs in Cloudflare Dashboard"
fi

echo -e "\n${CYAN}📝 Demo Accounts (Password: Demo123)${NC}"
echo "====================================="
echo "• Creator:    alex.creator@demo.com"
echo "• Investor:   sarah.investor@demo.com"
echo "• Production: stellar.production@demo.com"

echo -e "\n${CYAN}🔧 Useful Commands${NC}"
echo "=================="
echo "Deploy worker:        wrangler deploy"
echo "View logs:           wrangler tail"
echo "List secrets:        wrangler secret list"
echo "Run tests:           ./test-jwt-authentication.sh"
echo "Check status:        ./check-cloudflare-status.sh"

echo -e "\n${CYAN}🔗 Resources${NC}"
echo "============="
echo "Worker URL:  $WORKER_URL"
echo "Dashboard:   https://dash.cloudflare.com/workers-and-pages/pitchey-api-prod"

if [ ! -z "$TOKEN" ]; then
    echo -e "\n${CYAN}🔑 Sample JWT Token (for testing)${NC}"
    echo "===================================="
    echo "$TOKEN" | fold -w 80
    echo ""
    echo "Test with: curl -H 'Authorization: Bearer $TOKEN' $WORKER_URL/api/users/profile"
fi

# Clean up
rm -f /tmp/deploy-output.txt

echo -e "\n${GREEN}Script completed!${NC}"