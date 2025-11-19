#!/bin/bash

# Automated deployment script that waits for authentication
# Run this after completing `wrangler login`

echo "🔄 WAITING FOR AUTHENTICATION AND DEPLOYING"
echo "============================================"

# Check if already authenticated
if wrangler whoami &> /dev/null; then
    echo "✅ Already authenticated!"
else
    echo "⏳ Waiting for you to complete: wrangler login"
    echo "Please complete authentication in another terminal, then this will deploy automatically..."
    echo ""
    
    # Wait for authentication (check every 10 seconds)
    while ! wrangler whoami &> /dev/null; do
        echo -n "⏳ Checking authentication... "
        sleep 5
        if wrangler whoami &> /dev/null; then
            echo "✅ Authenticated!"
            break
        else
            echo "❌ Not yet authenticated"
        fi
    done
fi

# Show who is authenticated
echo "🔐 Authenticated as:"
wrangler whoami

echo ""
echo "🚀 DEPLOYING PHASE 1 OPTIMIZATIONS"
echo "=================================="

# Deploy the optimizations
echo "Deploying optimized Worker to production..."
if wrangler deploy --env production; then
    echo ""
    echo "✅ DEPLOYMENT SUCCESSFUL!"
    echo ""
    
    # Wait for deployment to propagate
    echo "⏳ Waiting 30 seconds for deployment to propagate..."
    sleep 30
    
    # Verify deployment
    echo "🧪 VERIFYING DEPLOYMENT..."
    echo "=========================="
    
    if [ -f "./verify-phase1-deployment.sh" ]; then
        ./verify-phase1-deployment.sh
    else
        # Simple verification
        echo "Testing health endpoint..."
        HEALTH_STATUS=$(curl -s -w "HTTP %{http_code}" https://pitchey-production.cavelltheleaddev.workers.dev/api/health || echo "FAILED")
        echo "Health endpoint: $HEALTH_STATUS"
        
        if echo "$HEALTH_STATUS" | grep -q "HTTP 200"; then
            echo "🎉 SUCCESS: Production issues resolved!"
        else
            echo "⚠️  May need additional verification"
        fi
    fi
    
    echo ""
    echo "🎯 NEXT STEPS:"
    echo "=============="
    echo "1. Monitor performance: ./monitor-performance.sh"
    echo "2. Set database cost limits: psql -f set-neon-limits.sql"
    echo "3. Ready for Phase 2: ./service-bindings-implementation/deploy-service-bindings.sh"
    
else
    echo ""
    echo "❌ DEPLOYMENT FAILED"
    echo "==================="
    echo ""
    echo "🔍 Troubleshooting:"
    echo "1. Check deployment logs: wrangler tail"
    echo "2. Verify wrangler.toml configuration"
    echo "3. Test locally first: wrangler dev"
    echo "4. Check Cloudflare dashboard for binding issues"
    
    exit 1
fi