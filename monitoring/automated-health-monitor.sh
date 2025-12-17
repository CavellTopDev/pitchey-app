#!/bin/bash

# Automated Health Check and Recovery System
# Comprehensive monitoring with auto-recovery capabilities

set -euo pipefail

# Configuration
API_URL="${API_URL:-https://pitchey-production.cavelltheleaddev.workers.dev}"
FRONTEND_URL="${FRONTEND_URL:-https://pitchey.pages.dev}"
LOG_DIR="./monitoring/logs"
ALERT_LOG="$LOG_DIR/alerts.log"
HEALTH_LOG="$LOG_DIR/health-check.log"
RECOVERY_LOG="$LOG_DIR/recovery.log"

# Alert thresholds
MAX_RESPONSE_TIME=5000  # 5 seconds
MAX_ERROR_RATE=10       # 10%
MIN_CACHE_HIT_RATE=50   # 50%
ALERT_COOLDOWN=900      # 15 minutes between same alerts
RECOVERY_ATTEMPTS=3     # Max recovery attempts
RECOVERY_DELAY=60      # Seconds between recovery attempts

# Environment setup
mkdir -p "$LOG_DIR"
touch "$ALERT_LOG" "$HEALTH_LOG" "$RECOVERY_LOG"

# Load environment variables for alerting
if [ -f "./monitoring/.env.alerts" ]; then
    source "./monitoring/.env.alerts"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    local message="$1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] $message" | tee -a "$HEALTH_LOG"
}

log_error() {
    local message="$1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $message" | tee -a "$HEALTH_LOG" "$ALERT_LOG"
}

log_warning() {
    local message="$1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [WARNING] $message" | tee -a "$HEALTH_LOG"
}

log_recovery() {
    local message="$1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [RECOVERY] $message" | tee -a "$RECOVERY_LOG" "$HEALTH_LOG"
}

# Alert tracking
declare -A LAST_ALERT_TIME
declare -A RECOVERY_ATTEMPTS_COUNT

# Check if we should send alert (respects cooldown)
should_alert() {
    local alert_key="$1"
    local current_time=$(date +%s)
    local last_alert=${LAST_ALERT_TIME[$alert_key]:-0}
    local time_since_alert=$((current_time - last_alert))
    
    if [ $time_since_alert -gt $ALERT_COOLDOWN ]; then
        LAST_ALERT_TIME[$alert_key]=$current_time
        return 0
    fi
    return 1
}

# Send alert notification
send_alert() {
    local severity="$1"
    local title="$2"
    local message="$3"
    local alert_key="${title// /_}"
    
    if should_alert "$alert_key"; then
        log_error "ALERT [$severity] $title: $message"
        
        # Send webhook alert if configured
        if [ -f "./monitoring/webhook-alert.sh" ]; then
            echo "[$severity] $title: $message" | ./monitoring/webhook-alert.sh
        fi
        
        # Send email if configured
        if [ -n "${ALERT_EMAIL:-}" ]; then
            echo "Subject: [Pitchey] $severity Alert: $title

$message

Time: $(date)
Dashboard: https://monitoring.pitchey.app" | mail "$ALERT_EMAIL"
        fi
    fi
}

