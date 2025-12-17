#!/bin/bash

# GitHub Secrets Setup Script
# Automates the configuration of secrets required for the deployment pipeline

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔐 GitHub Secrets Setup Script${NC}"
echo "================================"

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI not found!${NC}"
    echo "Please install with: brew install gh (macOS) or see https://cli.github.com"
    exit 1
fi

# Check authentication
echo -e "${BLUE}Checking GitHub authentication...${NC}"
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not authenticated with GitHub${NC}"
    echo "Running: gh auth login"
    gh auth login
fi

# Get repository info
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo -e "${GREEN}✅ Repository: $REPO${NC}"

# Function to set secret
set_secret() {
    local name=$1
    local value=$2
    local description=$3
    
    echo -e "${BLUE}Setting $name...${NC}"
    echo -e "${YELLOW}$description${NC}"
    
    if [ -z "$value" ]; then
        echo -e "${YELLOW}Enter value for $name:${NC}"
        read -s value
        echo
    fi
    
    echo "$value" | gh secret set "$name"
    echo -e "${GREEN}✅ $name configured${NC}"
    echo
}

# Function to generate secure random string
generate_secret() {
    openssl rand -base64 32
}

echo -e "${BLUE}📋 Required Secrets Configuration${NC}"
echo "===================================="

# 1. NEON_DATABASE_URL
echo -e "${YELLOW}1. NEON_DATABASE_URL${NC}"
echo "Get this from Neon Dashboard → Connection Details → Pooled connection string"
echo "Format: postgresql://user:pass@host/database?sslmode=require"
read -p "Enter Neon Database URL (or press Enter to skip): " NEON_DB_URL
if [ -n "$NEON_DB_URL" ]; then
    set_secret "NEON_DATABASE_URL" "$NEON_DB_URL" "Neon PostgreSQL connection string"
fi

# 2. JWT_SECRET
echo -e "${YELLOW}2. JWT_SECRET${NC}"
echo "A secure random string for JWT signing"
read -p "Generate new JWT secret? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    JWT_SECRET=$(generate_secret)
    echo -e "${GREEN}Generated: $JWT_SECRET${NC}"
    set_secret "JWT_SECRET" "$JWT_SECRET" "JWT signing secret"
else
    read -s -p "Enter JWT secret: " JWT_SECRET
    echo
    set_secret "JWT_SECRET" "$JWT_SECRET" "JWT signing secret"
fi

# 3. CLOUDFLARE_API_TOKEN
echo -e "${YELLOW}3. CLOUDFLARE_API_TOKEN${NC}"
echo "Create at: https://dash.cloudflare.com/profile/api-tokens"
echo "Required permissions:"
echo "  - Account:Cloudflare Workers Scripts:Edit"
echo "  - Account:Account Settings:Read"
echo "  - Zone:Zone:Read"
read -s -p "Enter Cloudflare API Token: " CF_TOKEN
echo
if [ -n "$CF_TOKEN" ]; then
    set_secret "CLOUDFLARE_API_TOKEN" "$CF_TOKEN" "Cloudflare API token for deployments"
fi

# 4. CLOUDFLARE_ACCOUNT_ID
echo -e "${YELLOW}4. CLOUDFLARE_ACCOUNT_ID${NC}"
echo "Find in Cloudflare Dashboard → Right sidebar"
read -p "Enter Cloudflare Account ID: " CF_ACCOUNT_ID
if [ -n "$CF_ACCOUNT_ID" ]; then
    set_secret "CLOUDFLARE_ACCOUNT_ID" "$CF_ACCOUNT_ID" "Cloudflare account identifier"
fi

# 5. Optional: Sentry DSN
echo -e "${YELLOW}5. SENTRY_DSN (Optional)${NC}"
echo "For error tracking. Get from Sentry project settings"
read -p "Enter Sentry DSN (or press Enter to skip): " SENTRY_DSN
if [ -n "$SENTRY_DSN" ]; then
    set_secret "SENTRY_DSN" "$SENTRY_DSN" "Sentry error tracking DSN"
fi

# 6. Optional: Upstash Redis
echo -e "${YELLOW}6. UPSTASH_REDIS (Optional)${NC}"
echo "For caching. Get from Upstash Console → REST API"
read -p "Configure Upstash Redis? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter Upstash Redis REST URL: " REDIS_URL
    read -s -p "Enter Upstash Redis REST Token: " REDIS_TOKEN
    echo
    if [ -n "$REDIS_URL" ]; then
        set_secret "UPSTASH_REDIS_REST_URL" "$REDIS_URL" "Upstash Redis REST URL"
    fi
    if [ -n "$REDIS_TOKEN" ]; then
        set_secret "UPSTASH_REDIS_REST_TOKEN" "$REDIS_TOKEN" "Upstash Redis REST Token"
    fi
fi

# 7. Optional: Hyperdrive Config ID
echo -e "${YELLOW}7. HYPERDRIVE_CONFIG_ID (Optional)${NC}"
echo "For database connection pooling"
read -p "Enter Hyperdrive Config ID (or press Enter to skip): " HYPERDRIVE_ID
if [ -n "$HYPERDRIVE_ID" ]; then
    set_secret "HYPERDRIVE_CONFIG_ID" "$HYPERDRIVE_ID" "Cloudflare Hyperdrive configuration"
fi

# 8. Optional: Rate Limiter Namespace
echo -e "${YELLOW}8. RATE_LIMITER_NAMESPACE_ID (Optional)${NC}"
echo "For API rate limiting"
read -p "Enter Rate Limiter Namespace ID (or press Enter to skip): " RATE_LIMITER_ID
if [ -n "$RATE_LIMITER_ID" ]; then
    set_secret "RATE_LIMITER_NAMESPACE_ID" "$RATE_LIMITER_ID" "Rate limiter configuration"
fi

echo
echo -e "${GREEN}=== Configuration Complete ===${NC}"
echo

# Verify secrets
echo -e "${BLUE}📊 Configured Secrets:${NC}"
gh secret list

echo
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Verify all secrets are configured correctly"
echo "2. Test the deployment workflow:"
echo "   gh workflow run deploy-worker.yml"
echo "3. Monitor the deployment:"
echo "   gh run watch"
echo
echo -e "${GREEN}✅ Setup complete!${NC}"