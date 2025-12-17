#!/bin/bash

# Setup Remaining GitHub Secrets
# Neon already configured NEON_API_KEY and NEON_PROJECT_ID for us!

set -e

echo "🔐 Setting up remaining GitHub secrets for CI/CD pipeline"
echo "======================================================="
echo ""
echo "✅ NEON_API_KEY - Already configured by Neon"
echo "✅ NEON_PROJECT_ID - Already configured by Neon"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to set a secret
set_secret() {
    local name=$1
    local description=$2
    
    echo -e "${BLUE}Setting: $name${NC}"
    echo "Description: $description"
    echo -e "${YELLOW}Enter value:${NC}"
    read -s value
    echo ""
    
    echo "$value" | gh secret set "$name"
    echo -e "${GREEN}✅ $name set successfully${NC}"
    echo ""
}

echo "Setting up remaining secrets needed for your workflows..."
echo ""

# 1. Database URL (most important)
echo -e "${YELLOW}1. NEON_DATABASE_URL${NC}"
echo "This is your production database connection string"
echo "Get from: Neon Console → Connection Details → Pooled connection"
echo "IMPORTANT: Use your NEW password (after reset)"
echo "Format: postgresql://neondb_owner:NEW_PASSWORD@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
set_secret "NEON_DATABASE_URL" "Production database connection string"

# 2. Cloudflare tokens
echo -e "${YELLOW}2. CLOUDFLARE_API_TOKEN${NC}"
echo "Get from: Cloudflare Dashboard → My Profile → API Tokens"
echo "Use template: Edit Cloudflare Workers"
set_secret "CLOUDFLARE_API_TOKEN" "Cloudflare API token for deployments"

echo -e "${YELLOW}3. CLOUDFLARE_ACCOUNT_ID${NC}"
echo "Get from: Cloudflare Dashboard → Right sidebar → Account ID"
set_secret "CLOUDFLARE_ACCOUNT_ID" "Cloudflare account identifier"

# 3. JWT Secret
echo -e "${YELLOW}4. JWT_SECRET${NC}"
echo "Generating secure JWT secret automatically..."
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
echo "$JWT_SECRET" | gh secret set "JWT_SECRET"
echo -e "${GREEN}✅ JWT_SECRET generated and set${NC}"
echo ""

# 4. Redis (optional)
echo -e "${YELLOW}5. Redis Cache (Upstash)${NC}"
read -p "Do you have Upstash Redis configured? (y/n): " has_redis
if [[ $has_redis == "y" ]]; then
    set_secret "UPSTASH_REDIS_REST_URL" "Upstash Redis endpoint URL"
    set_secret "UPSTASH_REDIS_REST_TOKEN" "Upstash Redis auth token"
else
    echo "Skipping Redis - you can add this later if needed"
    echo ""
fi

# 5. Optional services
echo -e "${YELLOW}6. Optional Services${NC}"
read -p "Set up Sentry error tracking? (y/n): " setup_sentry
if [[ $setup_sentry == "y" ]]; then
    set_secret "SENTRY_DSN" "Sentry error tracking DSN"
fi

echo ""
echo -e "${GREEN}🎉 GitHub secrets setup complete!${NC}"
echo ""
echo "Current secrets:"
gh secret list
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Test the integration with a PR"
echo "2. Verify automatic branch creation"
echo "3. Check preview deployments"
echo ""
echo "Run this to test:"
echo "git checkout -b test-integration && git commit --allow-empty -m 'test: CI/CD' && git push origin test-integration"