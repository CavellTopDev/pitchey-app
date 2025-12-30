#!/bin/bash

# Cloudflare Worker Deployment Script
# This bypasses GitHub Actions billing issues

echo "🚀 Starting Cloudflare Worker Deployment..."
echo "=================================="

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler not found. Installing..."
    npm install -g wrangler
fi

# Set environment variables
export CLOUDFLARE_API_TOKEN="YOUR_API_TOKEN_HERE"
export CLOUDFLARE_ACCOUNT_ID="e16d3bf549153de23459a6c6a06a431b"

echo "📦 Deploying Worker to Production..."

# Deploy with environment variables
wrangler deploy \
  --env production \
  --var JWT_SECRET:"vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz" \
  --var DATABASE_URL:"postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require" \
  --var FRONTEND_URL:"https://pitchey-5o8.pages.dev" \
  --var CACHE_ENABLED:"true" \
  --var UPSTASH_REDIS_REST_URL:"https://chief-anteater-20186.upstash.io" \
  --var UPSTASH_REDIS_REST_TOKEN:"AU7aAAIncDI3ZGVjNWMxZGUyOWQ0ZmYyYjI4NzdkYjM4OGMxZTE3NnAyMjAxODY"

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo "🌐 Worker URL: https://pitchey-api-prod.ndlovucavelle.workers.dev"
    echo "📊 View in Cloudflare Dashboard: https://dash.cloudflare.com"
else
    echo "❌ Deployment failed. Check the error messages above."
    exit 1
fi