#!/bin/bash

# Pitchey Quick Deploy Script
# This script handles the manual deployment with error checking

echo "🚀 Pitchey Cloudflare Deployment Script"
echo "========================================"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "📦 Installing wrangler..."
    npm install -g wrangler
fi

# Check for API token
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "⚠️  No Cloudflare API token found!"
    echo ""
    echo "Please set your API token:"
    echo "  export CLOUDFLARE_API_TOKEN='your-token-here'"
    echo ""
    echo "Get your token at: https://dash.cloudflare.com/profile/api-tokens"
    echo ""
    echo "Need permissions for:"
    echo "  - Account: Cloudflare Workers Scripts:Edit"
    echo "  - Zone: Workers Routes:Edit"
    exit 1
fi

# Set account ID
export CLOUDFLARE_ACCOUNT_ID="e16d3bf549153de23459a6c6a06a431b"

echo "✅ Configuration verified"
echo "  Account ID: $CLOUDFLARE_ACCOUNT_ID"
echo "  API Token: [REDACTED]"
echo ""

# Check if worker file exists
if [ ! -f "src/worker-service-optimized.ts" ]; then
    echo "❌ Worker file not found: src/worker-service-optimized.ts"
    echo "   Please run this script from the project root directory"
    exit 1
fi

echo "📦 Deploying to Cloudflare Workers..."
echo ""

# Deploy with all required variables
wrangler deploy \
  --env production \
  --compatibility-date 2024-11-24 \
  --var JWT_SECRET:"vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz" \
  --var DATABASE_URL:"postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require" \
  --var FRONTEND_URL:"https://pitchey.pages.dev" \
  --var CACHE_ENABLED:"true" \
  --var UPSTASH_REDIS_REST_URL:"https://chief-anteater-20186.upstash.io" \
  --var UPSTASH_REDIS_REST_TOKEN:"AU7aAAIncDI3ZGVjNWMxZGUyOWQ0ZmYyYjI4NzdkYjM4OGMxZTE3NnAyMjAxODY"

# Check deployment result
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "🌐 Testing health endpoint..."
    sleep 3
    
    # Test the health endpoint
    HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" https://pitchey-optimized.cavelltheleaddev.workers.dev/api/health)
    
    if [ "$HEALTH_CHECK" = "200" ]; then
        echo "✅ Health check passed!"
        echo ""
        echo "🎉 DEPLOYMENT COMPLETE!"
        echo ""
        echo "📍 Your API is live at:"
        echo "   https://pitchey-optimized.cavelltheleaddev.workers.dev"
        echo ""
        echo "📊 View in Cloudflare Dashboard:"
        echo "   https://dash.cloudflare.com"
        echo ""
        echo "📝 Test endpoints:"
        echo "   - Health: https://pitchey-optimized.cavelltheleaddev.workers.dev/api/health"
        echo "   - Pitches: https://pitchey-optimized.cavelltheleaddev.workers.dev/api/pitches/browse"
        echo ""
    else
        echo "⚠️  Health check returned status: $HEALTH_CHECK"
        echo "   The worker is deployed but may need a moment to propagate"
        echo "   Try again in a few seconds"
    fi
else
    echo ""
    echo "❌ Deployment failed!"
    echo ""
    echo "Common issues:"
    echo "1. Invalid API token - Create a new one at https://dash.cloudflare.com/profile/api-tokens"
    echo "2. Wrong directory - Run from project root (/home/supremeisbeing/pitcheymovie/pitchey_v0.2)"
    echo "3. Network issues - Check your internet connection"
    echo ""
    echo "For detailed logs, run:"
    echo "  wrangler deploy --env production --log-level debug"
    exit 1
fi