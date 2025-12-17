#!/bin/bash

# Performance Anomaly Detection Script
# Monitors for performance degradation and unusual patterns

API_URL="${API_URL:-https://pitchey-production.cavelltheleaddev.workers.dev}"
ALERT_DIR="./anomaly-alerts"
LOG_FILE="$ALERT_DIR/anomalies_$(date +%Y%m%d).log"
BASELINE_FILE="${BASELINE_FILE:-./baseline-data/baseline.json}"
CHECK_INTERVAL="${CHECK_INTERVAL:-30}" # seconds

mkdir -p "$ALERT_DIR"

# Thresholds (can be customized)
RESPONSE_TIME_THRESHOLD=300  # ms (warn if slower than baseline by this amount)
ERROR_RATE_THRESHOLD=5       # % error rate to trigger alert
CACHE_DROP_THRESHOLD=20      # % drop in cache hit rate
SPIKE_MULTIPLIER=2           # Alert if response time is 2x baseline

echo "🚨 Performance Anomaly Detector"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Monitoring for performance anomalies..."
echo "Alert log: $LOG_FILE"
echo ""

# Load baseline if exists
declare -A BASELINE_TIMES
declare -A BASELINE_CACHE_RATES

if [ -f "$BASELINE_FILE" ]; then
    echo "Loading baseline from: $BASELINE_FILE"
    # Parse baseline data (simplified - in production use jq)
    BASELINE_LOADED=true
else
    echo "⚠️ No baseline found. Will establish baseline in first hour."
    BASELINE_LOADED=false
fi

# Initialize sliding window for metrics
declare -A WINDOW_TIMES
declare -A WINDOW_ERRORS
declare -A WINDOW_CACHE_HITS
WINDOW_SIZE=10  # Keep last 10 measurements

# Alert state tracking
declare -A ALERT_ACTIVE
declare -A ALERT_COUNT

# Endpoints to monitor
ENDPOINTS=(
    "/api/health/detailed"
    "/api/pitches/browse/enhanced?limit=5"
    "/api/pitches?limit=10"
)

# Function to send alert
send_alert() {
    local severity=$1
    local endpoint=$2
    local issue=$3
    local details=$4
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    # Log to file
    echo "[$timestamp] [$severity] $endpoint: $issue - $details" >> "$LOG_FILE"
    
    # Display alert
    case $severity in
        "CRITICAL")
            echo "🔴 CRITICAL: $endpoint"
            echo "   Issue: $issue"
            echo "   Details: $details"
            ;;
        "WARNING")
            echo "🟡 WARNING: $endpoint"
            echo "   Issue: $issue"
            echo "   Details: $details"
            ;;
        "INFO")
            echo "ℹ️ INFO: $endpoint"
            echo "   $details"
            ;;
    esac
    
    # In production, could send to Slack, PagerDuty, etc.
    # Example: curl -X POST $SLACK_WEBHOOK -d "{\"text\": \"$severity: $issue\"}"
}

# Function to calculate statistics
calculate_stats() {
    local values="$1"
    local count=$(echo "$values" | wc -w)
    
    if [ $count -eq 0 ]; then
        echo "0 0 0"
        return
    fi
    
    # Calculate mean
    local sum=$(echo "$values" | tr ' ' '\n' | awk '{sum+=$1} END {print sum}')
    local mean=$(echo "scale=2; $sum / $count" | bc)
    
    # Calculate standard deviation
    local variance=$(echo "$values" | tr ' ' '\n' | awk -v mean=$mean '{sum+=($1-mean)^2} END {print sum/NR}')
    local stddev=$(echo "scale=2; sqrt($variance)" | bc 2>/dev/null || echo "0")
    
    # Find max
    local max=$(echo "$values" | tr ' ' '\n' | sort -rn | head -1)
    
    echo "$mean $stddev $max"
}

