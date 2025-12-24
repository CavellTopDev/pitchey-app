#!/bin/bash

# Deployment script for Cloudflare Worker with secrets
# This handles the versioning issue and properly sets up secrets

echo "🚀 Starting Cloudflare Worker deployment with secrets..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DATABASE_URL="postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
JWT_SECRET="vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz"

echo -e "${YELLOW}Step 1: Deploying worker...${NC}"
wrangler deploy --compatibility-date 2024-12-24

if [ $? -ne 0 ]; then
    echo -e "${RED}Worker deployment failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Worker deployed successfully${NC}"

# Wait for deployment to stabilize
echo -e "${YELLOW}Waiting for deployment to stabilize...${NC}"
sleep 5

echo -e "${YELLOW}Step 2: Deploying worker versions...${NC}"
wrangler versions deploy --yes

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}Version deployment failed, trying alternative approach...${NC}"
    # Alternative: Deploy without versions if gradual rollout is not set up
    wrangler deploy --compatibility-date 2024-12-24
fi

echo -e "${YELLOW}Step 3: Adding secrets...${NC}"

# Add DATABASE_URL secret
echo -e "${YELLOW}Adding DATABASE_URL secret...${NC}"
echo "$DATABASE_URL" | wrangler secret put DATABASE_URL

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to add DATABASE_URL secret${NC}"
    echo -e "${YELLOW}Trying alternative method...${NC}"
    # Try with explicit environment if configured
    echo "$DATABASE_URL" | wrangler secret put DATABASE_URL --env production 2>/dev/null || \
    echo "$DATABASE_URL" | wrangler secret put DATABASE_URL
fi

# Add JWT_SECRET
echo -e "${YELLOW}Adding JWT_SECRET...${NC}"
echo "$JWT_SECRET" | wrangler secret put JWT_SECRET

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to add JWT_SECRET${NC}"
    echo -e "${YELLOW}Trying alternative method...${NC}"
    echo "$JWT_SECRET" | wrangler secret put JWT_SECRET --env production 2>/dev/null || \
    echo "$JWT_SECRET" | wrangler secret put JWT_SECRET
fi

# Add optional Hyperdrive configuration if needed
echo -e "${YELLOW}Step 4: Checking Hyperdrive configuration...${NC}"
if grep -q "hyperdrive" wrangler.toml; then
    echo -e "${GREEN}✓ Hyperdrive configuration found${NC}"
else
    echo -e "${YELLOW}No Hyperdrive configuration found (optional)${NC}"
fi

echo -e "${YELLOW}Step 5: Testing deployment...${NC}"

# Test the health endpoint
WORKER_URL="https://pitchey-api-prod.cavelltheleaddev.workers.dev"
echo "Testing $WORKER_URL/api/health..."

HEALTH_RESPONSE=$(curl -s "$WORKER_URL/api/health")
if echo "$HEALTH_RESPONSE" | grep -q "ok"; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}Health check failed or returned unexpected response${NC}"
    echo "Response: $HEALTH_RESPONSE"
fi

# Test database connection by checking pitches endpoint
echo -e "${YELLOW}Testing database connection...${NC}"
PITCHES_RESPONSE=$(curl -s "$WORKER_URL/api/pitches" | head -c 200)

if echo "$PITCHES_RESPONSE" | grep -q "Mock Pitch"; then
    echo -e "${RED}⚠ API is still returning mock data!${NC}"
    echo -e "${YELLOW}The secrets may take a few minutes to propagate.${NC}"
    echo -e "${YELLOW}Alternative: Add secrets via Cloudflare Dashboard:${NC}"
    echo "1. Go to https://dash.cloudflare.com"
    echo "2. Navigate to Workers & Pages → pitchey-api-prod"
    echo "3. Click Settings → Variables and Secrets"
    echo "4. Add DATABASE_URL and JWT_SECRET"
else
    echo -e "${GREEN}✓ API appears to be using real database${NC}"
fi

echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. If still seeing mock data, wait 2-3 minutes for secrets to propagate"
echo "2. Or add secrets manually via Cloudflare Dashboard"
echo "3. Test the API at: $WORKER_URL/api/pitches"
echo ""
echo "Dashboard URL: https://dash.cloudflare.com/workers-and-pages/pitchey-api-prod"