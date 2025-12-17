#!/bin/bash

# Continuous Performance Monitoring Script
# Logs performance metrics for 24-48 hour analysis

API_URL="${API_URL:-https://pitchey-production.cavelltheleaddev.workers.dev}"
LOG_DIR="./continuous-logs"
INTERVAL="${INTERVAL:-60}" # Default 60 seconds between tests
DURATION="${DURATION:-86400}" # Default 24 hours (in seconds)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
METRICS_FILE="$LOG_DIR/metrics_${TIMESTAMP}.jsonl"
SUMMARY_FILE="$LOG_DIR/summary_${TIMESTAMP}.json"
ALERT_THRESHOLD="${ALERT_THRESHOLD:-500}" # Alert if response time > 500ms

# Create log directory
mkdir -p "$LOG_DIR"

echo "🔄 Continuous Performance Monitor"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "API URL: $API_URL"
echo "Test Interval: ${INTERVAL}s"
echo "Duration: ${DURATION}s ($(echo "scale=1; $DURATION/3600" | bc) hours)"
echo "Metrics Log: $METRICS_FILE"
echo "Alert Threshold: ${ALERT_THRESHOLD}ms"
echo ""
echo "Press Ctrl+C to stop early"
echo ""

# Trap to create summary on exit
trap 'create_summary' EXIT

# Critical endpoints to monitor
declare -A ENDPOINTS=(
    ["health"]="/api/health"
    ["health_detailed"]="/api/health/detailed"
    ["browse_basic"]="/api/pitches/browse/enhanced?limit=5"
    ["browse_sorted"]="/api/pitches/browse/enhanced?limit=10&sort=newest"
    ["pitches_list"]="/api/pitches?limit=10"
    ["auth_check"]="/api/auth/check"
)

# Initialize counters
declare -A TOTAL_REQUESTS
declare -A TOTAL_TIME
declare -A CACHE_HITS
declare -A ERROR_COUNT
declare -A SLOW_REQUESTS

for key in "${!ENDPOINTS[@]}"; do
    TOTAL_REQUESTS[$key]=0
    TOTAL_TIME[$key]=0
    CACHE_HITS[$key]=0
    ERROR_COUNT[$key]=0
    SLOW_REQUESTS[$key]=0
done

START_TIME=$(date +%s)
END_TIME=$((START_TIME + DURATION))

# Function to test endpoint
test_endpoint() {
    local key=$1
    local endpoint=${ENDPOINTS[$key]}
    
    # Make request with detailed metrics
    local response=$(curl -s -o /tmp/resp_body_${key}.txt -w @- "$API_URL$endpoint" \
        -H "Accept: application/json" \
        -H "User-Agent: ContinuousMonitor/1.0" \
        -D /tmp/resp_headers_${key}.txt \
        --max-time 10 <<'EOF'
{
    "time_total": %{time_total},
    "time_starttransfer": %{time_starttransfer},
    "http_code": %{http_code},
    "size_download": %{size_download}
}
EOF
    )
    
    # Parse response
    local time_total=$(echo "$response" | jq -r '.time_total' 2>/dev/null || echo "0")
    local http_code=$(echo "$response" | jq -r '.http_code' 2>/dev/null || echo "0")
    
    # Extract headers
    local cache_status=$(grep -i "x-cache-status:" /tmp/resp_headers_${key}.txt 2>/dev/null | cut -d: -f2 | tr -d ' \r' || echo "NONE")
    local x_response_time=$(grep -i "x-response-time:" /tmp/resp_headers_${key}.txt 2>/dev/null | cut -d: -f2 | tr -d ' \r' || echo "N/A")
    local cf_cache_status=$(grep -i "cf-cache-status:" /tmp/resp_headers_${key}.txt 2>/dev/null | cut -d: -f2 | tr -d ' \r' || echo "NONE")
    local cf_ray=$(grep -i "cf-ray:" /tmp/resp_headers_${key}.txt 2>/dev/null | cut -d: -f2 | tr -d ' \r' || echo "N/A")
    
    # Update counters
    TOTAL_REQUESTS[$key]=$((TOTAL_REQUESTS[$key] + 1))
    TOTAL_TIME[$key]=$(echo "${TOTAL_TIME[$key]} + $time_total" | bc)
    
    if [ "$cache_status" = "HIT" ]; then
        CACHE_HITS[$key]=$((CACHE_HITS[$key] + 1))
    fi
    
    if [ "$http_code" != "200" ] && [ "$http_code" != "0" ]; then
        ERROR_COUNT[$key]=$((ERROR_COUNT[$key] + 1))
    fi
    
    # Check if slow
    local time_ms=$(echo "$time_total * 1000" | bc | cut -d. -f1)
    if [ "$time_ms" -gt "$ALERT_THRESHOLD" ]; then
        SLOW_REQUESTS[$key]=$((SLOW_REQUESTS[$key] + 1))
        echo "⚠️  SLOW: $endpoint - ${time_total}s" >&2
    fi
    
    # Log to JSONL file
    echo "{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"endpoint_key\":\"$key\",\"endpoint\":\"$endpoint\",\"http_code\":$http_code,\"time_total\":$time_total,\"cache_status\":\"$cache_status\",\"cf_cache\":\"$cf_cache_status\",\"x_response_time\":\"$x_response_time\",\"cf_ray\":\"$cf_ray\"}" >> "$METRICS_FILE"
    
    return 0
}

