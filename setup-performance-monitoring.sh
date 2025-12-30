#!/bin/bash

echo "📊 Setting Up Performance Monitoring Dashboard"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create monitoring directory
mkdir -p monitoring/performance

# Create real-time monitoring script
cat > monitoring/performance/monitor-live.sh << 'EOF'
#!/bin/bash

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
INTERVAL=5  # seconds between checks

clear
echo "📊 LIVE PERFORMANCE MONITORING"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Press Ctrl+C to stop"
echo ""

# Initialize counters
TOTAL_REQUESTS=0
CACHE_HITS=0
TOTAL_TIME=0

while true; do
    # Test request
    RESPONSE=$(curl -s -w "\nTIME:%{time_total}\nHTTP:%{http_code}" \
        -H "Accept: application/json" \
        -D - \
        "$API_URL/api/pitches/browse/enhanced?limit=5" 2>/dev/null)
    
    # Extract metrics
    RESPONSE_TIME=$(echo "$RESPONSE" | grep "TIME:" | cut -d: -f2)
    HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP:" | cut -d: -f2)
    CACHE_STATUS=$(echo "$RESPONSE" | grep -i "x-cache-status:" | cut -d: -f2 | tr -d ' \r')
    X_RESPONSE_TIME=$(echo "$RESPONSE" | grep -i "x-response-time:" | cut -d: -f2 | tr -d ' \r')
    
    # Update counters
    TOTAL_REQUESTS=$((TOTAL_REQUESTS + 1))
    if [ "$CACHE_STATUS" = "HIT" ]; then
        CACHE_HITS=$((CACHE_HITS + 1))
    fi
    TOTAL_TIME=$(echo "$TOTAL_TIME + $RESPONSE_TIME" | bc)
    
    # Calculate averages
    if [ $TOTAL_REQUESTS -gt 0 ]; then
        AVG_TIME=$(echo "scale=3; $TOTAL_TIME / $TOTAL_REQUESTS" | bc)
        CACHE_RATE=$(echo "scale=1; $CACHE_HITS * 100 / $TOTAL_REQUESTS" | bc)
    else
        AVG_TIME=0
        CACHE_RATE=0
    fi
    
    # Clear and display
    clear
    echo "📊 LIVE PERFORMANCE MONITORING"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🌐 Endpoint: /api/pitches/browse/enhanced"
    echo "⏱️  Last Response: ${RESPONSE_TIME}s (${X_RESPONSE_TIME})"
    echo "📦 Cache Status: $CACHE_STATUS"
    echo "🔢 HTTP Status: $HTTP_CODE"
    echo ""
    echo "📈 Statistics (Session)"
    echo "━━━━━━━━━━━━━━━━━━━━━━"
    echo "Total Requests: $TOTAL_REQUESTS"
    echo "Cache Hits: $CACHE_HITS"
    echo "Cache Hit Rate: ${CACHE_RATE}%"
    echo "Avg Response Time: ${AVG_TIME}s"
    echo ""
    echo "Updated: $(date '+%Y-%m-%d %H:%M:%S')"
    
    sleep $INTERVAL
done
EOF

chmod +x monitoring/performance/monitor-live.sh

# Create performance report generator
cat > monitoring/performance/generate-report.sh << 'EOF'
#!/bin/bash

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
REPORT_FILE="monitoring/performance/report-$(date +%Y%m%d-%H%M%S).md"

echo "📊 Generating Performance Report..."

# Test various endpoints
ENDPOINTS=(
    "/api/health"
    "/api/pitches/browse/enhanced?limit=10"
    "/api/pitches/browse/general?limit=10"
)

echo "# Performance Report" > $REPORT_FILE
echo "Generated: $(date)" >> $REPORT_FILE
echo "" >> $REPORT_FILE

echo "## Endpoint Performance" >> $REPORT_FILE
echo "" >> $REPORT_FILE
echo "| Endpoint | Response Time | Cache Status | Status Code |" >> $REPORT_FILE
echo "|----------|--------------|--------------|-------------|" >> $REPORT_FILE

for endpoint in "${ENDPOINTS[@]}"; do
    # Make 3 requests to test cache
    for i in {1..3}; do
        RESPONSE=$(curl -s -w "\nTIME:%{time_total}\nHTTP:%{http_code}" \
            -H "Accept: application/json" \
            -D - \
            "$API_URL$endpoint" 2>/dev/null)
        
        RESPONSE_TIME=$(echo "$RESPONSE" | grep "TIME:" | cut -d: -f2)
        HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP:" | cut -d: -f2)
        CACHE_STATUS=$(echo "$RESPONSE" | grep -i "x-cache-status:" | cut -d: -f2 | tr -d ' \r')
        
        if [ -z "$CACHE_STATUS" ]; then
            CACHE_STATUS="N/A"
        fi
        
        echo "| $endpoint (attempt $i) | ${RESPONSE_TIME}s | $CACHE_STATUS | $HTTP_CODE |" >> $REPORT_FILE
    done