# Test HTTP endpoint with detailed metrics
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    local timeout="${4:-10}"
    
    local temp_file="/tmp/health_check_$$"
    local temp_headers="/tmp/health_headers_$$"
    
    # Make request with detailed timing
    local response=$(curl -s -w @- "$url" \
        -o "$temp_file" \
        -D "$temp_headers" \
        --max-time "$timeout" \
        -H "User-Agent: HealthMonitor/1.0" \
        -H "Accept: application/json" \
        --connect-timeout 5 \
        --retry 0 2>/dev/null <<'EOF'
{
    "http_code": %{http_code},
    "time_total": %{time_total},
    "time_connect": %{time_connect},
    "time_starttransfer": %{time_starttransfer},
    "size_download": %{size_download}
}
EOF
    )
    
    # Parse response or set defaults if curl failed
    local http_code
    local time_total
    local time_connect
    local time_starttransfer
    
    if [ $? -eq 0 ] && [ -n "$response" ]; then
        http_code=$(echo "$response" | jq -r '.http_code // 0' 2>/dev/null || echo "0")
        time_total=$(echo "$response" | jq -r '.time_total // 999' 2>/dev/null || echo "999")
        time_connect=$(echo "$response" | jq -r '.time_connect // 999' 2>/dev/null || echo "999")
        time_starttransfer=$(echo "$response" | jq -r '.time_starttransfer // 999' 2>/dev/null || echo "999")
    else
        http_code="0"
        time_total="999"
        time_connect="999"
        time_starttransfer="999"
    fi
    
    # Extract headers
    local cache_status="NONE"
    local cf_cache="NONE"
    local cf_ray="N/A"
    
    if [ -f "$temp_headers" ]; then
        cache_status=$(grep -i "x-cache-status:" "$temp_headers" 2>/dev/null | cut -d: -f2 | tr -d ' \r' || echo "NONE")
        cf_cache=$(grep -i "cf-cache-status:" "$temp_headers" 2>/dev/null | cut -d: -f2 | tr -d ' \r' || echo "NONE")
        cf_ray=$(grep -i "cf-ray:" "$temp_headers" 2>/dev/null | cut -d: -f2 | tr -d ' \r' || echo "N/A")
    fi
    
    # Convert time to milliseconds
    local time_ms=$(awk "BEGIN {printf \"%d\", $time_total * 1000}")
    
    # Determine status
    local status="PASS"
    local status_color="$GREEN"
    
    if [ "$http_code" != "$expected_status" ]; then
        status="FAIL"
        status_color="$RED"
        send_alert "CRITICAL" "$name Service Down" "$name returned HTTP $http_code (expected $expected_status). URL: $url"
        
        # Attempt recovery for critical services
        if [[ "$name" =~ (Worker|API) ]]; then
            attempt_worker_recovery
        fi
    elif [ "$time_ms" -gt "$MAX_RESPONSE_TIME" ]; then
        status="SLOW"
        status_color="$YELLOW"
        send_alert "WARNING" "$name Slow Response" "$name response time is ${time_ms}ms (limit: ${MAX_RESPONSE_TIME}ms). URL: $url"
    fi
    
    # Log results
    log_info "$name: $status (${time_ms}ms, HTTP $http_code, Cache: $cache_status/$cf_cache)"
    
    # Display results
    printf "%-20s %s%-8s%s %6sms  HTTP:%3s  Cache:%-4s  CF-Cache:%-8s\n" \
        "$name" "$status_color" "$status" "$NC" "$time_ms" "$http_code" "$cache_status" "$cf_cache"
    
    # Cleanup
    rm -f "$temp_file" "$temp_headers"
    
    # Return metrics for further processing
    echo "{\"name\":\"$name\",\"status\":\"$status\",\"time_ms\":$time_ms,\"http_code\":$http_code,\"cache_status\":\"$cache_status\",\"cf_cache\":\"$cf_cache\"}"
}

# Attempt automated recovery for Worker issues
attempt_worker_recovery() {
    local recovery_key="worker_recovery"
    local attempts=${RECOVERY_ATTEMPTS_COUNT[$recovery_key]:-0}
    
    if [ $attempts -ge $RECOVERY_ATTEMPTS ]; then
        log_error "Maximum recovery attempts reached for worker ($attempts/$RECOVERY_ATTEMPTS)"
        send_alert "CRITICAL" "Recovery Failed" "Worker recovery failed after $RECOVERY_ATTEMPTS attempts. Manual intervention required."
        return 1
    fi
    
    attempts=$((attempts + 1))
    RECOVERY_ATTEMPTS_COUNT[$recovery_key]=$attempts
    
    log_recovery "Attempting worker recovery (attempt $attempts/$RECOVERY_ATTEMPTS)"
    
    # Recovery strategies
    case $attempts in
        1)
            log_recovery "Strategy 1: Triggering worker restart via health endpoint"
            curl -X POST "$API_URL/api/health/restart" -H "Authorization: Bearer ${HEALTH_CHECK_TOKEN:-}" || true
            ;;
        2)
            log_recovery "Strategy 2: Clearing worker cache"
            curl -X POST "$API_URL/api/cache/clear" -H "Authorization: Bearer ${HEALTH_CHECK_TOKEN:-}" || true
            ;;
        3)
            log_recovery "Strategy 3: Emergency deployment trigger"
            # This would trigger a redeployment (implement based on your CI/CD)
            if [ -n "${DEPLOY_WEBHOOK_URL:-}" ]; then
                curl -X POST "$DEPLOY_WEBHOOK_URL" -H "Content-Type: application/json" -d '{"trigger":"health_check_recovery"}' || true
            fi
            ;;
    esac
    
    # Wait before next check
    sleep $RECOVERY_DELAY
    
    # Test if recovery worked
    local recovery_result
    recovery_result=$(test_endpoint "Recovery Check" "$API_URL/api/health" 200 5)
    
    if echo "$recovery_result" | jq -r '.status' | grep -q "PASS"; then
        log_recovery "Recovery successful on attempt $attempts"
        RECOVERY_ATTEMPTS_COUNT[$recovery_key]=0
        send_alert "INFO" "Recovery Successful" "Worker recovery successful after $attempts attempts"
        return 0
    else
        log_recovery "Recovery attempt $attempts failed"
        return 1
    fi
}

