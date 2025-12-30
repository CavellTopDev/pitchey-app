#!/bin/bash

# Performance Baseline Measurement Script
# Captures comprehensive performance metrics for Pitchey Worker

API_URL="${API_URL:-https://pitchey-api-prod.ndlovucavelle.workers.dev}"
BASELINE_DIR="./baseline-data"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$BASELINE_DIR/baseline_${TIMESTAMP}.json"
LOG_FILE="$BASELINE_DIR/baseline_${TIMESTAMP}.log"

# Create baseline directory
mkdir -p "$BASELINE_DIR"

echo "📊 Performance Baseline Measurement Tool"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "API URL: $API_URL"
echo "Output: $REPORT_FILE"
echo ""

# Test endpoints with different cache scenarios
ENDPOINTS=(
    "/api/health"
    "/api/health/detailed"
    "/api/pitches/browse/enhanced?limit=5"
    "/api/pitches/browse/enhanced?limit=10&sort=newest"
    "/api/pitches/browse/enhanced?limit=5&genre=Action"
    "/api/pitches?limit=10"
    "/api/pitches?limit=10&offset=10"
    "/api/auth/check"
)

# Initialize results JSON
echo '{' > "$REPORT_FILE"
echo '  "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",' >> "$REPORT_FILE"
echo '  "api_url": "'$API_URL'",' >> "$REPORT_FILE"
echo '  "endpoints": [' >> "$REPORT_FILE"

# Function to test endpoint
test_endpoint() {
    local endpoint=$1
    local iteration=$2
    local test_name=$3
    
    echo "Testing: $endpoint (iteration $iteration)" | tee -a "$LOG_FILE"
    
    # Make request with full timing details
    local response=$(curl -s -o /tmp/response_body.txt -w @- "$API_URL$endpoint" \
        -H "Accept: application/json" \
        -H "User-Agent: PerformanceBaseline/1.0" \
        -D /tmp/response_headers.txt <<'EOF'
{
    "time_namelookup": %{time_namelookup},
    "time_connect": %{time_connect},
    "time_appconnect": %{time_appconnect},
    "time_pretransfer": %{time_pretransfer},
    "time_redirect": %{time_redirect},
    "time_starttransfer": %{time_starttransfer},
    "time_total": %{time_total},
    "http_code": %{http_code},
    "size_download": %{size_download},
    "size_header": %{size_header},
    "speed_download": %{speed_download}
}
EOF
    )
    
    # Extract cache headers
    local cache_status=$(grep -i "x-cache-status:" /tmp/response_headers.txt | cut -d: -f2 | tr -d ' \r' || echo "NONE")
    local x_response_time=$(grep -i "x-response-time:" /tmp/response_headers.txt | cut -d: -f2 | tr -d ' \r' || echo "N/A")
    local cf_cache_status=$(grep -i "cf-cache-status:" /tmp/response_headers.txt | cut -d: -f2 | tr -d ' \r' || echo "NONE")
    local cache_control=$(grep -i "cache-control:" /tmp/response_headers.txt | cut -d: -f2- | tr -d '\r' || echo "none")
    local cf_ray=$(grep -i "cf-ray:" /tmp/response_headers.txt | cut -d: -f2 | tr -d ' \r' || echo "N/A")
    
    # Parse response times
    local time_total=$(echo "$response" | jq -r '.time_total')
    local time_starttransfer=$(echo "$response" | jq -r '.time_starttransfer')
    local http_code=$(echo "$response" | jq -r '.http_code')
    local size_download=$(echo "$response" | jq -r '.size_download')
    
    # Calculate additional metrics
    local server_time=$(echo "scale=3; $time_starttransfer - $time_pretransfer" | bc 2>/dev/null || echo "0")
    local transfer_time=$(echo "scale=3; $time_total - $time_starttransfer" | bc 2>/dev/null || echo "0")
    
    # Output JSON result
    if [ "$iteration" -gt 1 ] || [ "$endpoint" != "${ENDPOINTS[0]}" ]; then
        echo "," >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" <<EOF
    {
      "endpoint": "$endpoint",
      "test_name": "$test_name",
      "iteration": $iteration,
      "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
      "http_code": $http_code,
      "timings": $response,
      "cache": {
        "x_cache_status": "$cache_status",
        "cf_cache_status": "$cf_cache_status",
        "cache_control": "$cache_control",
        "x_response_time": "$x_response_time"
      },
      "cf_ray": "$cf_ray",
      "metrics": {
        "server_processing_time": $server_time,
        "transfer_time": $transfer_time,
        "bytes_downloaded": $size_download
      }
    }
EOF
    
    # Log summary
    echo "  HTTP: $http_code | Total: ${time_total}s | Cache: $cache_status | CF-Cache: $cf_cache_status" | tee -a "$LOG_FILE"
}

