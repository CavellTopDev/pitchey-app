#!/bin/bash

# GitHub Secrets Setup Script for Pitchey Platform
# This script helps you configure all required secrets for production deployment

set -e

echo "🔐 Pitchey Platform - GitHub Secrets Configuration"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) is not installed!${NC}"
    echo "Please install it first: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}🔑 Please authenticate with GitHub:${NC}"
    gh auth login
fi

echo -e "${GREEN}✅ GitHub CLI authenticated${NC}"
echo ""

# Function to set a secret
set_secret() {
    local SECRET_NAME=$1
    local SECRET_VALUE=$2
    local DESCRIPTION=$3
    
    echo -e "${YELLOW}Setting ${SECRET_NAME}...${NC}"
    echo "Description: ${DESCRIPTION}"
    
    if [ -z "$SECRET_VALUE" ]; then
        echo "Please enter value for ${SECRET_NAME}:"
        read -s SECRET_VALUE
    fi
    
    echo "$SECRET_VALUE" | gh secret set "$SECRET_NAME"
    echo -e "${GREEN}✅ ${SECRET_NAME} configured${NC}"
    echo ""
}

# Function to generate a random secret
generate_secret() {
    openssl rand -base64 32
}

echo "📋 Starting secrets configuration..."
echo "===================================="
echo ""

# ============================================
# CLOUDFLARE SECRETS
# ============================================
echo -e "${YELLOW}1. CLOUDFLARE CONFIGURATION${NC}"
echo "----------------------------"
echo "Get these from: https://dash.cloudflare.com/profile/api-tokens"
echo ""

# Cloudflare API Token
echo "Creating a Cloudflare API Token:"
echo "1. Go to https://dash.cloudflare.com/profile/api-tokens"
echo "2. Click 'Create Token'"
echo "3. Use template: 'Edit Cloudflare Workers'"
echo "4. Add permissions:"
echo "   - Account: Cloudflare Workers Scripts:Edit"
echo "   - Account: Cloudflare Pages:Edit"
echo "   - Zone: DNS:Edit (for your domain)"
echo ""
read -p "Enter your Cloudflare API Token: " -s CLOUDFLARE_API_TOKEN
echo ""
set_secret "CLOUDFLARE_API_TOKEN" "$CLOUDFLARE_API_TOKEN" "Cloudflare API Token for Workers/Pages deployment"

# Cloudflare Account ID
echo "Your Cloudflare Account ID: e16d3bf549153de23459a6c6a06a431b"
set_secret "CLOUDFLARE_ACCOUNT_ID" "e16d3bf549153de23459a6c6a06a431b" "Cloudflare Account ID"

# ============================================
# DATABASE SECRETS
# ============================================
echo -e "${YELLOW}2. DATABASE CONFIGURATION (Neon PostgreSQL)${NC}"
echo "--------------------------------------------"
echo "Get these from: https://console.neon.tech/"
echo ""

echo "Example format: postgresql://username:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require"
read -p "Enter your STAGING Database URL: " -s STAGING_DATABASE_URL
echo ""
set_secret "STAGING_DATABASE_URL" "$STAGING_DATABASE_URL" "Staging environment database connection string"

read -p "Enter your PRODUCTION Database URL: " -s PRODUCTION_DATABASE_URL
echo ""
set_secret "PRODUCTION_DATABASE_URL" "$PRODUCTION_DATABASE_URL" "Production environment database connection string"

# ============================================
# AUTHENTICATION SECRETS
# ============================================
echo -e "${YELLOW}3. AUTHENTICATION SECRETS${NC}"
echo "--------------------------"
echo ""

# Generate JWT Secrets
echo "Generating secure JWT secrets..."
STAGING_JWT_SECRET=$(generate_secret)
PRODUCTION_JWT_SECRET=$(generate_secret)

set_secret "STAGING_JWT_SECRET" "$STAGING_JWT_SECRET" "JWT secret for staging environment"
set_secret "PRODUCTION_JWT_SECRET" "$PRODUCTION_JWT_SECRET" "JWT secret for production environment"

