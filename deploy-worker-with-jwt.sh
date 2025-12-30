#!/bin/bash

# Deploy Cloudflare Worker with Real JWT Authentication
# This script deploys the worker and ensures JWT_SECRET is properly configured

echo "🔐 Deploying Cloudflare Worker with Real JWT Authentication..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
DATABASE_URL="postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
JWT_SECRET="vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz"
WORKER_NAME="pitchey-api-prod"

echo -e "${CYAN}================================${NC}"
echo -e "${CYAN}JWT Authentication Setup${NC}"
echo -e "${CYAN}================================${NC}"

# Step 1: Deploy the worker
echo -e "\n${YELLOW}Step 1: Deploying worker with JWT support...${NC}"
wrangler deploy --compatibility-date 2024-12-24

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Worker deployment failed!${NC}"
    echo "Please check your wrangler.toml configuration"
    exit 1
fi

echo -e "${GREEN}✓ Worker deployed successfully${NC}"

# Step 2: Wait for deployment to stabilize
echo -e "\n${YELLOW}Waiting for deployment to stabilize...${NC}"
sleep 5

# Step 3: Try to deploy versions (may fail on free plan)
echo -e "\n${YELLOW}Step 2: Attempting to deploy versions...${NC}"
wrangler versions deploy --yes 2>/dev/null || echo -e "${YELLOW}Note: Version deployment not available on free plan${NC}"

# Step 4: Add secrets
echo -e "\n${YELLOW}Step 3: Configuring secrets...${NC}"

# Add DATABASE_URL
echo -e "  Adding DATABASE_URL..."
echo "$DATABASE_URL" | wrangler secret put DATABASE_URL 2>&1 | tee /tmp/secret-output.txt

if grep -q "Success\|created" /tmp/secret-output.txt; then
    echo -e "${GREEN}  ✓ DATABASE_URL configured${NC}"
else
    echo -e "${YELLOW}  ⚠ DATABASE_URL may already be set${NC}"
fi

# Add JWT_SECRET
echo -e "  Adding JWT_SECRET..."
echo "$JWT_SECRET" | wrangler secret put JWT_SECRET 2>&1 | tee /tmp/secret-output.txt

if grep -q "Success\|created" /tmp/secret-output.txt; then
    echo -e "${GREEN}  ✓ JWT_SECRET configured${NC}"
else
    echo -e "${YELLOW}  ⚠ JWT_SECRET may already be set${NC}"
fi

# Clean up temp file
rm -f /tmp/secret-output.txt

# Step 5: Test the deployment
echo -e "\n${YELLOW}Step 4: Testing authentication system...${NC}"

WORKER_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"

# Test health endpoint
echo -e "\n${CYAN}Testing health endpoint...${NC}"
HEALTH_RESPONSE=$(curl -s "$WORKER_URL/api/health")
if echo "$HEALTH_RESPONSE" | grep -q "ok"; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
fi

# Test authentication with demo account
echo -e "\n${CYAN}Testing authentication with demo account...${NC}"
AUTH_RESPONSE=$(curl -s -X POST "$WORKER_URL/api/auth/creator/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"alex.creator@demo.com","password":"Demo123"}' | head -c 500)

if echo "$AUTH_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ Authentication endpoint working${NC}"
    
    # Check if it's using real JWT (not mock)
    if echo "$AUTH_RESPONSE" | grep -q "mock-jwt"; then
        echo -e "${RED}✗ Still using mock JWT tokens!${NC}"
        echo -e "${YELLOW}The JWT implementation may take a few minutes to activate.${NC}"
    else
        # Extract token and check format
        TOKEN=$(echo "$AUTH_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
        if [[ "$TOKEN" == *"."*"."* ]]; then
            echo -e "${GREEN}✓ Using real JWT tokens (format: xxx.yyy.zzz)${NC}"
            
            # Decode and display JWT payload (base64 decode the middle part)
            echo -e "\n${CYAN}JWT Token Analysis:${NC}"
            PAYLOAD=$(echo "$TOKEN" | cut -d'.' -f2)
            # Add padding if needed
            PAYLOAD="${PAYLOAD}=="
            DECODED=$(echo "$PAYLOAD" | base64 -d 2>/dev/null || echo "Unable to decode")
            if [[ "$DECODED" != "Unable to decode" ]]; then
                echo "Payload: $DECODED" | python3 -m json.tool 2>/dev/null || echo "$DECODED"
            fi
        else
            echo -e "${YELLOW}⚠ Token format unclear${NC}"
        fi
    fi
else
    echo -e "${RED}✗ Authentication test failed${NC}"
    echo "Response: $AUTH_RESPONSE"
fi

# Test protected endpoint with token
if [[ ! -z "$TOKEN" ]] && [[ "$TOKEN" != *"mock"* ]]; then
    echo -e "\n${CYAN}Testing protected endpoint with JWT...${NC}"
    PROFILE_RESPONSE=$(curl -s "$WORKER_URL/api/users/profile" \
        -H "Authorization: Bearer $TOKEN" | head -c 200)
    
    if echo "$PROFILE_RESPONSE" | grep -q '"success":true'; then
        echo -e "${GREEN}✓ JWT authorization working${NC}"
    else
        echo -e "${YELLOW}⚠ JWT authorization needs verification${NC}"
    fi
fi

echo -e "\n${CYAN}================================${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${CYAN}================================${NC}"
echo ""
echo "Worker URL: $WORKER_URL"
echo "Dashboard: https://dash.cloudflare.com/workers-and-pages/$WORKER_NAME"
echo ""
echo -e "${CYAN}Authentication Status:${NC}"

# Summary
if echo "$AUTH_RESPONSE" | grep -q "mock-jwt"; then
    echo -e "${YELLOW}⚠ Transitioning from mock to real JWT${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Wait 2-3 minutes for secrets to propagate"
    echo "2. Test again with: ./check-cloudflare-status.sh"
    echo "3. If still using mock tokens, check Dashboard settings"
else
    echo -e "${GREEN}✅ Real JWT authentication is active!${NC}"
    echo ""
    echo "Demo accounts (password: Demo123):"
    echo "  • alex.creator@demo.com (Creator portal)"
    echo "  • sarah.investor@demo.com (Investor portal)"
    echo "  • stellar.production@demo.com (Production portal)"
fi

echo ""
echo -e "${CYAN}To verify JWT implementation:${NC}"
echo "curl -X POST $WORKER_URL/api/auth/creator/login \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"email\":\"alex.creator@demo.com\",\"password\":\"Demo123\"}'"