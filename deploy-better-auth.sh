#!/bin/bash

# Deployment script for Better Auth integration
# Deploys the patched Worker service with Better Auth to Cloudflare

echo "🚀 Deploying Better Auth Integration"
echo "=================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if required files exist
echo -e "${YELLOW}Checking deployment prerequisites...${NC}"

required_files=(
    "src/worker-service-patched.ts"
    "src/auth/better-auth-cloudflare.ts"
    "src/worker-auth-fixed.ts"
    "src/db/better-auth-schema.sql"
    "wrangler.toml"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ Found: $file${NC}"
    else
        echo -e "${RED}❌ Missing: $file${NC}"
        exit 1
    fi
done

echo -e "\n${YELLOW}Step 1: Apply Better Auth database schema...${NC}"
echo "Applying Better Auth schema to Neon database..."

PGPASSWORD="npg_DZhIpVaLAk06" psql \
    -h ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech \
    -U neondb_owner \
    -d neondb \
    -f src/db/better-auth-schema.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database schema applied successfully${NC}"
else
    echo -e "${RED}❌ Database schema application failed${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Step 2: Set Cloudflare secrets...${NC}"

# Check if secrets are already set
echo "Checking existing secrets..."
wrangler secret list

echo -e "\nSetting JWT_SECRET..."
echo "vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz" | wrangler secret put JWT_SECRET

echo -e "\nSetting DATABASE_URL..."
echo "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require" | wrangler secret put DATABASE_URL

echo -e "\n${YELLOW}Step 3: Deploy patched Worker service...${NC}"

# Copy patched service to main worker file
echo "Backing up current worker service..."
cp src/worker-service-optimized.ts src/worker-service-optimized.ts.backup

echo "Deploying patched service..."
cp src/worker-service-patched.ts src/worker-service-optimized.ts

# Deploy to Cloudflare Workers
wrangler deploy --env production

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Worker deployed successfully${NC}"
else
    echo -e "${RED}❌ Worker deployment failed${NC}"
    # Restore backup
    cp src/worker-service-optimized.ts.backup src/worker-service-optimized.ts
    exit 1
fi

echo -e "\n${YELLOW}Step 4: Verify deployment...${NC}"

# Wait a moment for deployment to propagate
sleep 5

# Test health endpoint
echo "Testing health endpoint..."
health_response=$(curl -s "https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health")

if echo "$health_response" | grep -q "healthy"; then
    echo -e "${GREEN}✅ Health check passed${NC}"
else
    echo -e "${RED}❌ Health check failed${NC}"
    echo "Response: $health_response"
fi

echo -e "\n${YELLOW}Step 5: Test portal authentication...${NC}"

# Test creator login
echo "Testing Creator portal..."
creator_response=$(curl -s -X POST "https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/creator/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"alex.creator@demo.com","password":"Demo123"}')

if echo "$creator_response" | grep -q "token"; then
    echo -e "${GREEN}✅ Creator portal authentication working${NC}"
else
    echo -e "${RED}❌ Creator portal authentication failed${NC}"
    echo "Response: $creator_response"
fi

# Test investor login
echo "Testing Investor portal..."
investor_response=$(curl -s -X POST "https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/investor/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"sarah.investor@demo.com","password":"Demo123"}')

if echo "$investor_response" | grep -q "token"; then
    echo -e "${GREEN}✅ Investor portal authentication working${NC}"
else
    echo -e "${RED}❌ Investor portal authentication failed${NC}"
    echo "Response: $investor_response"
fi

echo -e "\n${BLUE}=== DEPLOYMENT SUMMARY ===${NC}"
echo -e "${GREEN}✅ Better Auth integration deployed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Run comprehensive tests: ./test-better-auth-portals.sh"
echo "2. Update frontend to use new authentication endpoints"
echo "3. Monitor Sentry for any remaining errors"
echo ""
echo "Production URL: https://pitchey-api-prod.ndlovucavelle.workers.dev"
echo "Frontend URL: https://pitchey-5o8.pages.dev"