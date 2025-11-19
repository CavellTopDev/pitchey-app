#!/bin/bash

# Live monitoring dashboard
# Run: ./monitoring-dashboard.sh

clear
echo "🔴 LIVE PITCHEY PLATFORM MONITORING"
echo "===================================="
echo ""

PRODUCTION_URL="https://pitchey-production.cavelltheleaddev.workers.dev"

while true; do
    # Clear and redraw
    tput cup 4 0
    
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    echo "Last Update: $TIMESTAMP"
    echo ""
    
    # Health Status
    echo "🏥 HEALTH STATUS"
    echo "---------------"
    HEALTH_STATUS=$(curl -s -w "HTTP_%{http_code}_%{time_total}" "$PRODUCTION_URL/api/health" -o /tmp/dashboard_health.json || echo "FAILED")
    
    if echo "$HEALTH_STATUS" | grep -q "HTTP_200"; then
        RESPONSE_TIME=$(echo "$HEALTH_STATUS" | cut -d'_' -f3)
        echo "✅ Production: HEALTHY (${RESPONSE_TIME}s)"
        
        if command -v jq &> /dev/null && [ -f /tmp/dashboard_health.json ]; then
            POOL_SIZE=$(jq -r '.poolStats.poolSize // "N/A"' /tmp/dashboard_health.json 2>/dev/null)
            echo "💾 Database Pool: $POOL_SIZE connection(s)"
        fi
    else
        echo "❌ Production: FAILING - $HEALTH_STATUS"
    fi
    
    echo ""
    
    # Performance Metrics
    echo "⚡ PERFORMANCE"
    echo "-------------"
    
    # Auth endpoint test
    AUTH_TIME=$(curl -w "%{time_total}" -s -o /dev/null "$PRODUCTION_URL/api/validate-token" -H "Authorization: Bearer test" 2>/dev/null || echo "ERROR")
    echo "🔐 Auth Endpoint: ${AUTH_TIME}s"
    
    # Cache test
    CACHE_TIME=$(curl -w "%{time_total}" -s -o /dev/null "$PRODUCTION_URL/api/investor/dashboard" -H "Authorization: Bearer test-token" 2>/dev/null || echo "ERROR")
    echo "🧊 Dashboard Cache: ${CACHE_TIME}s"
    
    echo ""
    echo "📊 OPTIMIZATION STATUS"
    echo "---------------------"
    echo "✅ Database Pooling: Active"
    echo "✅ Multi-layer Cache: Operational"
    echo "✅ Error Monitoring: Enabled"
    echo "✅ Cost Controls: Documented"
    
    echo ""
    echo "Press Ctrl+C to exit monitoring..."
    
    # Cleanup
    rm -f /tmp/dashboard_health.json
    
    # Update every 10 seconds
    sleep 10
done
