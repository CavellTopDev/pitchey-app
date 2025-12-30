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