# MFA Secret
echo "Generating MFA secret..."
MFA_SECRET=$(generate_secret)
set_secret "MFA_SECRET" "$MFA_SECRET" "Secret for MFA/2FA authentication"

# Encryption Key
echo "Generating encryption key..."
ENCRYPTION_KEY=$(generate_secret)
set_secret "ENCRYPTION_KEY" "$ENCRYPTION_KEY" "Key for data encryption at rest"

# ============================================
# MONITORING & OBSERVABILITY
# ============================================
echo -e "${YELLOW}4. MONITORING CONFIGURATION${NC}"
echo "----------------------------"
echo ""

# Sentry
echo "Sentry Configuration (https://sentry.io/)"
echo "1. Create a project at https://sentry.io/"
echo "2. Go to Settings > Projects > [Your Project] > Client Keys (DSN)"
echo "3. Copy the DSN"
echo ""
read -p "Enter your Sentry DSN (or press Enter to skip): " SENTRY_DSN
if [ ! -z "$SENTRY_DSN" ]; then
    set_secret "SENTRY_DSN" "$SENTRY_DSN" "Sentry error tracking DSN"
    
    echo "4. Create an auth token: Settings > Account > API > Auth Tokens"
    read -p "Enter your Sentry Auth Token: " -s SENTRY_AUTH_TOKEN
    echo ""
    set_secret "SENTRY_AUTH_TOKEN" "$SENTRY_AUTH_TOKEN" "Sentry auth token for source maps"
fi

# ============================================
# COMMUNICATION & NOTIFICATIONS
# ============================================
echo -e "${YELLOW}5. COMMUNICATION SERVICES${NC}"
echo "--------------------------"
echo ""

# Slack
echo "Slack Webhook (for notifications)"
echo "1. Go to https://api.slack.com/apps"
echo "2. Create a new app or select existing"
echo "3. Add 'Incoming Webhooks' feature"
echo "4. Create a webhook for your channel"
echo ""
read -p "Enter your Slack Webhook URL (or press Enter to skip): " SLACK_WEBHOOK_URL
if [ ! -z "$SLACK_WEBHOOK_URL" ]; then
    set_secret "SLACK_WEBHOOK_URL" "$SLACK_WEBHOOK_URL" "Slack webhook for deployment notifications"
fi

# Email Service
echo ""
echo "Email Service Configuration"
echo "Choose your provider: SendGrid, Resend, or Mailgun"
echo ""

read -p "Do you want to configure email service? (y/n): " CONFIGURE_EMAIL
if [ "$CONFIGURE_EMAIL" = "y" ]; then
    echo "Select email provider:"
    echo "1. SendGrid"
    echo "2. Resend"
    echo "3. Mailgun"
    read -p "Enter choice (1-3): " EMAIL_CHOICE
    
    case $EMAIL_CHOICE in
        1)
            echo "Get your API key from: https://app.sendgrid.com/settings/api_keys"
            read -p "Enter SendGrid API Key: " -s SENDGRID_API_KEY
            echo ""
            set_secret "SENDGRID_API_KEY" "$SENDGRID_API_KEY" "SendGrid API key for transactional emails"
            set_secret "EMAIL_PROVIDER" "sendgrid" "Email service provider"
            ;;
        2)
            echo "Get your API key from: https://resend.com/api-keys"
            read -p "Enter Resend API Key: " -s RESEND_API_KEY
            echo ""
            set_secret "RESEND_API_KEY" "$RESEND_API_KEY" "Resend API key for transactional emails"
            set_secret "EMAIL_PROVIDER" "resend" "Email service provider"
            ;;
        3)
            echo "Get your API key from: https://app.mailgun.com/app/account/security/api_keys"
            read -p "Enter Mailgun API Key: " -s MAILGUN_API_KEY
            echo ""
            set_secret "MAILGUN_API_KEY" "$MAILGUN_API_KEY" "Mailgun API key for transactional emails"
            read -p "Enter Mailgun Domain: " MAILGUN_DOMAIN
            set_secret "MAILGUN_DOMAIN" "$MAILGUN_DOMAIN" "Mailgun sending domain"
            set_secret "EMAIL_PROVIDER" "mailgun" "Email service provider"
            ;;
    esac
    
    read -p "Enter FROM email address (e.g., noreply@pitchey.com): " FROM_EMAIL
    set_secret "FROM_EMAIL" "$FROM_EMAIL" "Default sender email address"
    set_secret "FROM_NAME" "Pitchey Platform" "Default sender name"
