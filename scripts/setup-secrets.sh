#!/bin/bash

# Setup Cloudflare Worker Secrets Script
# This script helps configure all required secrets for the Pitchey platform

set -e

echo "🔐 Setting up Cloudflare Worker Secrets"
echo "======================================="
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

# Function to set a secret
set_secret() {
    local SECRET_NAME=$1
    local SECRET_DESC=$2
    local IS_OPTIONAL=$3
    
    echo ""
    echo "📝 $SECRET_DESC"
    
    if [ "$IS_OPTIONAL" = "true" ]; then
        read -p "Set $SECRET_NAME? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "⏭️  Skipping $SECRET_NAME"
            return
        fi
    fi
    
    echo "Enter value for $SECRET_NAME:"
    read -s SECRET_VALUE
    echo ""
    
    if [ -z "$SECRET_VALUE" ]; then
        echo "⚠️  No value provided for $SECRET_NAME, skipping..."
        return
    fi
    
    echo "$SECRET_VALUE" | wrangler secret put $SECRET_NAME
    echo "✅ $SECRET_NAME configured"
}

# Function to set secret from environment variable
set_secret_from_env() {
    local SECRET_NAME=$1
    local ENV_VAR=$2
    local SECRET_DESC=$3
    
    if [ -z "${!ENV_VAR}" ]; then
        echo "⚠️  $ENV_VAR not found in environment, skipping $SECRET_NAME"
        return
    fi
    
    echo "📝 Setting $SECRET_NAME from $ENV_VAR"
    echo "${!ENV_VAR}" | wrangler secret put $SECRET_NAME
    echo "✅ $SECRET_NAME configured from environment"
}

# Check for .env file
if [ -f .env ]; then
    echo "📄 Loading .env file..."
    export $(cat .env | grep -v '^#' | xargs)
fi

echo ""
echo "🔧 Configuring Required Secrets"
echo "--------------------------------"

# Required secrets
set_secret "DATABASE_URL" "PostgreSQL connection string (e.g., postgresql://user:pass@host/db)" false
set_secret "JWT_SECRET" "JWT signing secret (min 32 characters)" false
set_secret "BETTER_AUTH_SECRET" "Better Auth secret key" false
set_secret "BETTER_AUTH_URL" "Better Auth URL (e.g., https://pitchey-production.cavelltheleaddev.workers.dev)" false

echo ""
echo "🔧 Configuring Cache & Storage"
echo "-------------------------------"

set_secret "UPSTASH_REDIS_REST_URL" "Upstash Redis REST URL" false
set_secret "UPSTASH_REDIS_REST_TOKEN" "Upstash Redis REST Token" false

echo ""
echo "🔧 Configuring Optional Services"
echo "---------------------------------"

set_secret "SENTRY_DSN" "Sentry DSN for error tracking" true
set_secret "STRIPE_SECRET_KEY" "Stripe secret key for payments" true
set_secret "SENDGRID_API_KEY" "SendGrid API key for emails" true
set_secret "ADMIN_TOKEN" "Admin API authentication token" true

echo ""
echo "🔧 GitHub Actions Secrets (if using CI/CD)"
echo "-------------------------------------------"
echo ""
echo "Add these secrets to your GitHub repository:"
echo "  - CLOUDFLARE_API_TOKEN"
echo "  - CLOUDFLARE_ACCOUNT_ID"
echo "  - PRODUCTION_URL"
echo "  - VITE_API_URL"
echo "  - VITE_WS_URL"
echo "  - VITE_SENTRY_DSN"
echo "  - SLACK_WEBHOOK (for notifications)"
echo "  - DATADOG_API_KEY (for monitoring)"
echo ""

echo ""
echo "📋 Summary"
echo "----------"
echo ""
wrangler secret list

echo ""
echo "✅ Secret configuration complete!"
echo ""
echo "🚀 Next steps:"
echo "  1. Deploy the worker: wrangler deploy"
echo "  2. Test the deployment: curl https://pitchey-production.cavelltheleaddev.workers.dev/health"
echo "  3. Set up GitHub Actions secrets for CI/CD"
echo ""