# Test database connectivity
test_database() {
    local result
    result=$(test_endpoint "Database" "$API_URL/api/health/detailed" 200 15)
    
    # Parse detailed health response for database status
    local temp_file="/tmp/db_health_$$"
    curl -s "$API_URL/api/health/detailed" > "$temp_file" 2>/dev/null || echo '{}' > "$temp_file"
    
    local db_status
    db_status=$(jq -r '.database.status // "unknown"' "$temp_file" 2>/dev/null || echo "unknown")
    
    if [ "$db_status" != "connected" ] && [ "$db_status" != "unknown" ]; then
        send_alert "CRITICAL" "Database Connection Error" "Database status: $db_status. Check Neon and Hyperdrive configuration."
    fi
    
    rm -f "$temp_file"
    echo "$result"
}

# Check cache performance
check_cache_performance() {
    local endpoint="$API_URL/api/pitches/browse/enhanced?limit=10"
    
    # Make multiple requests to test cache
    local hits=0
    local total=5
    
    for i in $(seq 1 $total); do
        local temp_headers="/tmp/cache_test_${i}_$$"
        curl -s -I "$endpoint" -D "$temp_headers" >/dev/null 2>&1
        
        if grep -qi "x-cache-status: hit" "$temp_headers" 2>/dev/null || 
           grep -qi "cf-cache-status: hit" "$temp_headers" 2>/dev/null; then
            hits=$((hits + 1))
        fi
        
        rm -f "$temp_headers"
        sleep 1
    done
    
    local hit_rate=$((hits * 100 / total))
    
    if [ $hit_rate -lt $MIN_CACHE_HIT_RATE ]; then
        send_alert "WARNING" "Low Cache Hit Rate" "Cache hit rate is ${hit_rate}% (minimum: ${MIN_CACHE_HIT_RATE}%). Consider reviewing cache configuration."
    fi
    
    log_info "Cache performance: $hits/$total hits (${hit_rate}%)"
    printf "%-20s %s%-8s%s %6s%%\n" "Cache Hit Rate" "$GREEN" "OK" "$NC" "$hit_rate"
}

# Monitor system resources
check_system_resources() {
    # Disk space
    local disk_usage
    disk_usage=$(df / | awk 'NR==2 {print $(NF-1)}' | sed 's/%//')
    
    if [ "$disk_usage" -gt 85 ]; then
        send_alert "WARNING" "High Disk Usage" "Disk usage is ${disk_usage}%. Consider cleanup."
    fi
    
    # Memory (if available)
    if command -v free >/dev/null 2>&1; then
        local mem_usage
        mem_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
        
        if [ "$mem_usage" -gt 90 ]; then
            send_alert "WARNING" "High Memory Usage" "Memory usage is ${mem_usage}%"
        fi
    fi
    
    log_info "System resources: Disk ${disk_usage}% used"
}