# Warm-up phase
echo "🔥 Warming up cache..." | tee -a "$LOG_FILE"
for endpoint in "${ENDPOINTS[@]}"; do
    curl -s "$API_URL$endpoint" -o /dev/null
    sleep 0.5
done

echo "" | tee -a "$LOG_FILE"
echo "📊 Running baseline tests..." | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"

# Run tests - 3 iterations for each endpoint
for iteration in 1 2 3; do
    echo "" | tee -a "$LOG_FILE"
    echo "🔄 Iteration $iteration" | tee -a "$LOG_FILE"
    echo "───────────────────" | tee -a "$LOG_FILE"
    
    for endpoint in "${ENDPOINTS[@]}"; do
        if [ $iteration -eq 1 ]; then
            test_name="cold"
        elif [ $iteration -eq 2 ]; then
            test_name="warm"
        else
            test_name="hot"
        fi
        
        test_endpoint "$endpoint" "$iteration" "$test_name"
        sleep 1
    done
done

# Close JSON
echo '' >> "$REPORT_FILE"
echo '  ],' >> "$REPORT_FILE"

# Calculate summary statistics
echo '  "summary": {' >> "$REPORT_FILE"

# Parse all response times
total_time=0
cache_hits=0
total_requests=0

for endpoint in "${ENDPOINTS[@]}"; do
    for iteration in 1 2 3; do
        total_requests=$((total_requests + 1))
    done
done

# Add summary
cat >> "$REPORT_FILE" <<EOF
    "total_requests": $total_requests,
    "test_duration_seconds": $(date +%s),
    "endpoints_tested": ${#ENDPOINTS[@]}
  }
}
EOF

echo "" | tee -a "$LOG_FILE"
echo "✅ Baseline complete!" | tee -a "$LOG_FILE"
echo "📁 Report saved to: $REPORT_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Quick analysis
echo "📊 Quick Analysis:" | tee -a "$LOG_FILE"
echo "───────────────────" | tee -a "$LOG_FILE"

# Count cache hits
cache_hit_count=$(grep -c '"HIT"' "$REPORT_FILE" || echo 0)
cache_miss_count=$(grep -c '"MISS"' "$REPORT_FILE" || echo 0)
total_cache_checks=$((cache_hit_count + cache_miss_count))

if [ $total_cache_checks -gt 0 ]; then
    cache_hit_rate=$(echo "scale=1; $cache_hit_count * 100 / $total_cache_checks" | bc)
    echo "Cache Hit Rate: ${cache_hit_rate}%" | tee -a "$LOG_FILE"
else
    echo "Cache Hit Rate: No cache headers found!" | tee -a "$LOG_FILE"
fi

# Average response times
avg_time=$(jq -r '.endpoints[].timings.time_total' "$REPORT_FILE" | awk '{sum+=$1; count++} END {if(count>0) printf "%.3f", sum/count; else print "0"}')
echo "Average Response Time: ${avg_time}s" | tee -a "$LOG_FILE"

# Check for CF cache
cf_cache_count=$(grep -c '"cf_cache_status": "HIT"' "$REPORT_FILE" || echo 0)
echo "Cloudflare Cache Hits: $cf_cache_count" | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "Run './analyze-baseline.sh $REPORT_FILE' for detailed analysis" | tee -a "$LOG_FILE"