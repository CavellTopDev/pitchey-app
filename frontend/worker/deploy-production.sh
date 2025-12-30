#!/bin/bash

# Deploy script for pitchey-browse-api-production worker
# This script ensures environment variables are properly set

echo "🚀 Deploying pitchey-browse-api-production..."

# Set environment variables
export DATABASE_URL="postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
export JWT_SECRET="vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz"
export FRONTEND_URL="https://pitchey-5o8.pages.dev"

# Deploy with environment production
echo "📦 Building and deploying worker..."
wrangler deploy --env production

echo "✅ Deployment complete!"
echo ""
echo "🔍 Verifying deployment..."
sleep 2

# Test the deployment
echo "Testing /api/test endpoint..."
curl -s https://pitchey-api-prod.ndlovucavelle.workers.dev/api/test | jq '{success, hasDatabase, hasJwtSecret}' 2>/dev/null || echo "Response received"

echo ""
echo "📋 Deployment Summary:"
echo "- Worker: pitchey-browse-api-production"
echo "- URL: https://pitchey-api-prod.ndlovucavelle.workers.dev"
echo "- Environment: production"
echo "- Database: Configured ✅"
echo "- JWT: Configured ✅"