# Function to detect anomalies
detect_anomalies() {
    local endpoint=$1
    local response_time=$2  # in ms
    local http_code=$3
    local cache_status=$4
    local endpoint_key=$(echo "$endpoint" | md5sum | cut -d' ' -f1)
    
    # Add to sliding window
    if [ -z "${WINDOW_TIMES[$endpoint_key]}" ]; then
        WINDOW_TIMES[$endpoint_key]=""
        WINDOW_ERRORS[$endpoint_key]=""
        WINDOW_CACHE_HITS[$endpoint_key]=""
    fi
    
    WINDOW_TIMES[$endpoint_key]="${WINDOW_TIMES[$endpoint_key]} $response_time"
    WINDOW_ERRORS[$endpoint_key]="${WINDOW_ERRORS[$endpoint_key]} $([ "$http_code" != "200" ] && echo 1 || echo 0)"
    WINDOW_CACHE_HITS[$endpoint_key]="${WINDOW_CACHE_HITS[$endpoint_key]} $([ "$cache_status" = "HIT" ] && echo 1 || echo 0)"
    
    # Keep window size limited
    WINDOW_TIMES[$endpoint_key]=$(echo "${WINDOW_TIMES[$endpoint_key]}" | tr ' ' '\n' | tail -$WINDOW_SIZE | tr '\n' ' ')
    WINDOW_ERRORS[$endpoint_key]=$(echo "${WINDOW_ERRORS[$endpoint_key]}" | tr ' ' '\n' | tail -$WINDOW_SIZE | tr '\n' ' ')
    WINDOW_CACHE_HITS[$endpoint_key]=$(echo "${WINDOW_CACHE_HITS[$endpoint_key]}" | tr ' ' '\n' | tail -$WINDOW_SIZE | tr '\n' ' ')
    
    # Calculate current statistics
    read mean_time stddev_time max_time <<< $(calculate_stats "${WINDOW_TIMES[$endpoint_key]}")
    
    # Count errors and cache hits
    local error_count=$(echo "${WINDOW_ERRORS[$endpoint_key]}" | tr ' ' '\n' | grep -c "1" || echo 0)
    local cache_hit_count=$(echo "${WINDOW_CACHE_HITS[$endpoint_key]}" | tr ' ' '\n' | grep -c "1" || echo 0)
    local window_count=$(echo "${WINDOW_TIMES[$endpoint_key]}" | wc -w)
    
    local error_rate=0
    local cache_rate=0
    if [ $window_count -gt 0 ]; then
        error_rate=$(echo "scale=1; $error_count * 100 / $window_count" | bc)
        cache_rate=$(echo "scale=1; $cache_hit_count * 100 / $window_count" | bc)
    fi
    
    # Anomaly Detection Rules
    
    # 1. Response time spike
    if [ $(echo "$response_time > $mean_time * $SPIKE_MULTIPLIER" | bc) -eq 1 ] && [ $(echo "$mean_time > 0" | bc) -eq 1 ]; then
        send_alert "WARNING" "$endpoint" "Response time spike" \
            "Current: ${response_time}ms, Average: ${mean_time}ms (${SPIKE_MULTIPLIER}x spike)"
    fi
    
    # 2. Sustained high response times
    if [ $(echo "$mean_time > $RESPONSE_TIME_THRESHOLD" | bc) -eq 1 ]; then
        if [ -z "${ALERT_ACTIVE[$endpoint_key:slow]}" ]; then
            send_alert "CRITICAL" "$endpoint" "Sustained slow performance" \
                "Average: ${mean_time}ms over last $window_count requests"
            ALERT_ACTIVE[$endpoint_key:slow]=1
        fi
    else
        unset ALERT_ACTIVE[$endpoint_key:slow]
    fi
    
    # 3. High error rate
    if [ $(echo "$error_rate > $ERROR_RATE_THRESHOLD" | bc) -eq 1 ]; then
        send_alert "CRITICAL" "$endpoint" "High error rate" \
            "${error_rate}% errors in last $window_count requests"
    fi
    
    # 4. Cache performance drop
    if [ "$BASELINE_LOADED" = true ] && [ -n "${BASELINE_CACHE_RATES[$endpoint_key]}" ]; then
        local baseline_cache=${BASELINE_CACHE_RATES[$endpoint_key]}
        local cache_drop=$(echo "$baseline_cache - $cache_rate" | bc)
        
        if [ $(echo "$cache_drop > $CACHE_DROP_THRESHOLD" | bc) -eq 1 ]; then
            send_alert "WARNING" "$endpoint" "Cache hit rate dropped" \
                "Current: ${cache_rate}%, Baseline: ${baseline_cache}% (${cache_drop}% drop)"
        fi
    fi
    
    # 5. Complete failure
    if [ "$http_code" != "200" ] && [ "$http_code" != "0" ]; then
        ALERT_COUNT[$endpoint_key]=$((${ALERT_COUNT[$endpoint_key]:-0} + 1))
        
        if [ ${ALERT_COUNT[$endpoint_key]} -ge 3 ]; then
            send_alert "CRITICAL" "$endpoint" "Repeated failures" \
                "HTTP $http_code - ${ALERT_COUNT[$endpoint_key]} consecutive failures"
        fi
    else
        ALERT_COUNT[$endpoint_key]=0
    fi
    
    # 6. Standard deviation anomaly (statistical outlier)
    if [ $(echo "$stddev_time > 0" | bc) -eq 1 ]; then
        local z_score=$(echo "scale=2; ($response_time - $mean_time) / $stddev_time" | bc 2>/dev/null || echo "0")
        
        if [ $(echo "$z_score > 3" | bc 2>/dev/null) -eq 1 ]; then
            send_alert "INFO" "$endpoint" "Statistical outlier detected" \
                "Z-score: $z_score (response time: ${response_time}ms)"
        fi
    fi
}

