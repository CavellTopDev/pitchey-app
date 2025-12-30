#!/bin/bash

# Environment Variables Validation Script
# Checks if all required secrets and environment variables are properly configured

set -e

echo "🔍 Pitchey Platform - Environment Validation"
echo "============================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TOTAL=0
CONFIGURED=0
MISSING=0
WARNINGS=0

# Arrays to store results
MISSING_REQUIRED=()
MISSING_RECOMMENDED=()
CONFIGURED_SECRETS=()

# Function to check if a secret exists
check_secret() {
    local SECRET_NAME=$1
    local REQUIRED=$2
    local DESCRIPTION=$3
    
    TOTAL=$((TOTAL + 1))
    
    if gh secret list --json name -q '.[].name' | grep -q "^${SECRET_NAME}$"; then
        CONFIGURED=$((CONFIGURED + 1))
        CONFIGURED_SECRETS+=("$SECRET_NAME")
        echo -e "${GREEN}✓${NC} $SECRET_NAME - $DESCRIPTION"
    else
        if [ "$REQUIRED" = "true" ]; then
            MISSING=$((MISSING + 1))
            MISSING_REQUIRED+=("$SECRET_NAME - $DESCRIPTION")
            echo -e "${RED}✗${NC} $SECRET_NAME - $DESCRIPTION ${RED}(REQUIRED)${NC}"
        else
            WARNINGS=$((WARNINGS + 1))
            MISSING_RECOMMENDED+=("$SECRET_NAME - $DESCRIPTION")
            echo -e "${YELLOW}⚠${NC} $SECRET_NAME - $DESCRIPTION ${YELLOW}(Recommended)${NC}"
        fi
    fi
}

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) not installed${NC}"
    echo "Please install: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}❌ Not authenticated with GitHub${NC}"
    echo "Run: gh auth login"
    exit 1
fi

echo -e "${GREEN}✅ GitHub CLI authenticated${NC}"
echo ""

# Get repository info
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null || echo "")
if [ -z "$REPO" ]; then
    echo -e "${YELLOW}⚠️  Could not detect repository${NC}"
    echo "Make sure you're in a git repository"
    echo ""
fi

echo "Repository: ${REPO:-'Not detected'}"
echo "Checking secrets configuration..."
echo ""

# ============================================
# REQUIRED SECRETS
# ============================================
echo -e "${BLUE}═══ REQUIRED SECRETS ═══${NC}"
echo ""

echo "Cloudflare Configuration:"
check_secret "CLOUDFLARE_API_TOKEN" "true" "API token for deployment"
check_secret "CLOUDFLARE_ACCOUNT_ID" "true" "Account identifier"
echo ""

echo "Database Configuration:"
check_secret "PRODUCTION_DATABASE_URL" "true" "Production database connection"
check_secret "STAGING_DATABASE_URL" "true" "Staging database connection"
echo ""

echo "Authentication:"
check_secret "PRODUCTION_JWT_SECRET" "true" "Production JWT signing key"
check_secret "STAGING_JWT_SECRET" "true" "Staging JWT signing key"
check_secret "MFA_SECRET" "true" "Multi-factor authentication secret"
check_secret "ENCRYPTION_KEY" "true" "Data encryption key"
echo ""

# ============================================
# RECOMMENDED SECRETS
# ============================================
echo -e "${BLUE}═══ RECOMMENDED SECRETS ═══${NC}"
echo ""

echo "Monitoring & Observability:"
check_secret "SENTRY_DSN" "false" "Error tracking"
check_secret "SENTRY_AUTH_TOKEN" "false" "Source maps upload"
check_secret "SLACK_WEBHOOK_URL" "false" "Deployment notifications"
echo ""

echo "Email Service:"
check_secret "SENDGRID_API_KEY" "false" "SendGrid email service"
check_secret "RESEND_API_KEY" "false" "Resend email service"
check_secret "FROM_EMAIL" "false" "Default sender email"
echo ""

echo "Caching:"
check_secret "UPSTASH_REDIS_REST_URL" "false" "Redis cache endpoint"
check_secret "UPSTASH_REDIS_REST_TOKEN" "false" "Redis auth token"
echo ""

# ============================================
# OPTIONAL SECRETS
# ============================================
echo -e "${BLUE}═══ OPTIONAL SECRETS ═══${NC}"
echo ""

echo "OAuth Providers:"
check_secret "GOOGLE_CLIENT_ID" "false" "Google OAuth"
check_secret "GOOGLE_CLIENT_SECRET" "false" "Google OAuth secret"
check_secret "GITHUB_CLIENT_ID" "false" "GitHub OAuth"
check_secret "GITHUB_CLIENT_SECRET" "false" "GitHub OAuth secret"
echo ""

