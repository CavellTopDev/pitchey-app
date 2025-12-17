#!/bin/bash

API_URL="https://pitchey-production.cavelltheleaddev.workers.dev"
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
