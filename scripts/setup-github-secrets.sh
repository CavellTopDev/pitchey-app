#!/bin/bash

# GitHub Secrets Setup Script
# This script helps you set up all required GitHub secrets for Neon integration

set -e

echo "🔐 GitHub Secrets Setup for Pitchey + Neon Integration"
echo "======================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) is not installed.${NC}"
    echo "Please install it from: https://cli.github.com/"
    exit 1
fi

# Check if logged in to GitHub
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}⚠️  You need to login to GitHub CLI${NC}"
    gh auth login
fi

echo -e "${GREEN}✅ GitHub CLI is ready${NC}"
echo ""

# Function to set a secret
set_secret() {
    local name=$1
    local value=$2
    local description=$3
    
    echo -e "${BLUE}Setting secret: $name${NC}"
    echo "Description: $description"
    
    if [ -z "$value" ]; then
        echo -e "${YELLOW}Enter value for $name:${NC}"
        read -s value
        echo ""
    fi
    
    echo "$value" | gh secret set "$name"
    echo -e "${GREEN}✅ $name set successfully${NC}"
    echo ""
}

# Get repository info
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo -e "${BLUE}Repository: $REPO${NC}"
echo ""

echo "📋 Required Secrets Checklist:"
echo "==============================="
echo ""

# 1. NEON SECRETS
echo -e "${YELLOW}1. NEON DATABASE SECRETS${NC}"
echo "Get these from: https://console.neon.tech"
echo ""

echo "Getting NEON_PROJECT_ID..."
echo "In Neon Console → Your Project → Settings → General → Project ID"
read -p "Enter your Neon Project ID: " NEON_PROJECT_ID
set_secret "NEON_PROJECT_ID" "$NEON_PROJECT_ID" "Your Neon project identifier"

echo "Getting NEON_API_KEY..."
echo "In Neon Console → Account Settings → API Keys → Create new"
read -p "Enter your Neon API Key: " NEON_API_KEY
set_secret "NEON_API_KEY" "$NEON_API_KEY" "Neon API key for branch management"

echo "Getting NEON_DATABASE_URL..."
echo "In Neon Console → Your Project → Connection Details"
echo "Use the POOLED connection string with your NEW password"
read -p "Enter your Neon Database URL: " NEON_DATABASE_URL
set_secret "NEON_DATABASE_URL" "$NEON_DATABASE_URL" "Production database connection string"

# 2. CLOUDFLARE SECRETS
echo ""
echo -e "${YELLOW}2. CLOUDFLARE SECRETS${NC}"
echo "Get these from: https://dash.cloudflare.com"
echo ""

echo "Getting CLOUDFLARE_API_TOKEN..."
echo "Cloudflare → My Profile → API Tokens → Create Token"
echo "Use template: Edit Cloudflare Workers"
read -p "Enter your Cloudflare API Token: " CLOUDFLARE_API_TOKEN
set_secret "CLOUDFLARE_API_TOKEN" "$CLOUDFLARE_API_TOKEN" "Cloudflare API token for deployments"

echo "Getting CLOUDFLARE_ACCOUNT_ID..."
echo "Cloudflare → Right sidebar → Account ID"
read -p "Enter your Cloudflare Account ID: " CLOUDFLARE_ACCOUNT_ID
set_secret "CLOUDFLARE_ACCOUNT_ID" "$CLOUDFLARE_ACCOUNT_ID" "Your Cloudflare account identifier"

# 3. APPLICATION SECRETS
echo ""
echo -e "${YELLOW}3. APPLICATION SECRETS${NC}"
echo ""

# Generate a secure JWT secret
echo "Generating secure JWT_SECRET..."
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
set_secret "JWT_SECRET" "$JWT_SECRET" "JWT signing secret (auto-generated)"

# 4. REDIS SECRETS (Upstash)
echo ""
echo -e "${YELLOW}4. REDIS CACHE SECRETS (Upstash)${NC}"
echo "Get these from: https://console.upstash.com"
echo ""