fi

# ============================================
# STORAGE & CDN
# ============================================
echo -e "${YELLOW}6. STORAGE CONFIGURATION${NC}"
echo "-------------------------"
echo ""

# R2 Storage
echo "R2 Storage is configured via wrangler.toml bindings"
echo "No additional secrets needed for R2"
echo ""

# ============================================
# CACHE & REDIS
# ============================================
echo -e "${YELLOW}7. CACHE CONFIGURATION${NC}"
echo "-----------------------"
echo ""

echo "Redis/Upstash Configuration (optional)"
read -p "Do you want to configure Redis cache? (y/n): " CONFIGURE_REDIS
if [ "$CONFIGURE_REDIS" = "y" ]; then
    echo "Get credentials from: https://console.upstash.com/"
    read -p "Enter Upstash Redis REST URL: " UPSTASH_REDIS_REST_URL
    set_secret "UPSTASH_REDIS_REST_URL" "$UPSTASH_REDIS_REST_URL" "Upstash Redis REST endpoint"
    
    read -p "Enter Upstash Redis REST Token: " -s UPSTASH_REDIS_REST_TOKEN
    echo ""
    set_secret "UPSTASH_REDIS_REST_TOKEN" "$UPSTASH_REDIS_REST_TOKEN" "Upstash Redis auth token"
fi

# ============================================
# OAUTH PROVIDERS (Optional)
# ============================================
echo -e "${YELLOW}8. OAUTH CONFIGURATION (Optional)${NC}"
echo "----------------------------------"
echo ""

read -p "Do you want to configure OAuth providers? (y/n): " CONFIGURE_OAUTH
if [ "$CONFIGURE_OAUTH" = "y" ]; then
    # Google OAuth
    echo "Google OAuth: https://console.cloud.google.com/apis/credentials"
    read -p "Enter Google Client ID (or press Enter to skip): " GOOGLE_CLIENT_ID
    if [ ! -z "$GOOGLE_CLIENT_ID" ]; then
        set_secret "GOOGLE_CLIENT_ID" "$GOOGLE_CLIENT_ID" "Google OAuth Client ID"
        read -p "Enter Google Client Secret: " -s GOOGLE_CLIENT_SECRET
        echo ""
        set_secret "GOOGLE_CLIENT_SECRET" "$GOOGLE_CLIENT_SECRET" "Google OAuth Client Secret"
    fi
    
    # GitHub OAuth
    echo ""
    echo "GitHub OAuth: https://github.com/settings/developers"
    read -p "Enter GitHub Client ID (or press Enter to skip): " GITHUB_CLIENT_ID
    if [ ! -z "$GITHUB_CLIENT_ID" ]; then
        set_secret "GITHUB_CLIENT_ID" "$GITHUB_CLIENT_ID" "GitHub OAuth Client ID"
        read -p "Enter GitHub Client Secret: " -s GITHUB_CLIENT_SECRET
        echo ""
        set_secret "GITHUB_CLIENT_SECRET" "$GITHUB_CLIENT_SECRET" "GitHub OAuth Client Secret"
    fi
fi

# ============================================
# PAYMENT PROCESSING (Optional)
# ============================================
echo -e "${YELLOW}9. PAYMENT CONFIGURATION (Optional)${NC}"
echo "------------------------------------"
echo ""