# Function to display stats
display_stats() {
    clear
    echo "🔄 Continuous Performance Monitor"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Runtime: $(date -u -d @$(($(date +%s) - START_TIME)) +"%H:%M:%S")"
    echo ""
    echo "Endpoint Statistics:"
    echo "───────────────────────────────────"
    printf "%-20s %8s %8s %8s %8s %8s\n" "Endpoint" "Reqs" "Avg(ms)" "Cache%" "Errors" "Slow"
    echo "───────────────────────────────────"
    
    for key in "${!ENDPOINTS[@]}"; do
        local reqs=${TOTAL_REQUESTS[$key]}
        local avg_time=0
        local cache_rate=0
        
        if [ $reqs -gt 0 ]; then
            avg_time=$(echo "scale=0; ${TOTAL_TIME[$key]} * 1000 / $reqs" | bc)
            if [ ${CACHE_HITS[$key]} -gt 0 ]; then
                cache_rate=$(echo "scale=0; ${CACHE_HITS[$key]} * 100 / $reqs" | bc)
            fi
        fi
        
        printf "%-20s %8d %8d %7d%% %8d %8d\n" \
            "$key" \
            "$reqs" \
            "$avg_time" \
            "$cache_rate" \
            "${ERROR_COUNT[$key]}" \
            "${SLOW_REQUESTS[$key]}"
    done
    
    echo ""
    echo "Last Update: $(date '+%Y-%m-%d %H:%M:%S')"
}

# Function to create summary
create_summary() {
    echo ""
    echo "Creating summary report..."
    
    # Calculate overall statistics
    local total_reqs=0
    local total_cache=0
    local total_errors=0
    local total_slow=0
    
    for key in "${!ENDPOINTS[@]}"; do
        total_reqs=$((total_reqs + TOTAL_REQUESTS[$key]))
        total_cache=$((total_cache + CACHE_HITS[$key]))
        total_errors=$((total_errors + ERROR_COUNT[$key]))
        total_slow=$((total_slow + SLOW_REQUESTS[$key]))
    done
    
    # Create summary JSON
    cat > "$SUMMARY_FILE" <<EOF
{
  "test_info": {
    "start_time": "$(date -u -d @$START_TIME +"%Y-%m-%dT%H:%M:%SZ")",
    "end_time": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "duration_seconds": $(($(date +%s) - START_TIME)),
    "api_url": "$API_URL",
    "interval_seconds": $INTERVAL,
    "alert_threshold_ms": $ALERT_THRESHOLD
  },
  "overall_stats": {
    "total_requests": $total_reqs,
    "total_cache_hits": $total_cache,
    "cache_hit_rate": $([ $total_reqs -gt 0 ] && echo "scale=2; $total_cache * 100 / $total_reqs" | bc || echo 0),
    "total_errors": $total_errors,
    "error_rate": $([ $total_reqs -gt 0 ] && echo "scale=2; $total_errors * 100 / $total_reqs" | bc || echo 0),
    "total_slow_requests": $total_slow,
    "slow_rate": $([ $total_reqs -gt 0 ] && echo "scale=2; $total_slow * 100 / $total_reqs" | bc || echo 0)
  },
  "endpoint_stats": {
EOF
    
    # Add per-endpoint stats
    local first=true
    for key in "${!ENDPOINTS[@]}"; do
        if [ "$first" = false ]; then
            echo "," >> "$SUMMARY_FILE"
        fi
        first=false
        
        local reqs=${TOTAL_REQUESTS[$key]}
        local avg_time=0
        local cache_rate=0
        local error_rate=0
        
        if [ $reqs -gt 0 ]; then
            avg_time=$(echo "scale=3; ${TOTAL_TIME[$key]} / $reqs" | bc)
            cache_rate=$(echo "scale=2; ${CACHE_HITS[$key]} * 100 / $reqs" | bc)
            error_rate=$(echo "scale=2; ${ERROR_COUNT[$key]} * 100 / $reqs" | bc)
        fi
        
        cat >> "$SUMMARY_FILE" <<EOF
    "$key": {
      "endpoint": "${ENDPOINTS[$key]}",
      "total_requests": $reqs,
      "average_time_seconds": $avg_time,
      "cache_hits": ${CACHE_HITS[$key]},
      "cache_hit_rate": $cache_rate,
      "errors": ${ERROR_COUNT[$key]},
      "error_rate": $error_rate,
      "slow_requests": ${SLOW_REQUESTS[$key]}
    }
EOF
    done
    
    echo "" >> "$SUMMARY_FILE"
    echo "  }" >> "$SUMMARY_FILE"
    echo "}" >> "$SUMMARY_FILE"
    
    echo "✅ Summary saved to: $SUMMARY_FILE"
    echo "📊 Metrics log: $METRICS_FILE"
}

# Main monitoring loop
echo "Starting continuous monitoring..."
while [ $(date +%s) -lt $END_TIME ]; do
    # Test each endpoint in parallel
    for key in "${!ENDPOINTS[@]}"; do
        test_endpoint "$key" &
    done
    
    # Wait for all tests to complete
    wait
    
    # Display stats
    display_stats
    
    # Sleep until next interval
    sleep "$INTERVAL"
done

echo ""
echo "✅ Monitoring complete!"