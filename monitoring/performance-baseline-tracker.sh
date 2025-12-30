#!/bin/bash

# 48-Hour Performance Baseline Tracker
# Comprehensive performance monitoring with trend analysis and baseline establishment

set -euo pipefail

# Configuration
API_URL="${API_URL:-https://pitchey-api-prod.ndlovucavelle.workers.dev}"
FRONTEND_URL="${FRONTEND_URL:-https://pitchey-5o8.pages.dev}"
LOG_DIR="./monitoring/logs/performance"
DATA_DIR="./monitoring/data"
REPORT_DIR="./monitoring/reports"

# Monitoring settings
INTERVAL="${INTERVAL:-180}"  # 3 minutes between tests
DURATION="${DURATION:-172800}"  # 48 hours in seconds
BASELINE_WINDOW="${BASELINE_WINDOW:-3600}"  # 1 hour window for baseline calculation
ANOMALY_THRESHOLD="${ANOMALY_THRESHOLD:-2}"  # Standard deviations for anomaly detection

# Test configuration
PARALLEL_TESTS="${PARALLEL_TESTS:-3}"  # Number of parallel requests for load testing
TEST_SCENARIOS=(
    "light_load:1"
    "normal_load:5"
    "heavy_load:10"
)

# Create directory structure
mkdir -p "$LOG_DIR" "$DATA_DIR" "$REPORT_DIR"

# File paths
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BASELINE_FILE="$DATA_DIR/baseline_${TIMESTAMP}.json"
METRICS_FILE="$DATA_DIR/metrics_${TIMESTAMP}.jsonl"
ANOMALY_FILE="$DATA_DIR/anomalies_${TIMESTAMP}.jsonl"
TRENDS_FILE="$DATA_DIR/trends_${TIMESTAMP}.json"
REPORT_FILE="$REPORT_DIR/performance_report_${TIMESTAMP}.md"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging
log() {
    local level="$1"
    local message="$2"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$level] $message" | tee -a "$LOG_DIR/baseline_tracker.log"
}

# Initialize baseline tracking
initialize_baseline() {
    log "INFO" "Initializing 48-hour performance baseline tracking"
    log "INFO" "Monitoring: $API_URL"
    log "INFO" "Frontend: $FRONTEND_URL"
    log "INFO" "Test interval: ${INTERVAL}s"
    log "INFO" "Total duration: ${DURATION}s ($(echo "scale=1; $DURATION/3600" | bc)h)"
    log "INFO" "Metrics file: $METRICS_FILE"
    log "INFO" "Baseline file: $BASELINE_FILE"
    
    # Initialize baseline structure
    cat > "$BASELINE_FILE" <<EOF
{
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "duration_hours": $(echo "scale=1; $DURATION/3600" | bc),
  "test_interval_seconds": $INTERVAL,
  "endpoints": {},
  "performance_targets": {
    "response_time_p95": 2000,
    "response_time_p99": 5000,
    "availability": 99.9,
    "cache_hit_rate": 70,
    "error_rate": 1
  },
  "baseline_metrics": {},
  "anomaly_threshold": $ANOMALY_THRESHOLD
}
EOF
    
    # Initialize metrics file
    touch "$METRICS_FILE"
    touch "$ANOMALY_FILE"
}

# Define test endpoints
declare -A ENDPOINTS=(
    ["health"]="/api/health"
    ["health_detailed"]="/api/health/detailed"
    ["browse_basic"]="/api/pitches/browse/enhanced?limit=5"
    ["browse_paginated"]="/api/pitches/browse/enhanced?limit=10&page=1"
    ["browse_sorted"]="/api/pitches/browse/enhanced?limit=10&sort=newest"
    ["pitches_list"]="/api/pitches?limit=10"
    ["auth_check"]="/api/auth/check"
    ["frontend"]="/"
)

