#!/bin/bash

# Deployment script for Pitchey optimizations
# Deploys caching, WebSocket hibernation, and database fixes

echo "🚀 Deploying Pitchey Optimizations to Production"
echo "================================================"

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Install with: npm install -g wrangler"
    exit 1
fi

echo "✅ Prerequisites checked"
echo ""

# Show current deployment status
echo "📊 Current Deployment Status:"
echo "-----------------------------"
CURRENT_STATUS=$(curl -s -w "HTTP %{http_code}" https://pitchey-production.cavelltheleaddev.workers.dev/api/health || echo "FAILED")
echo "Production health endpoint: $CURRENT_STATUS"
echo ""

# Deploy optimizations
echo "🚀 Deploying Optimizations:"
echo "============================"

echo "Step 1: Deploying updated Worker with optimizations..."
echo "-------------------------------------------------------"

# Deploy with default environment
echo "Executing: wrangler deploy"
wrangler deploy

DEPLOY_EXIT=$?
if [ $DEPLOY_EXIT -eq 0 ]; then
    echo "✅ Worker deployment: SUCCESS"
else
    echo "❌ Worker deployment: FAILED"
    exit 1
fi

echo ""

# Post-deployment testing
echo "🧪 Post-Deployment Testing:"
echo "============================"

echo "Waiting 30 seconds for deployment to propagate..."
sleep 30

echo "Testing optimized endpoints..."
echo ""

# Test health endpoint
echo -n "1. Health endpoint: "
HEALTH_RESPONSE=$(curl -s -w "HTTP %{http_code}" https://pitchey-production.cavelltheleaddev.workers.dev/api/health || echo "FAILED")
echo "$HEALTH_RESPONSE"

if echo "$HEALTH_RESPONSE" | grep -q "HTTP 200"; then
    echo "   ✅ Health endpoint working"
else
    echo "   ❌ Health endpoint failed"
fi

echo ""
echo "🎉 Deployment completed!"
echo ""
echo "📋 Next Steps:"
echo "=============="
echo "1. Run ./test-optimization-implementation.sh to validate optimizations"
echo "2. Execute set-neon-limits.sql to set database cost controls" 
echo "3. Monitor performance with ./monitor-performance.sh"