#!/bin/bash

# Setup script for new Cloudflare account
# Run this after creating your new Cloudflare account

echo "=== Cloudflare New Account Setup for Pitchey API ==="
echo ""
echo "Prerequisites:"
echo "1. Create a new Cloudflare account at https://dash.cloudflare.com/sign-up"
echo "2. Get your Account ID from the dashboard (right sidebar)"
echo "3. Generate an API token with 'Edit Workers' permissions"
echo ""
read -p "Enter your new Cloudflare Account ID: " ACCOUNT_ID
read -p "Enter your new API Token: " CF_API_TOKEN

# Update wrangler config with account ID
sed -i "s/# account_id will be added/account_id = \"$ACCOUNT_ID\"/" wrangler-new-account.toml

# Set environment variables
export CLOUDFLARE_API_TOKEN=$CF_API_TOKEN
export CLOUDFLARE_ACCOUNT_ID=$ACCOUNT_ID

echo ""
echo "Creating KV namespaces..."

# Create KV namespaces
KV_ID=$(wrangler kv:namespace create "KV" --config wrangler-new-account.toml 2>&1 | grep -oP 'id = "\K[^"]+')
CACHE_ID=$(wrangler kv:namespace create "CACHE" --config wrangler-new-account.toml 2>&1 | grep -oP 'id = "\K[^"]+')

# Update wrangler config with KV IDs
sed -i "s/id = \"TO_BE_CREATED\"/id = \"$KV_ID\"/" wrangler-new-account.toml
sed -i "0,/id = \"$KV_ID\"/! s/id = \"TO_BE_CREATED\"/id = \"$CACHE_ID\"/" wrangler-new-account.toml

echo ""
echo "Creating R2 bucket..."
wrangler r2 bucket create pitchey-uploads --config wrangler-new-account.toml

echo ""
echo "Setting up secrets..."
echo "You'll need to set these secrets manually:"
echo ""
echo "wrangler secret put DATABASE_URL --config wrangler-new-account.toml"
echo "  Value: Your Neon PostgreSQL connection string"
echo ""
echo "wrangler secret put JWT_SECRET --config wrangler-new-account.toml"
echo "  Value: A random secret key for JWT signing"
echo ""
echo "Optional secrets for Redis caching:"
echo "wrangler secret put UPSTASH_REDIS_REST_URL --config wrangler-new-account.toml"
echo "wrangler secret put UPSTASH_REDIS_REST_TOKEN --config wrangler-new-account.toml"
echo ""

echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Set the required secrets using the commands above"
echo "2. Update package.json to use the new config:"
echo "   \"build:worker\": \"esbuild src/worker-clean.ts --bundle --format=esm --outfile=dist/worker.js --platform=browser --target=es2020\""
echo "3. Deploy with: wrangler deploy --config wrangler-new-account.toml"
echo ""
echo "Your new worker will be available at:"
echo "https://pitchey-api.$ACCOUNT_ID.workers.dev"