# Function to test endpoint
test_endpoint() {
    local endpoint=$1
    
    # Make request
    local start_time=$(date +%s%N)
    local response=$(curl -s -w "\n===HTTP_CODE===%{http_code}" \
        -H "Accept: application/json" \
        -D /tmp/headers_anomaly.txt \
        "$API_URL$endpoint" 2>/dev/null)
    local end_time=$(date +%s%N)
    
    # Calculate response time in ms
    local response_time=$(echo "scale=0; ($end_time - $start_time) / 1000000" | bc)
    
    # Extract metrics
    local http_code=$(echo "$response" | grep "===HTTP_CODE===" | cut -d= -f4)
    local cache_status=$(grep -i "x-cache-status:" /tmp/headers_anomaly.txt | cut -d: -f2 | tr -d ' \r' || echo "NONE")
    
    # Detect anomalies
    detect_anomalies "$endpoint" "$response_time" "$http_code" "$cache_status"
    
    # Return metrics for display
    echo "$endpoint|$response_time|$http_code|$cache_status"
}

# Display function
display_status() {
    clear
    echo "🚨 Performance Anomaly Detector"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Time: $(date '+%H:%M:%S')"
    echo ""
    echo "Current Status:"
    echo "──────────────"
    
    for result in "$@"; do
        IFS='|' read -r endpoint time code cache <<< "$result"
        printf "%-40s %6sms HTTP:%s Cache:%s\n" \
            "$(echo $endpoint | cut -c1-40)" "$time" "$code" "$cache"
    done
    
    echo ""
    
    # Show recent alerts
    if [ -f "$LOG_FILE" ]; then
        echo "Recent Alerts:"
        echo "──────────────"
        tail -5 "$LOG_FILE" 2>/dev/null | while read line; do
            echo "$line" | cut -c1-80
        done
    fi
}

# Main monitoring loop
echo "Starting anomaly detection..."
echo "Monitoring ${#ENDPOINTS[@]} endpoints"
echo ""

while true; do
    results=()
    
    # Test all endpoints
    for endpoint in "${ENDPOINTS[@]}"; do
        result=$(test_endpoint "$endpoint")
        results+=("$result")
    done
    
    # Display current status
    display_status "${results[@]}"
    
    # Wait before next check
    sleep $CHECK_INTERVAL
done