# Generate health summary
generate_summary() {
    local results=("$@")
    local total_checks=${#results[@]}
    local passed_checks=0
    local failed_checks=0
    local slow_checks=0
    
    for result in "${results[@]}"; do
        local status
        status=$(echo "$result" | jq -r '.status')
        case "$status" in
            "PASS") passed_checks=$((passed_checks + 1)) ;;
            "FAIL") failed_checks=$((failed_checks + 1)) ;;
            "SLOW") slow_checks=$((slow_checks + 1)) ;;
        esac
    done
    
    local health_percentage=$((passed_checks * 100 / total_checks))
    
    echo ""
    echo "═══════════════════════════════════════"
    printf "Health Summary: %s%d%%%s overall health\n" \
        "$([ $health_percentage -ge 90 ] && echo "$GREEN" || [ $health_percentage -ge 70 ] && echo "$YELLOW" || echo "$RED")" \
        "$health_percentage" "$NC"
    printf "  ✓ Passed: %s%d%s  ⚠ Slow: %s%d%s  ✗ Failed: %s%d%s\n" \
        "$GREEN" "$passed_checks" "$NC" \
        "$YELLOW" "$slow_checks" "$NC" \
        "$RED" "$failed_checks" "$NC"
    echo "═══════════════════════════════════════"
    
    # Alert if overall health is poor
    if [ $health_percentage -lt 50 ]; then
        send_alert "CRITICAL" "System Health Critical" "Overall system health is ${health_percentage}%. $failed_checks services failed, $slow_checks slow."
    elif [ $health_percentage -lt 80 ]; then
        send_alert "WARNING" "System Health Degraded" "Overall system health is ${health_percentage}%. $failed_checks services failed, $slow_checks slow."
    fi
    
    # Log summary
    log_info "Health check complete: ${health_percentage}% (${passed_checks}/${total_checks} passed)"
}

# Main health check function
run_health_check() {
    echo -e "${BLUE}🔍 Comprehensive Health Check - $(date)${NC}"
    echo "═══════════════════════════════════════"
    printf "%-20s %-8s %6s  %7s  %12s\n" "Service" "Status" "Time" "HTTP" "Cache"
    echo "───────────────────────────────────────"
    
    local results=()
    
    # Core service checks
    results+=("$(test_endpoint "Frontend" "$FRONTEND_URL" 200 10)")
    results+=("$(test_endpoint "Worker API" "$API_URL/api/health" 200 10)")
    results+=("$(test_endpoint "Database" "$API_URL/api/health/detailed" 200 15)")
    
    # Feature-specific checks
    results+=("$(test_endpoint "Browse API" "$API_URL/api/pitches/browse/enhanced?limit=5" 200 10)")
    results+=("$(test_endpoint "Auth Check" "$API_URL/api/auth/check" 200 5)")
    results+=("$(test_endpoint "Health Detailed" "$API_URL/api/health/detailed" 200 10)")
    
    echo "───────────────────────────────────────"
    
    # Additional checks
    check_cache_performance
    check_system_resources
    
    # Generate summary
    generate_summary "${results[@]}"
    
    return 0
}

# Continuous monitoring mode
run_continuous_monitoring() {
    local interval="${1:-300}"  # Default 5 minutes
    
    echo -e "${BLUE}🔄 Starting Continuous Health Monitoring${NC}"
    echo "Check interval: ${interval}s"
    echo "Press Ctrl+C to stop"
    echo ""
    
    while true; do
        run_health_check
        echo ""
        echo "Next check in ${interval}s..."
        sleep "$interval"
        clear
    done
}

# Command line interface
case "${1:-single}" in
    "continuous")
        run_continuous_monitoring "${2:-300}"
        ;;
    "single")
        run_health_check
        ;;
    "recovery")
        attempt_worker_recovery
        ;;
    "cache")
        check_cache_performance
        ;;
    "summary")
        generate_summary
        ;;
    *)
        echo "Usage: $0 [single|continuous [interval]|recovery|cache|summary]"
        echo ""
        echo "  single      - Run one health check (default)"
        echo "  continuous  - Run continuous monitoring"
        echo "  recovery    - Attempt worker recovery"
        echo "  cache       - Check cache performance only"
        echo "  summary     - Generate health summary"
        exit 1
        ;;
esac
