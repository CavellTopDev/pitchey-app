#!/bin/bash

# Service Bindings Deployment Script
# Deploys the service-oriented architecture with zero-cost inter-service communication

echo "🏗️ Deploying Service Bindings Architecture"
echo "==========================================="

# Configuration
SERVICES=("router-worker" "investor-service" "creator-service" "production-service" "auth-service" "browse-service" "analytics-service")
DEPLOYED_SERVICES=()
FAILED_SERVICES=()

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Install with: npm install -g wrangler"
    exit 1
fi

if ! wrangler whoami &> /dev/null; then
    echo "❌ Not authenticated with Cloudflare. Run: wrangler login"
    exit 1
fi

echo "✅ Prerequisites checked"
echo ""

# Phase 1: Deploy service workers (dependencies first)
echo "📦 Phase 1: Deploying Service Workers"
echo "===================================="

# Deploy in dependency order (services first, then router)
SERVICE_ORDER=("auth-service" "investor-service" "creator-service" "production-service" "browse-service" "analytics-service" "router-worker")

for service in "${SERVICE_ORDER[@]}"; do
    if [ -d "service-bindings-implementation/$service" ]; then
        echo ""
        echo "🚀 Deploying $service..."
        echo "------------------------"
        
        cd "service-bindings-implementation/$service"
        
        # Check if wrangler.toml exists
        if [ ! -f "wrangler.toml" ]; then
            echo "⚠️ No wrangler.toml found for $service, skipping..."
            cd ../..
            continue
        fi
        
        # Deploy service
        if wrangler deploy --env production; then
            echo "✅ $service deployed successfully"
            DEPLOYED_SERVICES+=("$service")
        else
            echo "❌ $service deployment failed"
            FAILED_SERVICES+=("$service")
        fi
        
        cd ../..
        
        # Wait between deployments to avoid rate limiting
        if [ "$service" != "${SERVICE_ORDER[-1]}" ]; then
            echo "⏳ Waiting 10 seconds before next deployment..."
            sleep 10
        fi
    else
        echo "⚠️ Service directory not found: $service"
    fi
done