read -p "Do you want to configure payment processing? (y/n): " CONFIGURE_PAYMENTS
if [ "$CONFIGURE_PAYMENTS" = "y" ]; then
    echo "Stripe Configuration: https://dashboard.stripe.com/apikeys"
    read -p "Enter Stripe Publishable Key: " STRIPE_PUBLISHABLE_KEY
    set_secret "STRIPE_PUBLISHABLE_KEY" "$STRIPE_PUBLISHABLE_KEY" "Stripe publishable key"
    
    read -p "Enter Stripe Secret Key: " -s STRIPE_SECRET_KEY
    echo ""
    set_secret "STRIPE_SECRET_KEY" "$STRIPE_SECRET_KEY" "Stripe secret key"
    
    read -p "Enter Stripe Webhook Secret: " -s STRIPE_WEBHOOK_SECRET
    echo ""
    set_secret "STRIPE_WEBHOOK_SECRET" "$STRIPE_WEBHOOK_SECRET" "Stripe webhook endpoint secret"
fi

# ============================================
# ANALYTICS (Optional)
# ============================================
echo -e "${YELLOW}10. ANALYTICS CONFIGURATION (Optional)${NC}"
echo "---------------------------------------"
echo ""

read -p "Do you want to configure analytics? (y/n): " CONFIGURE_ANALYTICS
if [ "$CONFIGURE_ANALYTICS" = "y" ]; then
    read -p "Enter Google Analytics ID (G-XXXXXXXXXX): " GA_MEASUREMENT_ID
    if [ ! -z "$GA_MEASUREMENT_ID" ]; then
        set_secret "GA_MEASUREMENT_ID" "$GA_MEASUREMENT_ID" "Google Analytics Measurement ID"
    fi
    
    read -p "Enter Mixpanel Token (or press Enter to skip): " MIXPANEL_TOKEN
    if [ ! -z "$MIXPANEL_TOKEN" ]; then
        set_secret "MIXPANEL_TOKEN" "$MIXPANEL_TOKEN" "Mixpanel project token"
    fi
fi

# ============================================
# ADDITIONAL CONFIGURATIONS
# ============================================
echo -e "${YELLOW}11. ADDITIONAL CONFIGURATIONS${NC}"
echo "------------------------------"
echo ""

# Admin credentials
ADMIN_EMAIL="admin@pitchey.com"
ADMIN_PASSWORD=$(generate_secret | head -c 16)
set_secret "ADMIN_EMAIL" "$ADMIN_EMAIL" "Admin user email"
set_secret "ADMIN_PASSWORD" "$ADMIN_PASSWORD" "Admin user password"

# API URLs
set_secret "STAGING_API_URL" "https://pitchey-staging.cavelltheleaddev.workers.dev" "Staging API URL"
set_secret "PRODUCTION_API_URL" "https://pitchey-production.cavelltheleaddev.workers.dev" "Production API URL"

# Frontend URLs
set_secret "STAGING_FRONTEND_URL" "https://staging.pitchey.pages.dev" "Staging frontend URL"
set_secret "PRODUCTION_FRONTEND_URL" "https://pitchey.pages.dev" "Production frontend URL"

# ============================================
# VERIFICATION
# ============================================
echo ""
echo -e "${GREEN}✅ SECRETS CONFIGURATION COMPLETE!${NC}"
echo "===================================="
echo ""

echo "Verifying secrets..."
echo "-------------------"

# List all secrets (names only)
SECRETS=$(gh secret list --json name -q '.[].name' | sort)
echo "Configured secrets:"
echo "$SECRETS" | while IFS= read -r secret; do
    echo "  ✓ $secret"
done

echo ""
echo -e "${GREEN}🎉 GitHub secrets successfully configured!${NC}"
echo ""
echo "Next steps:"
echo "1. Review the secrets at: https://github.com/YOUR_REPO/settings/secrets/actions"
echo "2. Test deployment with: git push origin main"
echo "3. Monitor deployment at: https://github.com/YOUR_REPO/actions"
echo ""
echo "Admin credentials have been generated:"
echo "  Email: $ADMIN_EMAIL"
echo "  Password: $ADMIN_PASSWORD"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Save these credentials securely!${NC}"