read -p "Enter Upstash Redis REST URL: " UPSTASH_REDIS_REST_URL
set_secret "UPSTASH_REDIS_REST_URL" "$UPSTASH_REDIS_REST_URL" "Upstash Redis endpoint"

read -p "Enter Upstash Redis REST Token: " UPSTASH_REDIS_REST_TOKEN
set_secret "UPSTASH_REDIS_REST_TOKEN" "$UPSTASH_REDIS_REST_TOKEN" "Upstash Redis auth token"

# 5. OPTIONAL SECRETS
echo ""
echo -e "${YELLOW}5. OPTIONAL SECRETS${NC}"
echo ""

read -p "Do you want to set up Sentry error tracking? (y/n): " setup_sentry
if [[ $setup_sentry == "y" ]]; then
    echo "Get from: https://sentry.io → Settings → Projects → Your Project → Client Keys"
    read -p "Enter Sentry DSN: " SENTRY_DSN
    set_secret "SENTRY_DSN" "$SENTRY_DSN" "Sentry error tracking DSN"
    
    read -p "Enter Sentry Auth Token: " SENTRY_AUTH_TOKEN
    set_secret "SENTRY_AUTH_TOKEN" "$SENTRY_AUTH_TOKEN" "Sentry CLI auth token"
    
    read -p "Enter Sentry Organization slug: " SENTRY_ORG
    set_secret "SENTRY_ORG" "$SENTRY_ORG" "Sentry organization"
    
    read -p "Enter Sentry Project slug: " SENTRY_PROJECT
    set_secret "SENTRY_PROJECT" "$SENTRY_PROJECT" "Sentry project"
fi

read -p "Do you want to set up Slack notifications? (y/n): " setup_slack
if [[ $setup_slack == "y" ]]; then
    echo "Get from: Slack → Apps → Incoming Webhooks"
    read -p "Enter Slack Webhook URL: " SLACK_WEBHOOK
    set_secret "SLACK_WEBHOOK" "$SLACK_WEBHOOK" "Slack webhook for notifications"
fi

# 6. Create staging branch in Neon (optional)
echo ""
read -p "Do you want to create a staging branch in Neon? (y/n): " create_staging
if [[ $create_staging == "y" ]]; then
    echo "Creating staging branch in Neon..."
    # This would use Neon CLI or API to create staging branch
    echo -e "${YELLOW}Please create a 'staging' branch in Neon Console manually${NC}"
    echo "Then enter the connection string:"
    read -p "Enter Staging Database URL: " NEON_STAGING_URL
    set_secret "NEON_STAGING_URL" "$NEON_STAGING_URL" "Staging database connection string"
fi

# Summary
echo ""
echo -e "${GREEN}✅ GitHub Secrets Setup Complete!${NC}"
echo ""
echo "📊 Summary:"
echo "==========="
gh secret list

echo ""
echo "🎉 Next Steps:"
echo "=============="
echo "1. Connect Neon to GitHub:"
echo "   - Go to Neon Console → Integrations → GitHub"
echo "   - Click 'Connect GitHub'"
echo "   - Select repository: $REPO"
echo ""
echo "2. Configure Neon Integration:"
echo "   - ✅ Create branch for each PR"
echo "   - ✅ Delete branch when PR closes"
echo "   - ✅ Include data up to this moment"
echo ""
echo "3. Test the setup:"
echo "   - Create a test PR"
echo "   - Check that Neon branch is created"
echo "   - Verify preview deployment works"
echo ""
echo "4. Optional: Set branch protection rules:"
echo "   gh repo edit --enable-auto-merge --enable-branch-protection"
echo ""
echo -e "${BLUE}Documentation:${NC}"
echo "- Neon + GitHub: https://neon.tech/docs/guides/github-integration"
echo "- GitHub Actions: https://docs.github.com/actions"
echo "- Cloudflare Workers: https://developers.cloudflare.com/workers"
echo ""
echo -e "${GREEN}🚀 Your CI/CD pipeline is ready!${NC}"