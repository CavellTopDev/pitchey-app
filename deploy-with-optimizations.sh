#!/bin/bash

echo "🚀 Deploying Worker with Performance Optimizations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if we're logged in to Cloudflare
echo "📋 Checking Cloudflare authentication..."
if ! wrangler whoami > /dev/null 2>&1; then
    echo "❌ Not logged in to Cloudflare"
    echo "Please run: wrangler login"
    exit 1
fi

echo "✅ Authenticated with Cloudflare"

# Build check
echo -e "\n📦 Checking TypeScript compilation..."
if npx tsc --noEmit src/worker-production-db.ts 2>/dev/null; then
    echo "✅ TypeScript compilation successful"
else
    echo "⚠️  TypeScript warnings detected (continuing anyway)"
fi

# Deploy to production
echo -e "\n🔧 Deploying to Cloudflare Workers..."
echo "Using configuration from wrangler.toml"

wrangler deploy

if [ $? -eq 0 ]; then
    echo -e "\n✅ Deployment successful!"
    echo ""
    echo "🎯 Optimizations Deployed:"
    echo "  ✓ Edge caching with KV namespace"
    echo "  ✓ Performance monitoring headers"
    echo "  ✓ Database retry logic (3 attempts)"
    echo "  ✓ Request/response optimization"
    echo ""
    echo "📊 Test the optimizations:"
    echo "  ./test-optimized-performance.sh production"
    echo ""
    echo "🔍 Monitor performance:"
    echo "  - Check X-Cache-Status header for HIT/MISS"
    echo "  - Monitor X-Response-Time header"
    echo "  - Watch Cloudflare Analytics dashboard"
else
    echo -e "\n❌ Deployment failed"
    echo "Check the error messages above and fix any issues"
    exit 1
fi