# Performance test function with detailed metrics
performance_test() {
    local endpoint_key="$1"
    local endpoint_path="${ENDPOINTS[$endpoint_key]}"
    local load_scenario="${2:-normal_load:1}"
    
    local scenario_name=$(echo "$load_scenario" | cut -d: -f1)
    local concurrent_requests=$(echo "$load_scenario" | cut -d: -f2)
    
    # Determine URL
    local url
    if [ "$endpoint_key" = "frontend" ]; then
        url="$FRONTEND_URL$endpoint_path"
    else
        url="$API_URL$endpoint_path"
    fi
    
    # Collect metrics
    local temp_dir="/tmp/perf_test_$$"
    mkdir -p "$temp_dir"
    
    local results=()
    local pids=()
    
    # Run concurrent requests
    for i in $(seq 1 "$concurrent_requests"); do
        {
            local result_file="$temp_dir/result_$i.json"
            curl -w @- "$url" \
                -o "$temp_dir/response_$i.txt" \
                -s \
                --max-time 30 \
                -H "User-Agent: PerformanceBaseline/1.0" \
                -H "Accept: application/json" \
                --retry 0 <<'EOF' > "$result_file" 2>/dev/null
{
    "request_id": "REQUEST_ID_PLACEHOLDER",
    "http_code": %{http_code},
    "time_total": %{time_total},
    "time_namelookup": %{time_namelookup},
    "time_connect": %{time_connect},
    "time_appconnect": %{time_appconnect},
    "time_pretransfer": %{time_pretransfer},
    "time_redirect": %{time_redirect},
    "time_starttransfer": %{time_starttransfer},
    "size_download": %{size_download},
    "size_upload": %{size_upload},
    "speed_download": %{speed_download},
    "speed_upload": %{speed_upload},
    "num_connects": %{num_connects},
    "num_redirects": %{num_redirects}
}
EOF
            # Replace placeholder with actual request ID
            sed -i "s/REQUEST_ID_PLACEHOLDER/req_${i}_$$/g" "$result_file"
        } &
        pids+=($!)
    done
    
    # Wait for all requests to complete
    for pid in "${pids[@]}"; do
        wait "$pid"
    done
    
    # Aggregate results
    local total_time=0
    local total_connect_time=0
    local total_starttransfer_time=0
    local total_size=0
    local successful_requests=0
    local failed_requests=0
    local response_times=()
    local http_codes=()
    
    for i in $(seq 1 "$concurrent_requests"); do
        local result_file="$temp_dir/result_$i.json"
        if [ -f "$result_file" ]; then
            local http_code=$(jq -r '.http_code // 0' "$result_file")
            local time_total=$(jq -r '.time_total // 999' "$result_file")
            local time_connect=$(jq -r '.time_connect // 999' "$result_file")
            local time_starttransfer=$(jq -r '.time_starttransfer // 999' "$result_file")
            local size_download=$(jq -r '.size_download // 0' "$result_file")
            
            if [ "$http_code" = "200" ] || [ "$http_code" = "201" ] || [ "$http_code" = "202" ]; then
                successful_requests=$((successful_requests + 1))
                total_time=$(echo "$total_time + $time_total" | bc)
                total_connect_time=$(echo "$total_connect_time + $time_connect" | bc)
                total_starttransfer_time=$(echo "$total_starttransfer_time + $time_starttransfer" | bc)
                total_size=$((total_size + $(echo "$size_download" | cut -d. -f1)))
                response_times+=("$time_total")
            else
                failed_requests=$((failed_requests + 1))
            fi
            
            http_codes+=("$http_code")
        else
            failed_requests=$((failed_requests + 1))
        fi
    done
    
    # Calculate percentiles
    local p50=0 p95=0 p99=0
    if [ ${#response_times[@]} -gt 0 ]; then
        IFS=$'\n' sorted_times=($(sort -n <(printf '%s\n' "${response_times[@]}")))
        local count=${#sorted_times[@]}
        
        if [ $count -gt 0 ]; then
            local p50_index=$(echo "$count * 0.5" | bc | cut -d. -f1)
            local p95_index=$(echo "$count * 0.95" | bc | cut -d. -f1)
            local p99_index=$(echo "$count * 0.99" | bc | cut -d. -f1)
            
            p50=${sorted_times[$((p50_index > 0 ? p50_index - 1 : 0))]}
            p95=${sorted_times[$((p95_index > 0 ? p95_index - 1 : 0))]}
            p99=${sorted_times[$((p99_index > 0 ? p99_index - 1 : 0))]}
        fi
    fi
    
    # Calculate averages
    local avg_time=0 avg_connect=0 avg_starttransfer=0
    if [ $successful_requests -gt 0 ]; then
        avg_time=$(echo "scale=3; $total_time / $successful_requests" | bc)
        avg_connect=$(echo "scale=3; $total_connect_time / $successful_requests" | bc)
        avg_starttransfer=$(echo "scale=3; $total_starttransfer_time / $successful_requests" | bc)
    fi
    
    # Calculate success rate
    local success_rate=0
    if [ $concurrent_requests -gt 0 ]; then
        success_rate=$(echo "scale=2; $successful_requests * 100 / $concurrent_requests" | bc)
    fi
    
    # Extract cache information from first successful response
    local cache_status="NONE"
    local cf_cache="NONE"
    for i in $(seq 1 "$concurrent_requests"); do
        if [ -f "$temp_dir/response_$i.txt" ]; then
            # Try to extract cache headers from response (if it's a HEAD request or has headers)
            cache_status="ANALYZED"
            break
        fi
    done
    
    # Clean up
    rm -rf "$temp_dir"
    
    # Create result object
    local result_json
    result_json=$(cat <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "endpoint_key": "$endpoint_key",
  "endpoint_path": "$endpoint_path",
  "url": "$url",
  "scenario": "$scenario_name",
  "concurrent_requests": $concurrent_requests,
  "successful_requests": $successful_requests,
  "failed_requests": $failed_requests,
  "success_rate_percent": $success_rate,
  "response_times": {
    "average_seconds": $avg_time,
    "p50_seconds": $p50,
    "p95_seconds": $p95,
    "p99_seconds": $p99
  },
  "connection_times": {
    "average_connect_seconds": $avg_connect,
    "average_starttransfer_seconds": $avg_starttransfer
  },
  "throughput": {
    "total_bytes": $total_size,
    "average_bytes_per_request": $([ $successful_requests -gt 0 ] && echo "scale=0; $total_size / $successful_requests" | bc || echo "0")
  },
  "cache_status": "$cache_status",
  "http_codes": [$(IFS=,; echo "${http_codes[*]}")]
}
EOF
    )
    
    echo "$result_json"
}

# Analyze performance metrics for anomalies
analyze_anomalies() {
    local endpoint_key="$1"
    local current_metrics="$2"
    
    # Get historical data for this endpoint
    local historical_data
    historical_data=$(grep "\"endpoint_key\": \"$endpoint_key\"" "$METRICS_FILE" | tail -20)
    
    if [ -z "$historical_data" ]; then
        log "INFO" "No historical data for $endpoint_key, skipping anomaly detection"
        return 0
    fi
    
    # Extract response times
    local response_times=()
    while IFS= read -r line; do
        if [ -n "$line" ]; then
            local avg_time
            avg_time=$(echo "$line" | jq -r '.response_times.average_seconds // 0')
            response_times+=("$avg_time")
        fi
    done <<< "$historical_data"
    
    if [ ${#response_times[@]} -lt 5 ]; then
        return 0  # Need at least 5 data points
    fi
    
    # Calculate mean and standard deviation
    local sum=0 count=${#response_times[@]}
    for time in "${response_times[@]}"; do
        sum=$(echo "$sum + $time" | bc)
    done
    local mean=$(echo "scale=6; $sum / $count" | bc)
    
    local variance_sum=0
    for time in "${response_times[@]}"; do
        local diff=$(echo "$time - $mean" | bc)
        local squared=$(echo "$diff * $diff" | bc)
        variance_sum=$(echo "$variance_sum + $squared" | bc)
    done
    local variance=$(echo "scale=6; $variance_sum / $count" | bc)
    local std_dev=$(echo "scale=6; sqrt($variance)" | bc)
    
    # Check current metric against threshold
    local current_avg
    current_avg=$(echo "$current_metrics" | jq -r '.response_times.average_seconds')
    local deviation=$(echo "$current_avg - $mean" | bc)
    local abs_deviation=$(echo "$deviation" | sed 's/-//')
    local threshold=$(echo "$std_dev * $ANOMALY_THRESHOLD" | bc)
    
    if (( $(echo "$abs_deviation > $threshold" | bc -l) )); then
        local anomaly_json
        anomaly_json=$(cat <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "endpoint_key": "$endpoint_key",
  "anomaly_type": "response_time",
  "current_value": $current_avg,
  "baseline_mean": $mean,
  "baseline_std_dev": $std_dev,
  "deviation": $deviation,
  "threshold": $threshold,
  "severity": "$([ $(echo "$abs_deviation > ($std_dev * 3)" | bc -l) -eq 1 ] && echo "high" || echo "medium")",
  "description": "Response time anomaly detected for $endpoint_key"
}
EOF
        )
        
        echo "$anomaly_json" >> "$ANOMALY_FILE"
        log "WARNING" "Anomaly detected for $endpoint_key: ${current_avg}s (baseline: ${mean}s ±${std_dev}s)"
    fi
}

# Update baseline calculations
update_baseline() {
    log "INFO" "Updating baseline calculations"
    
    # Calculate baseline metrics for each endpoint
    local baseline_data="{}"
    
    for endpoint_key in "${!ENDPOINTS[@]}"; do
        log "INFO" "Calculating baseline for $endpoint_key"
        
        # Get recent data for this endpoint
        local recent_data
        recent_data=$(grep "\"endpoint_key\": \"$endpoint_key\"" "$METRICS_FILE" | tail -50)
        
        if [ -z "$recent_data" ]; then
            continue
        fi
        
        # Calculate statistics
        local response_times=()
        local success_rates=()
        local total_requests=0
        local total_successful=0
        
        while IFS= read -r line; do
            if [ -n "$line" ]; then
                local avg_time success_rate successful_requests concurrent_requests
                avg_time=$(echo "$line" | jq -r '.response_times.average_seconds // 0')
                success_rate=$(echo "$line" | jq -r '.success_rate_percent // 0')
                successful_requests=$(echo "$line" | jq -r '.successful_requests // 0')
                concurrent_requests=$(echo "$line" | jq -r '.concurrent_requests // 1')
                
                response_times+=("$avg_time")
                success_rates+=("$success_rate")
                total_requests=$((total_requests + concurrent_requests))
                total_successful=$((total_successful + successful_requests))
            fi
        done <<< "$recent_data"
        
        if [ ${#response_times[@]} -eq 0 ]; then
            continue
        fi
        
        # Calculate percentiles for response times
        IFS=$'\n' sorted_times=($(sort -n <(printf '%s\n' "${response_times[@]}")))
        local count=${#sorted_times[@]}
        
        local p50 p95 p99 mean_response_time overall_success_rate
        
        if [ $count -gt 0 ]; then
            local p50_index=$(echo "$count * 0.5" | bc | cut -d. -f1)
            local p95_index=$(echo "$count * 0.95" | bc | cut -d. -f1)
            local p99_index=$(echo "$count * 0.99" | bc | cut -d. -f1)
            
            p50=${sorted_times[$((p50_index > 0 ? p50_index - 1 : 0))]}
            p95=${sorted_times[$((p95_index > 0 ? p95_index - 1 : 0))]}
            p99=${sorted_times[$((p99_index > 0 ? p99_index - 1 : 0))]}
            
            # Calculate mean
            local sum=0
            for time in "${response_times[@]}"; do
                sum=$(echo "$sum + $time" | bc)
            done
            mean_response_time=$(echo "scale=6; $sum / $count" | bc)
            
            # Calculate overall success rate
            overall_success_rate=$(echo "scale=2; $total_successful * 100 / $total_requests" | bc)
        else
            p50=0 p95=0 p99=0 mean_response_time=0 overall_success_rate=0
        fi
        
        # Add to baseline data
        local endpoint_baseline
        endpoint_baseline=$(cat <<EOF
"$endpoint_key": {
  "sample_count": $count,
  "response_time_seconds": {
    "mean": $mean_response_time,
    "p50": $p50,
    "p95": $p95,
    "p99": $p99
  },
  "availability_percent": $overall_success_rate,
  "total_requests": $total_requests,
  "total_successful": $total_successful,
  "last_updated": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
        )
        
        if [ "$baseline_data" = "{}" ]; then
            baseline_data="{$endpoint_baseline}"
        else
            baseline_data="${baseline_data%}}, $endpoint_baseline}"
        fi
    done
    
    # Update baseline file
    local updated_baseline
    updated_baseline=$(jq ".baseline_metrics = $baseline_data | .last_updated = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" "$BASELINE_FILE")
    echo "$updated_baseline" > "$BASELINE_FILE"
    
    log "INFO" "Baseline updated with data from ${#ENDPOINTS[@]} endpoints"
}

# Generate progress report
generate_progress_report() {
    local elapsed_time="$1"
    local total_tests="$2"
    
    local progress_percent=$(echo "scale=1; $elapsed_time * 100 / $DURATION" | bc)
    local remaining_time=$((DURATION - elapsed_time))
    local eta=$(date -d "+${remaining_time} seconds" '+%H:%M:%S')
    
    clear
    echo -e "${BLUE}📊 Performance Baseline Tracking - Progress Report${NC}"
    echo "═══════════════════════════════════════════════════════════════"
    printf "Progress: %s%.1f%%%s (%s tests completed)\n" "$GREEN" "$progress_percent" "$NC" "$total_tests"
    printf "Elapsed: %s  Remaining: %s  ETA: %s\n" \
        "$(date -u -d @$elapsed_time +'%H:%M:%S')" \
        "$(date -u -d @$remaining_time +'%H:%M:%S')" \
        "$eta"
    echo "═══════════════════════════════════════════════════════════════"
    
    # Show recent test results
    echo ""
    echo "Recent Test Results:"
    echo "───────────────────────────────────────────────────────────────"
    
    if [ -f "$METRICS_FILE" ]; then
        tail -n 5 "$METRICS_FILE" | while IFS= read -r line; do
            if [ -n "$line" ]; then
                local endpoint_key timestamp avg_time success_rate
                endpoint_key=$(echo "$line" | jq -r '.endpoint_key')
                timestamp=$(echo "$line" | jq -r '.timestamp' | cut -d'T' -f2 | cut -d'.' -f1)
                avg_time=$(echo "$line" | jq -r '.response_times.average_seconds')
                success_rate=$(echo "$line" | jq -r '.success_rate_percent')
                
                printf "%-15s %s  %6.3fs  %5.1f%%\n" "$endpoint_key" "$timestamp" "$avg_time" "$success_rate"
            fi
        done
    fi
    
    echo ""
    echo "Anomalies Detected:"
    echo "───────────────────────────────────────────────────────────────"
    
    if [ -f "$ANOMALY_FILE" ] && [ -s "$ANOMALY_FILE" ]; then
        local anomaly_count
        anomaly_count=$(wc -l < "$ANOMALY_FILE")
        printf "Total anomalies: %s%d%s\n" "$RED" "$anomaly_count" "$NC"
        
        # Show recent anomalies
        tail -n 3 "$ANOMALY_FILE" | while IFS= read -r line; do
            if [ -n "$line" ]; then
                local endpoint_key severity description
                endpoint_key=$(echo "$line" | jq -r '.endpoint_key')
                severity=$(echo "$line" | jq -r '.severity')
                description=$(echo "$line" | jq -r '.description')
                
                local severity_color="$YELLOW"
                [ "$severity" = "high" ] && severity_color="$RED"
                
                printf "  %s[%s]%s %s - %s\n" "$severity_color" "$severity" "$NC" "$endpoint_key" "$description"
            fi
        done
    else
        echo "No anomalies detected"
    fi
    
    echo ""
    echo "Next test in ${INTERVAL}s..."
}

# Main monitoring loop
run_baseline_tracking() {
    local start_time=$(date +%s)
    local end_time=$((start_time + DURATION))
    local test_count=0
    
    log "INFO" "Starting 48-hour baseline tracking"
    
    while [ $(date +%s) -lt $end_time ]; do
        local current_time=$(date +%s)
        local elapsed_time=$((current_time - start_time))
        
        # Run tests for all endpoints and scenarios
        for endpoint_key in "${!ENDPOINTS[@]}"; do
            for scenario in "${TEST_SCENARIOS[@]}"; do
                log "INFO" "Testing $endpoint_key with $scenario"
                
                local result
                result=$(performance_test "$endpoint_key" "$scenario")
                
                # Save metrics
                echo "$result" >> "$METRICS_FILE"
                
                # Analyze for anomalies
                analyze_anomalies "$endpoint_key" "$result"
                
                test_count=$((test_count + 1))
                
                # Brief pause between tests to avoid overwhelming
                sleep 5
            done
        done
        
        # Update baseline every hour
        if [ $((elapsed_time % 3600)) -lt $INTERVAL ]; then
            update_baseline
        fi
        
        # Generate progress report
        generate_progress_report "$elapsed_time" "$test_count"
        
        # Wait for next interval
        sleep "$INTERVAL"
    done
    
    log "INFO" "Baseline tracking completed after ${DURATION}s"
    log "INFO" "Total tests conducted: $test_count"
    
    # Generate final report
    generate_final_report "$test_count"
}

# Generate comprehensive final report
generate_final_report() {
    local total_tests="$1"
    
    log "INFO" "Generating comprehensive performance report"
    
    cat > "$REPORT_FILE" <<EOF
# 48-Hour Performance Baseline Report

**Generated**: $(date)  
**Duration**: 48 hours  
**Total Tests**: $total_tests  
**Test Interval**: ${INTERVAL}s  

## Executive Summary

This report contains performance baseline data collected over 48 hours for the Pitchey production environment.

### Key Metrics Summary

EOF
    
    # Add endpoint summaries
    for endpoint_key in "${!ENDPOINTS[@]}"; do
        if [ -f "$BASELINE_FILE" ]; then
            local endpoint_data
            endpoint_data=$(jq -r ".baseline_metrics[\"$endpoint_key\"]" "$BASELINE_FILE" 2>/dev/null)
            
            if [ "$endpoint_data" != "null" ] && [ "$endpoint_data" != "" ]; then
                local mean_time p95_time p99_time availability
                mean_time=$(echo "$endpoint_data" | jq -r '.response_time_seconds.mean')
                p95_time=$(echo "$endpoint_data" | jq -r '.response_time_seconds.p95')
                p99_time=$(echo "$endpoint_data" | jq -r '.response_time_seconds.p99')
                availability=$(echo "$endpoint_data" | jq -r '.availability_percent')
                
                cat >> "$REPORT_FILE" <<EOF

#### ${endpoint_key^} Endpoint
- **Average Response Time**: ${mean_time}s
- **95th Percentile**: ${p95_time}s  
- **99th Percentile**: ${p99_time}s
- **Availability**: ${availability}%

EOF
            fi
        fi
    done
    
    # Add anomaly analysis
    cat >> "$REPORT_FILE" <<EOF

## Anomaly Analysis

EOF
    
    if [ -f "$ANOMALY_FILE" ] && [ -s "$ANOMALY_FILE" ]; then
        local total_anomalies
        total_anomalies=$(wc -l < "$ANOMALY_FILE")
        
        cat >> "$REPORT_FILE" <<EOF
**Total Anomalies Detected**: $total_anomalies

### Anomaly Summary by Endpoint

EOF
        
        # Group anomalies by endpoint
        for endpoint_key in "${!ENDPOINTS[@]}"; do
            local endpoint_anomalies
            endpoint_anomalies=$(grep "\"endpoint_key\": \"$endpoint_key\"" "$ANOMALY_FILE" | wc -l)
            
            if [ "$endpoint_anomalies" -gt 0 ]; then
                echo "- **$endpoint_key**: $endpoint_anomalies anomalies" >> "$REPORT_FILE"
            fi
        done
    else
        echo "No anomalies detected during the monitoring period." >> "$REPORT_FILE"
    fi
    
    # Add recommendations
    cat >> "$REPORT_FILE" <<EOF

## Performance Recommendations

Based on the 48-hour baseline data:

### Response Time Optimization
1. **Database Query Optimization**: Review slow database queries identified during monitoring
2. **Cache Strategy**: Improve cache hit rates for frequently accessed endpoints
3. **Connection Pooling**: Optimize Hyperdrive connection pool settings

### Availability Improvements
1. **Error Handling**: Improve error recovery for endpoints with availability < 99.5%
2. **Circuit Breakers**: Implement circuit breakers for external dependencies
3. **Graceful Degradation**: Add fallback mechanisms for critical features

### Monitoring Enhancements
1. **Alert Thresholds**: Set alert thresholds based on baseline + 2σ
2. **Proactive Monitoring**: Monitor trends to predict performance degradation
3. **Capacity Planning**: Use baseline data for capacity planning decisions

## Data Files

- **Baseline Data**: \`$BASELINE_FILE\`
- **Raw Metrics**: \`$METRICS_FILE\`
- **Anomaly Log**: \`$ANOMALY_FILE\`

## Next Steps

1. Review baseline data with team
2. Update monitoring thresholds based on findings
3. Implement recommended optimizations
4. Schedule regular baseline reviews

EOF
    
    log "INFO" "Final report generated: $REPORT_FILE"
    
    # Print summary to console
    echo ""
    echo -e "${GREEN}✅ 48-Hour Performance Baseline Tracking Complete${NC}"
    echo "═══════════════════════════════════════════════════════════════"
    echo "Total Tests Conducted: $total_tests"
    echo "Data Files Generated:"
    echo "  📊 Baseline: $BASELINE_FILE"
    echo "  📈 Metrics: $METRICS_FILE"
    echo "  🚨 Anomalies: $ANOMALY_FILE"
    echo "  📝 Report: $REPORT_FILE"
    echo ""
    echo "Use the generated baseline data to:"
    echo "  • Set appropriate alert thresholds"
    echo "  • Monitor performance trends"
    echo "  • Plan capacity requirements"
    echo "  • Identify optimization opportunities"
}

# Command line interface
case "${1:-start}" in
    "start")
        initialize_baseline
        run_baseline_tracking
        ;;
    "test")
        # Single test run
        endpoint_key="${2:-health}"
        scenario="${3:-normal_load:1}"
        echo "Testing $endpoint_key with scenario $scenario"
        result=$(performance_test "$endpoint_key" "$scenario")
        echo "$result" | jq .
        ;;
    "report")
        # Generate report from existing data
        if [ -f "$METRICS_FILE" ]; then
            generate_final_report "$(wc -l < "$METRICS_FILE")"
        else
            echo "No metrics file found. Run baseline tracking first."
        fi
        ;;
    "status")
        # Show current status
        if [ -f "$BASELINE_FILE" ]; then
            echo "Baseline tracking status:"
            jq -r '.created_at, .last_updated' "$BASELINE_FILE"
            echo "Metrics collected: $([ -f "$METRICS_FILE" ] && wc -l < "$METRICS_FILE" || echo 0)"
            echo "Anomalies detected: $([ -f "$ANOMALY_FILE" ] && wc -l < "$ANOMALY_FILE" || echo 0)"
        else
            echo "No baseline tracking in progress."
        fi
        ;;
    *)
        echo "Usage: $0 [start|test [endpoint] [scenario]|report|status]"
        echo ""
        echo "  start               - Begin 48-hour baseline tracking"
        echo "  test [endpoint]     - Run single performance test"
        echo "  report              - Generate report from existing data"
        echo "  status              - Show tracking status"
        echo ""
        echo "Available endpoints: ${!ENDPOINTS[*]}"
        echo "Available scenarios: ${TEST_SCENARIOS[*]}"
        exit 1
        ;;
esac
