#!/bin/bash

# Post-Deployment Performance Monitoring Script
# Monitors Phase 1 optimization results and cost savings

PRODUCTION_URL="https://pitchey-production.cavelltheleaddev.workers.dev"
MONITOR_DURATION=${1:-300}  # Default 5 minutes, or pass duration as argument
INTERVAL=${2:-30}          # Default 30 seconds, or pass interval as argument

# Create monitoring log directory
mkdir -p ./monitoring-logs
LOG_FILE="./monitoring-logs/phase1-optimization-$(date +%Y%m%d-%H%M%S).log"

echo "📊 PHASE 1 OPTIMIZATION MONITORING" | tee -a "$LOG_FILE"
echo "==================================" | tee -a "$LOG_FILE"
echo "Monitoring: $PRODUCTION_URL" | tee -a "$LOG_FILE"
echo "Duration: ${MONITOR_DURATION}s (${INTERVAL}s intervals)" | tee -a "$LOG_FILE"
echo "Started: $(date)" | tee -a "$LOG_FILE"
echo "==================================" | tee -a "$LOG_FILE"

# Test 1: Health endpoint latency
echo -n "Health endpoint latency: " | tee -a "$LOG_FILE"
HEALTH_TIME=$(curl -w "%{time_total}" -s -o /dev/null "$PRODUCTION_URL/api/health")
echo "${HEALTH_TIME}s" | tee -a "$LOG_FILE"

# Test 2: Database connection pool stats
echo -n "Database pool status: " | tee -a "$LOG_FILE"
POOL_STATS=$(curl -s "$PRODUCTION_URL/api/health" | jq -r '.poolStats.poolSize // "N/A"')
echo "Pool size: $POOL_STATS" | tee -a "$LOG_FILE"

# Test 3: Auth endpoint performance
echo -n "Auth endpoint latency: " | tee -a "$LOG_FILE"
AUTH_TIME=$(curl -w "%{time_total}" -s -o /dev/null "$PRODUCTION_URL/api/validate-token" \
  -H "Authorization: Bearer invalid-token")
echo "${AUTH_TIME}s" | tee -a "$LOG_FILE"

# Test 4: Cache hit ratio (simulate dashboard request)
echo -n "Dashboard endpoint latency: " | tee -a "$LOG_FILE"
DASHBOARD_TIME=$(curl -w "%{time_total}" -s -o /dev/null "$PRODUCTION_URL/api/investor/dashboard" \
  -H "Authorization: Bearer fake-token-for-testing")
echo "${DASHBOARD_TIME}s" | tee -a "$LOG_FILE"

# Test 5: WebSocket endpoint availability
echo -n "WebSocket endpoint: " | tee -a "$LOG_FILE"
WS_STATUS=$(curl -s -w "%{http_code}" -o /dev/null "$PRODUCTION_URL/ws" \
  --http1.1 \
  --header "Connection: Upgrade" \
  --header "Upgrade: websocket" \
  --header "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  --header "Sec-WebSocket-Version: 13")
echo "HTTP $WS_STATUS" | tee -a "$LOG_FILE"

# Performance thresholds
echo "" | tee -a "$LOG_FILE"
echo "🎯 Performance Analysis:" | tee -a "$LOG_FILE"

# Health endpoint should be <100ms
if (( $(echo "$HEALTH_TIME > 0.1" | bc -l) )); then
  echo "⚠️  Health endpoint slow (>${HEALTH_TIME}s) - Check database connection" | tee -a "$LOG_FILE"
else
  echo "✅ Health endpoint fast (<100ms)" | tee -a "$LOG_FILE"
fi

# Pool size should be 1 (singleton pattern)
if [ "$POOL_STATS" == "1" ]; then
  echo "✅ Database pool optimized (single connection)" | tee -a "$LOG_FILE"
elif [ "$POOL_STATS" == "N/A" ]; then
  echo "⚠️  Database pool stats unavailable" | tee -a "$LOG_FILE"
else
  echo "⚠️  Database pool size: $POOL_STATS (should be 1)" | tee -a "$LOG_FILE"
fi

# Auth should be <50ms (no DB query)
if (( $(echo "$AUTH_TIME > 0.05" | bc -l) )); then
  echo "⚠️  Auth endpoint slow (>${AUTH_TIME}s) - Check JWT processing" | tee -a "$LOG_FILE"
else
  echo "✅ Auth endpoint fast (<50ms)" | tee -a "$LOG_FILE"
fi

# Generate recommendations
echo "" | tee -a "$LOG_FILE"
echo "🔧 Recommendations:" | tee -a "$LOG_FILE"

if (( $(echo "$HEALTH_TIME > 0.2" | bc -l) )); then
  echo "- Consider enabling Hyperdrive if not already active" | tee -a "$LOG_FILE"
  echo "- Check Neon compute scaling settings" | tee -a "$LOG_FILE"
fi

if [ "$POOL_STATS" != "1" ] && [ "$POOL_STATS" != "N/A" ]; then
  echo "- Investigate connection pool implementation" | tee -a "$LOG_FILE"
  echo "- Verify singleton pattern in DatabaseConnectionPool" | tee -a "$LOG_FILE"
fi

if (( $(echo "$DASHBOARD_TIME > 0.5" | bc -l) )); then
  echo "- Implement dashboard caching with 5-minute TTL" | tee -a "$LOG_FILE"
  echo "- Check database query optimization" | tee -a "$LOG_FILE"
fi

echo "" | tee -a "$LOG_FILE"
echo "================================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Optional: Send to monitoring service
if [ -n "$WEBHOOK_URL" ]; then
  curl -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"text\": \"Pitchey Performance Report\",
      \"attachments\": [
        {
          \"color\": \"good\",
          \"fields\": [
            {\"title\": \"Health Latency\", \"value\": \"${HEALTH_TIME}s\", \"short\": true},
            {\"title\": \"Pool Size\", \"value\": \"${POOL_STATS}\", \"short\": true},
            {\"title\": \"Auth Latency\", \"value\": \"${AUTH_TIME}s\", \"short\": true},
            {\"title\": \"Dashboard Latency\", \"value\": \"${DASHBOARD_TIME}s\", \"short\": true}
          ]
        }
      ]
    }"
fi

echo "📊 Performance monitoring complete. Check $LOG_FILE for details."