echo ""
echo "📊 Phase 1 Results:"
echo "=================="
echo "✅ Deployed (${#DEPLOYED_SERVICES[@]}): ${DEPLOYED_SERVICES[*]}"
if [ ${#FAILED_SERVICES[@]} -gt 0 ]; then
    echo "❌ Failed (${#FAILED_SERVICES[@]}): ${FAILED_SERVICES[*]}"
fi

# Phase 2: Test service connectivity
echo ""
echo "🔗 Phase 2: Testing Service Connectivity"
echo "========================================"

if [[ " ${DEPLOYED_SERVICES[*]} " =~ " router-worker " ]]; then
    echo "Testing router worker..."
    
    # Wait for deployment to propagate
    echo "⏳ Waiting 30 seconds for deployment to propagate..."
    sleep 30
    
    # Test router health
    echo -n "Router health check: "
    ROUTER_HEALTH=$(curl -s -w "HTTP %{http_code}" https://pitchey-router.cavelltheleaddev.workers.dev/api/health || echo "FAILED")
    echo "$ROUTER_HEALTH"
    
    if echo "$ROUTER_HEALTH" | grep -q "HTTP 200"; then
        echo "✅ Router is operational"
        
        # Test service routing
        echo "Testing service routing..."
        
        # Test investor service routing
        echo -n "Investor service routing: "
        INVESTOR_ROUTE=$(curl -s -w "HTTP %{http_code}" https://pitchey-router.cavelltheleaddev.workers.dev/api/investor/dashboard -H "Authorization: Bearer test-token" || echo "FAILED")
        echo "$INVESTOR_ROUTE"
        
        # Test auth service routing
        echo -n "Auth service routing: "
        AUTH_ROUTE=$(curl -s -w "HTTP %{http_code}" https://pitchey-router.cavelltheleaddev.workers.dev/api/auth/validate -H "Authorization: Bearer test-token" || echo "FAILED")
        echo "$AUTH_ROUTE"
        
    else
        echo "❌ Router health check failed"
    fi
else
    echo "⚠️ Router worker not deployed, skipping connectivity tests"
fi

# Phase 3: Performance validation
echo ""
echo "⚡ Phase 3: Performance Validation"
echo "================================="

if [[ " ${DEPLOYED_SERVICES[*]} " =~ " router-worker " ]]; then
    echo "Testing service bindings performance..."
    
    # Test response times
    echo -n "Router response time: "
    ROUTER_TIME=$(curl -w "%{time_total}" -s -o /dev/null https://pitchey-router.cavelltheleaddev.workers.dev/)
    echo "${ROUTER_TIME}s"
    
    echo -n "Service routing latency: "
    SERVICE_TIME=$(curl -w "%{time_total}" -s -o /dev/null https://pitchey-router.cavelltheleaddev.workers.dev/api/investor/dashboard -H "Authorization: Bearer test-token")
    echo "${SERVICE_TIME}s"
    
    # Performance assessment
    if (( $(echo "$ROUTER_TIME < 0.05" | bc -l 2>/dev/null || echo 0) )); then
        echo "✅ Router performance: Excellent (<50ms)"
    elif (( $(echo "$ROUTER_TIME < 0.1" | bc -l 2>/dev/null || echo 0) )); then
        echo "✅ Router performance: Good (<100ms)"
    else
        echo "⚠️ Router performance: Needs optimization (>${ROUTER_TIME}s)"
    fi
fi

# Phase 4: Migration strategy
echo ""
echo "🔄 Phase 4: Migration Strategy"
echo "============================="

echo "Service Bindings architecture deployed successfully!"
echo ""
echo "📋 Next Steps for Migration:"
echo "============================"
echo ""
echo "1. 🧪 TESTING PHASE (1-2 days):"
echo "   - Test all service endpoints thoroughly"
echo "   - Validate service bindings communication"
echo "   - Monitor performance metrics"
echo ""
echo "2. 🚦 GRADUAL ROLLOUT (3-5 days):"
echo "   - Route 10% of traffic to new architecture"
echo "   - Monitor error rates and latency"
echo "   - Gradually increase to 50%, then 100%"
echo ""
echo "3. 📊 MONITORING (Ongoing):"
echo "   - Monitor service-specific metrics"
echo "   - Track inter-service communication costs (should be $0)"
echo "   - Measure bundle size improvements"
echo ""
echo "4. 🗑️ CLEANUP (After full migration):"
echo "   - Deprecate monolithic worker"
echo "   - Remove old deployment artifacts"
echo "   - Update documentation"

# Generate migration checklist
echo ""
echo "✅ MIGRATION CHECKLIST:"
echo "======================"
echo ""
for service in "${DEPLOYED_SERVICES[@]}"; do
    echo "✅ $service - Deployed and ready"
done
echo ""
if [ ${#FAILED_SERVICES[@]} -gt 0 ]; then
    echo "❌ FAILED SERVICES TO ADDRESS:"
    for service in "${FAILED_SERVICES[@]}"; do
        echo "❌ $service - Needs attention"
    done
    echo ""
fi

# Summary
echo "📈 EXPECTED IMPROVEMENTS:"
echo "========================"
echo "• Bundle Size: 5MB → 1-2MB per service (50-80% reduction)"
echo "• Cold Start: 10ms → 2-5ms (smaller bundles)"
echo "• Development: Independent team deployments"
echo "• Cost: $0 for service binding calls"
echo "• Reliability: Fault isolation between services"
echo "• Scaling: Each portal scales independently"

echo ""
echo "🎯 SUCCESS METRICS TO MONITOR:"
echo "=============================="
echo "• Response time <50ms for router"
echo "• Service-to-service latency <10ms"
echo "• Zero service binding charges in bill"
echo "• Independent service deployment success rate >95%"
echo "• Overall system reliability improvement"

echo ""
if [ ${#FAILED_SERVICES[@]} -eq 0 ]; then
    echo "🎉 Service Bindings deployment completed successfully!"
    echo "Ready to begin gradual traffic migration."
    exit 0
else
    echo "⚠️ Service Bindings deployment completed with issues."
    echo "Address failed services before beginning migration."
    exit 1
fi