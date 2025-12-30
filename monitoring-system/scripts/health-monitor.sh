#!/bin/bash

# Continuous health monitoring with automatic alerting
# Run this in background: nohup ./health-monitor.sh &

PRODUCTION_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
LOG_DIR="./monitoring-system/logs"
ALERT_DIR="./monitoring-system/alerts"
CHECK_INTERVAL=60  # 1 minute

mkdir -p "$LOG_DIR" "$ALERT_DIR"

echo "🔍 Starting health monitor at $(date)"
echo "Monitoring: $PRODUCTION_URL every ${CHECK_INTERVAL}s"

while true; do
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    LOG_FILE="$LOG_DIR/health-$(date '+%Y%m%d').log"
    
    # Health endpoint check
    HEALTH_RESPONSE=$(curl -s -w "HTTP_%{http_code}_%{time_total}" "$PRODUCTION_URL/api/health" -o /tmp/health_check.json || echo "HEALTH_FAILED")
    
    if echo "$HEALTH_RESPONSE" | grep -q "HTTP_200"; then
        RESPONSE_TIME=$(echo "$HEALTH_RESPONSE" | cut -d'_' -f3)
        echo "[$TIMESTAMP] ✅ Health OK (${RESPONSE_TIME}s)" >> "$LOG_FILE"
        
        # Check if response time is degraded
        if command -v bc &> /dev/null; then
            if (( $(echo "$RESPONSE_TIME > 0.5" | bc -l 2>/dev/null || echo 0) )); then
                echo "[$TIMESTAMP] ⚠️ ALERT: Slow response time: ${RESPONSE_TIME}s" >> "$ALERT_DIR/performance-alerts.log"
            fi
        fi
        
        # Check database pool status
        if command -v jq &> /dev/null && [ -f /tmp/health_check.json ]; then
            POOL_SIZE=$(jq -r '.poolStats.poolSize // "N/A"' /tmp/health_check.json 2>/dev/null)
            if [ "$POOL_SIZE" != "1" ] && [ "$POOL_SIZE" != "N/A" ]; then
                echo "[$TIMESTAMP] ⚠️ ALERT: Database pool size: $POOL_SIZE (should be 1)" >> "$ALERT_DIR/database-alerts.log"
            fi
        fi
        
    else
        echo "[$TIMESTAMP] ❌ CRITICAL: Health check failed - $HEALTH_RESPONSE" >> "$LOG_FILE"
        echo "[$TIMESTAMP] 🚨 CRITICAL ALERT: Production health endpoint failing" >> "$ALERT_DIR/critical-alerts.log"
        
        # Attempt basic diagnostics
        echo "[$TIMESTAMP] Running diagnostics..." >> "$LOG_FILE"
        
        # Test auth endpoint
        AUTH_STATUS=$(curl -s -w "%{http_code}" -o /dev/null "$PRODUCTION_URL/api/validate-token" -H "Authorization: Bearer test" || echo "000")
        echo "[$TIMESTAMP] Auth endpoint: HTTP $AUTH_STATUS" >> "$LOG_FILE"
        
        # Test WebSocket endpoint
        WS_STATUS=$(curl -s -w "%{http_code}" -o /dev/null "$PRODUCTION_URL/ws" --http1.1 --header "Connection: Upgrade" --header "Upgrade: websocket" || echo "000")
        echo "[$TIMESTAMP] WebSocket endpoint: HTTP $WS_STATUS" >> "$LOG_FILE"
    fi
    
    # Cache performance test
    CACHE_TEST_TIME=$(curl -w "%{time_total}" -s -o /dev/null "$PRODUCTION_URL/api/investor/dashboard" -H "Authorization: Bearer test-token" 2>/dev/null || echo "ERROR")
    if [ "$CACHE_TEST_TIME" != "ERROR" ]; then
        echo "[$TIMESTAMP] Cache test: ${CACHE_TEST_TIME}s" >> "$LOG_FILE"
    fi
    
    # Cleanup
    rm -f /tmp/health_check.json
    
    # Wait for next check
    sleep $CHECK_INTERVAL
done
