#!/bin/bash

# Setup Cloudflare Worker Secrets
# This script configures all necessary secrets for the optimized worker

echo "🔐 Setting up Cloudflare Worker Secrets"
echo "========================================"
echo ""

# Function to set secret
set_secret() {
    local name=$1
    local value=$2
    local description=$3
    
    echo "Setting $name: $description"
    echo "$value" | wrangler secret put "$name" --name pitchey-production
    
    if [ $? -eq 0 ]; then
        echo "✅ $name configured"
    else
        echo "❌ Failed to set $name"
    fi
    echo ""
}

# Check if secrets are provided via environment or prompt
if [ -z "$DATABASE_URL" ]; then
    echo "Please enter your Neon PostgreSQL DATABASE_URL:"
    read -r DATABASE_URL
fi

if [ -z "$JWT_SECRET" ]; then
    echo "Please enter your JWT_SECRET (or press Enter to generate):"
    read -r JWT_SECRET
    if [ -z "$JWT_SECRET" ]; then
        JWT_SECRET=$(openssl rand -base64 32)
        echo "Generated JWT_SECRET: $JWT_SECRET"
    fi
fi

if [ -z "$UPSTASH_REDIS_REST_URL" ]; then
    echo "Please enter your Upstash Redis URL (optional, press Enter to skip):"
    read -r UPSTASH_REDIS_REST_URL
fi

if [ -z "$UPSTASH_REDIS_REST_TOKEN" ]; then
    echo "Please enter your Upstash Redis Token (optional, press Enter to skip):"
    read -r UPSTASH_REDIS_REST_TOKEN
fi

echo ""
echo "Configuring secrets..."
echo "━━━━━━━━━━━━━━━━━━━━━━"

# Set required secrets
set_secret "DATABASE_URL" "$DATABASE_URL" "Neon PostgreSQL connection string"
set_secret "JWT_SECRET" "$JWT_SECRET" "JWT signing secret"

# Set optional Redis secrets if provided
if [ ! -z "$UPSTASH_REDIS_REST_URL" ]; then
    set_secret "UPSTASH_REDIS_REST_URL" "$UPSTASH_REDIS_REST_URL" "Upstash Redis URL"
fi

if [ ! -z "$UPSTASH_REDIS_REST_TOKEN" ]; then
    set_secret "UPSTASH_REDIS_REST_TOKEN" "$UPSTASH_REDIS_REST_TOKEN" "Upstash Redis Token"
fi

echo "🎉 Secret configuration complete!"
echo ""
echo "To verify secrets are set:"
echo "  wrangler secret list"
echo ""
echo "To redeploy with secrets:"
echo "  wrangler deploy"