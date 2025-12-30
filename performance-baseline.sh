#!/bin/bash

# Performance Baseline Measurement Script
# Establishes performance baselines for all critical endpoints

WORKER_URL="${1:-https://pitchey-api-prod.ndlovucavelle.workers.dev}"
OUTPUT_FILE="performance-baseline-$(date +%Y%m%d-%H%M%S).json"

echo "📊 Establishing Performance Baselines"
echo "====================================="
echo "Worker URL: $WORKER_URL"
echo "Output: $OUTPUT_FILE"
echo ""

# Initialize results
cat << EOF > $OUTPUT_FILE
{
  "timestamp": "$(date -Iseconds)",
  "worker_url": "$WORKER_URL",
  "baselines": [],
  "summary": {}
}
EOF

# Test configuration
ITERATIONS=20
PERCENTILES=(50 75 90 95 99)

# Critical endpoints to baseline
declare -A ENDPOINTS=(
    ["trending"]="/api/pitches/trending?limit=10"
    ["new_releases"]="/api/pitches/new?limit=10"
    ["public_pitches"]="/api/pitches/public?limit=20"
    ["pitch_detail"]="/api/pitches/1"
    ["search_simple"]="/api/search?q=horror"
    ["search_filtered"]="/api/search?q=thriller&genre=Thriller&format=Feature"
    ["user_profile"]="/api/users/1"
    ["dashboard_stats"]="/api/dashboard/stats"
    ["notifications"]="/api/notifications?limit=10"
    ["db_test"]="/api/db-test"
)