echo "Payment Processing:"
check_secret "STRIPE_PUBLISHABLE_KEY" "false" "Stripe public key"
check_secret "STRIPE_SECRET_KEY" "false" "Stripe secret key"
check_secret "STRIPE_WEBHOOK_SECRET" "false" "Stripe webhook verification"
echo ""

echo "Analytics:"
check_secret "GA_MEASUREMENT_ID" "false" "Google Analytics"
check_secret "MIXPANEL_TOKEN" "false" "Mixpanel analytics"
echo ""

# ============================================
# ENVIRONMENT VALIDATION
# ============================================
echo -e "${BLUE}═══ ENVIRONMENT CHECKS ═══${NC}"
echo ""

# Check for wrangler.toml
if [ -f "wrangler.toml" ]; then
    echo -e "${GREEN}✓${NC} wrangler.toml found"
    
    # Check for required bindings
    if grep -q "kv_namespaces" wrangler.toml; then
        echo -e "${GREEN}✓${NC} KV namespace configured"
    else
        echo -e "${YELLOW}⚠${NC} KV namespace not configured"
    fi
    
    if grep -q "r2_buckets" wrangler.toml; then
        echo -e "${GREEN}✓${NC} R2 bucket configured"
    else
        echo -e "${YELLOW}⚠${NC} R2 bucket not configured"
    fi
else
    echo -e "${RED}✗${NC} wrangler.toml not found"
fi

# Check for GitHub Actions workflows
if [ -d ".github/workflows" ]; then
    WORKFLOW_COUNT=$(ls -1 .github/workflows/*.yml 2>/dev/null | wc -l)
    echo -e "${GREEN}✓${NC} GitHub Actions workflows found ($WORKFLOW_COUNT files)"
else
    echo -e "${RED}✗${NC} No GitHub Actions workflows found"
fi

# Check for environment files
if [ -f ".env.production" ]; then
    echo -e "${GREEN}✓${NC} Production environment file found"
else
    echo -e "${YELLOW}⚠${NC} .env.production not found"
fi

echo ""

# ============================================
# SUMMARY
# ============================================
echo -e "${BLUE}═══ VALIDATION SUMMARY ═══${NC}"
echo ""

echo "Total Secrets Checked: $TOTAL"
echo -e "Configured: ${GREEN}$CONFIGURED${NC}"
echo -e "Missing Required: ${RED}$MISSING${NC}"
echo -e "Missing Optional: ${YELLOW}$WARNINGS${NC}"
echo ""

# Show missing required secrets
if [ ${#MISSING_REQUIRED[@]} -gt 0 ]; then
    echo -e "${RED}❌ MISSING REQUIRED SECRETS:${NC}"
    for secret in "${MISSING_REQUIRED[@]}"; do
        echo "  - $secret"
    done
    echo ""
fi

# Show missing recommended secrets
if [ ${#MISSING_RECOMMENDED[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Missing Recommended Secrets:${NC}"
    for secret in "${MISSING_RECOMMENDED[@]}"; do
        echo "  - $secret"
    done
    echo ""
fi

# Overall status
echo -e "${BLUE}═══ STATUS ═══${NC}"
echo ""

if [ $MISSING -eq 0 ]; then
    echo -e "${GREEN}✅ All required secrets are configured!${NC}"
    echo "Your environment is ready for deployment."
    
    if [ $WARNINGS -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}Note: Some recommended secrets are missing.${NC}"
        echo "These are optional but enhance functionality."
    fi
    
    EXIT_CODE=0
else
    echo -e "${RED}❌ Required secrets are missing!${NC}"
    echo ""
    echo "To configure missing secrets, run:"
    echo "  ./setup-github-secrets.sh"
    echo ""
    echo "Or set them manually:"
    for secret in "${MISSING_REQUIRED[@]}"; do
        SECRET_NAME=$(echo "$secret" | cut -d' ' -f1)
        echo "  gh secret set $SECRET_NAME"
    done
    
    EXIT_CODE=1
fi

echo ""
echo "For complete reference, see: ENVIRONMENT_VARIABLES_REFERENCE.md"
echo ""

# Test connectivity if all required secrets are present
if [ $MISSING -eq 0 ]; then
    echo -e "${BLUE}═══ CONNECTIVITY TESTS ═══${NC}"
    echo ""
    
    # Test Cloudflare API
    echo -n "Testing Cloudflare API... "
    if gh secret list | grep -q "CLOUDFLARE_API_TOKEN"; then
        echo -e "${GREEN}Token configured${NC}"
    fi
    
    # Test if we can reach the API endpoint
    echo -n "Testing API endpoint... "
    if curl -s -o /dev/null -w "%{http_code}" https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health | grep -q "200\|404"; then
        echo -e "${GREEN}Reachable${NC}"
    else
        echo -e "${YELLOW}Not deployed yet${NC}"
    fi
    
    echo ""
fi

exit $EXIT_CODE