done

echo "" >> $REPORT_FILE
echo "## Cache Effectiveness" >> $REPORT_FILE
echo "" >> $REPORT_FILE

# Test cache warming
echo "Testing cache warming..." >> $REPORT_FILE
COLD_TIME=$(curl -s -w "%{time_total}" -o /dev/null "$API_URL/api/pitches/browse/enhanced?test=cold")
sleep 1
WARM_TIME=$(curl -s -w "%{time_total}" -o /dev/null "$API_URL/api/pitches/browse/enhanced?test=cold")

IMPROVEMENT=$(echo "scale=1; (1 - $WARM_TIME / $COLD_TIME) * 100" | bc 2>/dev/null || echo "0")
echo "- Cold request: ${COLD_TIME}s" >> $REPORT_FILE
echo "- Warm request: ${WARM_TIME}s" >> $REPORT_FILE
echo "- Improvement: ${IMPROVEMENT}%" >> $REPORT_FILE

echo "" >> $REPORT_FILE
echo "## Recommendations" >> $REPORT_FILE
echo "" >> $REPORT_FILE
echo "Based on the performance metrics:" >> $REPORT_FILE
echo "" >> $REPORT_FILE

if (( $(echo "$IMPROVEMENT > 50" | bc -l) )); then
    echo "✅ Cache is working effectively (>${IMPROVEMENT}% improvement)" >> $REPORT_FILE
else
    echo "⚠️ Cache effectiveness is low. Consider:" >> $REPORT_FILE
    echo "  - Increasing cache TTL" >> $REPORT_FILE
    echo "  - Pre-warming popular endpoints" >> $REPORT_FILE
fi

echo "" >> $REPORT_FILE
echo "Report saved to: $REPORT_FILE"
cat $REPORT_FILE
EOF

chmod +x monitoring/performance/generate-report.sh

# Create Cloudflare Analytics integration
cat > monitoring/performance/analytics-dashboard.md << 'EOF'
# Cloudflare Analytics Dashboard Setup

## Key Metrics to Monitor

### 1. Worker Analytics
- **Requests per second**: Monitor traffic patterns
- **CPU time**: Track compute usage
- **Duration**: Response time distribution
- **Subrequests**: Database and cache calls

### 2. Cache Performance
- **Cache hit ratio**: Should be >80% for frequently accessed data
- **Cache misses**: Identify patterns for optimization
- **KV operations**: Read/write patterns

### 3. Error Tracking
- **Error rate**: Should be <1%
- **Error types**: Identify common failures
- **Status codes**: Monitor 4xx and 5xx responses

## Setting Up Custom Analytics

1. **Enable Logpush** (Enterprise only):
```bash
wrangler logpush create \
  --dataset workers \
  --destination "s3://your-bucket/logs" \
  --fields "timestamp,outcome,scriptName,duration"
```

2. **Use Workers Analytics Engine**:
```javascript
// In your worker
env.ANALYTICS.writeDataPoint({
  blobs: ['cache-hit', request.url],
  doubles: [responseTime],
  indexes: ['endpoint']
});
```

3. **Create Custom Dashboards**:
- Use Cloudflare Dashboard → Analytics → Workers
- Filter by worker name: `pitchey-production`
- Create saved views for common queries

## Alert Configuration

### Set up alerts for:
1. **High error rate**: >5% errors
2. **Slow responses**: p99 latency >1s
3. **Cache degradation**: Hit rate <70%
4. **Rate limiting**: Too many 429 responses

### Webhook Integration:
```bash
curl -X POST https://api.cloudflare.com/client/v4/accounts/{account_id}/alerting/policies \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Worker Performance Alert",
    "alert_type": "workers_performance",
    "filters": {
      "services": ["pitchey-production"]
    },
    "conditions": {
      "cpu_time": ">100ms",
      "error_rate": ">0.05"
    }
  }'
```
EOF

echo "✅ Performance Monitoring Setup Complete!"
echo ""
echo "📊 Available Tools:"
echo "  1. Live Monitor: ./monitoring/performance/monitor-live.sh"
echo "  2. Generate Report: ./monitoring/performance/generate-report.sh"
echo "  3. Analytics Guide: monitoring/performance/analytics-dashboard.md"
echo ""
echo "🚀 Quick Start:"
echo "  Run live monitoring: ./monitoring/performance/monitor-live.sh"