#!/bin/bash

echo "========================================="
echo "  Cloudflare Worker Secrets Setup"
echo "========================================="
echo ""
echo "This script will help you configure secrets for the Pitchey Worker."
echo "You'll need to provide the actual values from your secure storage."
echo ""

# Function to set a secret
set_secret() {
    local secret_name=$1
    local description=$2
    
    echo ""
    echo "Setting $secret_name..."
    echo "Description: $description"
    echo "Enter the value (will be hidden):"
    read -s secret_value
    
    if [ -z "$secret_value" ]; then
        echo "⚠️  Skipped (no value provided)"
    else
        echo "$secret_value" | wrangler secret put "$secret_name"
        echo "✅ $secret_name configured"
    fi
}

# Database URL (from GitHub Secrets or Neon Dashboard)
set_secret "DATABASE_URL" "PostgreSQL connection string from Neon (get from GitHub Secrets)"

# Better Auth Secret (generate with: openssl rand -base64 32)
set_secret "BETTER_AUTH_SECRET" "Secret key for Better Auth sessions (generate new or use existing)"

# Better Auth URL
echo ""
echo "Setting BETTER_AUTH_URL..."
echo "Using production URL: https://pitchey-production.cavelltheleaddev.workers.dev"
echo "https://pitchey-production.cavelltheleaddev.workers.dev" | wrangler secret put BETTER_AUTH_URL
echo "✅ BETTER_AUTH_URL configured"

# JWT Secret (for backward compatibility)
set_secret "JWT_SECRET" "JWT secret for backward compatibility (optional)"

# Redis Configuration (optional)
echo ""
echo "Would you like to configure Redis caching? (y/n)"
read -r configure_redis

if [ "$configure_redis" = "y" ]; then
    set_secret "UPSTASH_REDIS_REST_URL" "Upstash Redis REST URL"
    set_secret "UPSTASH_REDIS_REST_TOKEN" "Upstash Redis REST Token"
fi

# Sentry Configuration (optional)
echo ""
echo "Would you like to configure Sentry monitoring? (y/n)"
read -r configure_sentry

if [ "$configure_sentry" = "y" ]; then
    set_secret "SENTRY_DSN" "Sentry DSN for error tracking"
fi

echo ""
echo "========================================="
echo "  Configuration Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Test the connection:"
echo "   curl https://pitchey-production.cavelltheleaddev.workers.dev/api/health"
echo ""
echo "2. If using debug worker:"
echo "   Run this script with: -c wrangler-debug.toml"
echo ""
echo "3. Test authentication:"
echo "   ./test-better-auth-deployment.sh"