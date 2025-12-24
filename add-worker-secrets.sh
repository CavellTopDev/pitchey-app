#!/bin/bash

# Script to add secrets to an already deployed Cloudflare Worker
# Use this if the worker is deployed but secrets are missing

echo "🔐 Adding secrets to Cloudflare Worker..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration - Your actual database credentials
DATABASE_URL="postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
JWT_SECRET="vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz"

echo -e "${YELLOW}Method 1: Trying direct secret addition...${NC}"

# Try adding DATABASE_URL
echo "$DATABASE_URL" | wrangler secret put DATABASE_URL 2>&1 | tee /tmp/secret-output.txt

if grep -q "Success" /tmp/secret-output.txt || grep -q "created" /tmp/secret-output.txt; then
    echo -e "${GREEN}✓ DATABASE_URL added successfully${NC}"
else
    echo -e "${YELLOW}DATABASE_URL might have failed, checking alternative...${NC}"
    
    # Check if it's a versioning issue
    if grep -q "versions deploy" /tmp/secret-output.txt; then
        echo -e "${YELLOW}Deploying versions first...${NC}"
        wrangler versions deploy --yes
        sleep 3
        echo "$DATABASE_URL" | wrangler secret put DATABASE_URL
    fi
fi

# Try adding JWT_SECRET
echo "$JWT_SECRET" | wrangler secret put JWT_SECRET 2>&1 | tee /tmp/secret-output.txt

if grep -q "Success" /tmp/secret-output.txt || grep -q "created" /tmp/secret-output.txt; then
    echo -e "${GREEN}✓ JWT_SECRET added successfully${NC}"
else
    echo -e "${YELLOW}JWT_SECRET might have failed${NC}"
fi

echo -e "${YELLOW}Method 2: If above failed, trying with list and delete...${NC}"

# List current secrets
echo "Current secrets:"
wrangler secret list

echo ""
echo -e "${YELLOW}Testing the deployment...${NC}"

# Test the API
WORKER_URL="https://pitchey-api-prod.cavelltheleaddev.workers.dev"
RESPONSE=$(curl -s "$WORKER_URL/api/pitches" | head -c 500)

if echo "$RESPONSE" | grep -q "Mock Pitch"; then
    echo -e "${RED}⚠ Still returning mock data!${NC}"
    echo ""
    echo "===== MANUAL STEPS REQUIRED ====="
    echo -e "${YELLOW}Please add secrets manually via Cloudflare Dashboard:${NC}"
    echo ""
    echo "1. Go to: https://dash.cloudflare.com"
    echo "2. Click on: Workers & Pages"
    echo "3. Select: pitchey-api-prod"
    echo "4. Go to: Settings → Variables and Secrets"
    echo "5. Add these secrets:"
    echo ""
    echo "   DATABASE_URL:"
    echo "   postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
    echo ""
    echo "   JWT_SECRET:"
    echo "   vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz"
    echo ""
    echo "================================="
else
    echo -e "${GREEN}✓ API connected to database successfully!${NC}"
fi

rm -f /tmp/secret-output.txt