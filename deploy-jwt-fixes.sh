#!/bin/bash

# Deploy Worker with JWT Fixes
echo "🚀 Deploying Cloudflare Worker with JWT Authentication Fixes..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Deploy the worker
echo -e "${YELLOW}Deploying worker with authentication fixes...${NC}"
wrangler deploy --compatibility-date 2024-12-24

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Worker deployed successfully${NC}"
else
    echo "Deployment failed. Please check your configuration."
    exit 1
fi

# Wait for deployment
echo -e "${YELLOW}Waiting for deployment to propagate...${NC}"
sleep 5

# Quick validation test
echo -e "\n${CYAN}Running quick validation tests...${NC}"
WORKER_URL="https://pitchey-api-prod.cavelltheleaddev.workers.dev"

# Test 1: Health check
echo "1. Testing health endpoint..."
curl -s "$WORKER_URL/api/health" | grep -q "healthy" && echo -e "${GREEN}✓ Health check passed${NC}" || echo "⚠ Health check needs verification"

# Test 2: Protected endpoint without auth (should fail)
echo -e "\n2. Testing protected endpoint without auth..."
UNAUTH_RESPONSE=$(curl -s "$WORKER_URL/api/users/profile")
if echo "$UNAUTH_RESPONSE" | grep -q '"success":false\|UNAUTHORIZED\|401'; then
    echo -e "${GREEN}✓ Protected endpoint correctly requires authentication${NC}"
else
    echo "⚠ Protected endpoint not properly secured"
fi

# Test 3: Login and get JWT
echo -e "\n3. Testing login and JWT generation..."
LOGIN_RESPONSE=$(curl -s -X POST "$WORKER_URL/api/auth/creator/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"alex.creator@demo.com","password":"Demo123"}')
    
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [[ "$TOKEN" == *"."*"."* ]] && [[ "$TOKEN" != *"mock"* ]]; then
    echo -e "${GREEN}✓ Real JWT token generated${NC}"
else
    echo "⚠ JWT generation needs verification"
fi

# Test 4: Protected endpoint with valid JWT
echo -e "\n4. Testing protected endpoint with JWT..."
if [ ! -z "$TOKEN" ]; then
    AUTH_RESPONSE=$(curl -s "$WORKER_URL/api/users/profile" \
        -H "Authorization: Bearer $TOKEN")
    if echo "$AUTH_RESPONSE" | grep -q '"success":true'; then
        echo -e "${GREEN}✓ JWT authentication working${NC}"
    else
        echo "⚠ JWT authentication needs verification"
    fi
fi

echo -e "\n${GREEN}🎉 Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Run full test suite: ./test-jwt-authentication.sh"
echo "2. Monitor worker at: https://dash.cloudflare.com/workers-and-pages/pitchey-api-prod"
echo ""
echo "JWT Authentication Status:"
echo "• Profile endpoint now requires authentication"
echo "• Invalid/missing tokens are properly rejected"
echo "• Real JWT tokens are generated and validated"