# Function to calculate percentile
calculate_percentile() {
    local data=("$@")
    local percentile=$1
    shift
    local sorted=($(printf '%s\n' "${@}" | sort -g))
    local count=${#sorted[@]}
    local index=$(echo "($count - 1) * $percentile / 100" | bc)
    echo "${sorted[$index]}"
}

# Function to test endpoint
test_endpoint() {
    local name=$1
    local endpoint=$2
    local times=()
    local errors=0
    local status_codes=()
    
    echo "Testing: $name"
    echo -n "  Progress: "
    
    for i in $(seq 1 $ITERATIONS); do
        # Measure request
        RESPONSE=$(curl -s -o /tmp/response.txt -w "%{http_code}|%{time_total}|%{time_namelookup}|%{time_connect}|%{time_pretransfer}|%{time_starttransfer}|%{size_download}" \
                   "$WORKER_URL$endpoint" 2>/dev/null)
        
        IFS='|' read -r status total dns connect pretransfer ttfb size <<< "$RESPONSE"
        
        if [ "$status" != "200" ]; then
            ((errors++))
        fi
        
        times+=("$total")
        status_codes+=("$status")
        
        echo -n "."
        
        # Small delay between requests
        sleep 0.1
    done
    echo " Done"
    
    # Calculate statistics
    local sorted_times=($(printf '%s\n' "${times[@]}" | sort -g))
    local min="${sorted_times[0]}"
    local max="${sorted_times[-1]}"
    
    # Calculate average
    local sum=0
    for time in "${times[@]}"; do
        sum=$(echo "$sum + $time" | bc)
    done
    local avg=$(echo "scale=4; $sum / $ITERATIONS" | bc)
    
    # Calculate percentiles
    local p50=$(calculate_percentile 50 "${times[@]}")
    local p75=$(calculate_percentile 75 "${times[@]}")
    local p90=$(calculate_percentile 90 "${times[@]}")
    local p95=$(calculate_percentile 95 "${times[@]}")
    local p99=$(calculate_percentile 99 "${times[@]}")
    
    # Success rate
    local success_rate=$(echo "scale=2; (($ITERATIONS - $errors) / $ITERATIONS) * 100" | bc)
    
    # Output results
    echo "  Results:"
    echo "    - Min: ${min}s"
    echo "    - Avg: ${avg}s"
    echo "    - P50: ${p50}s"
    echo "    - P95: ${p95}s"
    echo "    - P99: ${p99}s"
    echo "    - Max: ${max}s"
    echo "    - Success Rate: ${success_rate}%"
    echo ""
    
    # Append to JSON
    cat << EOF >> ${OUTPUT_FILE}.tmp
{
    "endpoint": "$name",
    "url": "$endpoint",
    "samples": $ITERATIONS,
    "metrics": {
        "min": $min,
        "avg": $avg,
        "p50": $p50,
        "p75": $p75,
        "p90": $p90,
        "p95": $p95,
        "p99": $p99,
        "max": $max
    },
    "success_rate": $success_rate,
    "errors": $errors,
    "timestamp": "$(date -Iseconds)"
},
EOF
}

# Run tests
echo "Running baseline tests..."
echo "========================"
echo ""

for name in "${!ENDPOINTS[@]}"; do
    test_endpoint "$name" "${ENDPOINTS[$name]}"
done

# Create final JSON
echo "Creating baseline report..."

# Read temp results and format JSON
BASELINES=$(cat ${OUTPUT_FILE}.tmp 2>/dev/null | sed '$ s/,$//')
rm -f ${OUTPUT_FILE}.tmp

# Calculate overall statistics
cat << EOF > $OUTPUT_FILE
{
  "timestamp": "$(date -Iseconds)",
  "worker_url": "$WORKER_URL",
  "configuration": {
    "iterations": $ITERATIONS,
    "endpoints_tested": ${#ENDPOINTS[@]}
  },
  "baselines": [
    $BASELINES
  ],
  "thresholds": {
    "response_time": {
      "excellent": 0.5,
      "good": 1.0,
      "acceptable": 2.0,
      "poor": 3.0
    },
    "success_rate": {
      "excellent": 99.9,
      "good": 99.0,
      "acceptable": 95.0,
      "poor": 90.0
    }
  },
  "recommendations": []
}
EOF

echo ""
echo "✅ Baseline established!"
echo "📄 Results saved to: $OUTPUT_FILE"
echo ""

# Parse and display summary
echo "📊 Performance Summary"
echo "====================="

# Use jq if available to parse JSON nicely
if command -v jq &> /dev/null; then
    cat $OUTPUT_FILE | jq -r '.baselines[] | "\(.endpoint): P50=\(.metrics.p50)s, P95=\(.metrics.p95)s, Success=\(.success_rate)%"'
    
    echo ""
    echo "🎯 Performance Grades:"
    cat $OUTPUT_FILE | jq -r '.baselines[] | 
        if .metrics.p95 < 0.5 then 
            "  ✅ \(.endpoint): Excellent"
        elif .metrics.p95 < 1.0 then 
            "  ✅ \(.endpoint): Good"
        elif .metrics.p95 < 2.0 then 
            "  ⚠️  \(.endpoint): Acceptable"
        else 
            "  ❌ \(.endpoint): Needs Improvement"
        end'
else
    echo "Install 'jq' for better JSON formatting"
    cat $OUTPUT_FILE
fi

echo ""
echo "📈 Monitoring Recommendations:"
echo "  1. Set P95 alerting threshold at 2x baseline"
echo "  2. Set P99 alerting threshold at 3x baseline"
echo "  3. Alert on success rate < 99%"
echo "  4. Review baselines weekly"
echo "  5. Compare after deployments"

# Create monitoring thresholds file
cat << EOF > monitoring-thresholds.json
{
  "generated": "$(date -Iseconds)",
  "based_on": "$OUTPUT_FILE",
  "alert_thresholds": {
EOF

if command -v jq &> /dev/null; then
    cat $OUTPUT_FILE | jq -r '.baselines[] | "    \"\(.endpoint)\": {
      \"p95_warning\": \(.metrics.p95 * 2),
      \"p95_critical\": \(.metrics.p95 * 3),
      \"p99_critical\": \(.metrics.p99 * 3),
      \"success_rate_warning\": 99,
      \"success_rate_critical\": 95
    },"' | sed '$ s/,$//' >> monitoring-thresholds.json
fi

cat << EOF >> monitoring-thresholds.json
  }
}
EOF

echo ""
echo "📝 Monitoring thresholds saved to: monitoring-thresholds.json"