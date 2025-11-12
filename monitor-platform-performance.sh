#!/bin/bash

# Platform Performance Monitoring Script
# Monitors API response times, WebSocket latency, database query performance,
# memory usage, generates performance reports, and alerts on degradation
# Supports both local and production monitoring with configurable thresholds

set -e

# Configuration
BASE_URL="${API_URL:-http://localhost:8001}"
MONITORING_INTERVAL="${MONITOR_INTERVAL:-60}" # seconds
ALERT_THRESHOLD_MS="${ALERT_THRESHOLD:-2000}" # milliseconds
MEMORY_THRESHOLD_MB="${MEMORY_THRESHOLD:-512}" # MB
CPU_THRESHOLD="${CPU_THRESHOLD:-80}" # percentage
REPORT_DIR="./monitoring/reports"
LOG_DIR="./monitoring/logs"
ALERT_LOG="$LOG_DIR/alerts.log"
PERFORMANCE_LOG="$LOG_DIR/performance.log"
METRICS_JSON="$REPORT_DIR/current-metrics.json"
TRENDS_JSON="$REPORT_DIR/performance-trends.json"

# Demo credentials for monitoring
CREATOR_EMAIL="alex.creator@demo.com"
CREATOR_PASSWORD="Demo123"
INVESTOR_EMAIL="sarah.investor@demo.com"
INVESTOR_PASSWORD="Demo123"
PRODUCTION_EMAIL="stellar.production@demo.com"
PRODUCTION_PASSWORD="Demo123"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Monitoring state
MONITORING_ACTIVE=false
MONITORING_PID=""
ALERT_COUNT=0
LAST_ALERT_TIME=0

# Create directories
mkdir -p "$REPORT_DIR" "$LOG_DIR"

# Initialize logs
echo "=== Platform Performance Monitoring ===" > "$PERFORMANCE_LOG"
echo "Started: $(date)" >> "$PERFORMANCE_LOG"
echo "Base URL: $BASE_URL" >> "$PERFORMANCE_LOG"
echo "[]" > "$TRENDS_JSON"
echo "{}" > "$METRICS_JSON"

# Utility functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "[$(date)] INFO: $1" >> "$PERFORMANCE_LOG"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
    echo "[$(date)] OK: $1" >> "$PERFORMANCE_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    echo "[$(date)] WARN: $1" >> "$PERFORMANCE_LOG"
    echo "[$(date)] WARNING: $1" >> "$ALERT_LOG"
}

log_alert() {
    echo -e "${RED}[ALERT]${NC} $1"
    echo "[$(date)] ALERT: $1" >> "$PERFORMANCE_LOG"
    echo "[$(date)] ALERT: $1" >> "$ALERT_LOG"
    send_alert "$1"
}

log_metric() {
    echo -e "${PURPLE}[METRIC]${NC} $1"
    echo "[$(date)] METRIC: $1" >> "$PERFORMANCE_LOG"
}

# Alert system
send_alert() {
    local message="$1"
    local current_time=$(date +%s)
    
    # Rate limit alerts (minimum 5 minutes between alerts)
    if [[ $((current_time - LAST_ALERT_TIME)) -lt 300 ]]; then
        return 0
    fi
    
    LAST_ALERT_TIME=$current_time
    ((ALERT_COUNT++))
    
    # Log alert
    echo "[ALERT-$ALERT_COUNT] $(date): $message" >> "$ALERT_LOG"
    
    # If webhook URL is configured, send alert
    if [[ -n "${WEBHOOK_URL:-}" ]]; then
        local alert_payload="{\"text\": \"🚨 Pitchey Alert: $message\", \"timestamp\": \"$(date -Iseconds)\"}"
        curl -s -X POST -H "Content-Type: application/json" \
             -d "$alert_payload" "$WEBHOOK_URL" >/dev/null 2>&1 || true
    fi
    
    # If email is configured, send email alert  
    if [[ -n "${ALERT_EMAIL:-}" ]]; then
        echo "Alert: $message" | mail -s "Pitchey Performance Alert" "$ALERT_EMAIL" 2>/dev/null || true
    fi
}

# Authentication helper
get_auth_token() {
    local email="$1"
    local password="$2"
    local user_type="$3"
    
    local auth_data="{\"email\": \"$email\", \"password\": \"$password\"}"
    local response
    
    if response=$(curl --silent --max-time 10 \
                      -X POST \
                      -H "Content-Type: application/json" \
                      -d "$auth_data" \
                      "$BASE_URL/api/auth/$user_type/login" 2>/dev/null); then
        if echo "$response" | jq -e '.success and .data.token' >/dev/null 2>&1; then
            echo "$response" | jq -r '.data.token'
            return 0
        fi
    fi
    return 1
}

# Performance measurement functions
measure_api_response_time() {
    local endpoint="$1"
    local token="$2"
    local method="${3:-GET}"
    
    local start_time=$(date +%s%3N)
    local headers=("-H" "Content-Type: application/json")
    
    if [[ -n "$token" ]]; then
        headers+=("-H" "Authorization: Bearer $token")
    fi
    
    local response
    local http_code
    if response=$(curl --silent --write-out "%{http_code}" --max-time 30 \
                      "${headers[@]}" \
                      -X "$method" \
                      "$BASE_URL$endpoint" 2>/dev/null); then
        local end_time=$(date +%s%3N)
        local duration=$((end_time - start_time))
        http_code="${response: -3}"
        
        echo "$duration"
        return 0
    else
        return 1
    fi
}

# WebSocket latency measurement
measure_websocket_latency() {
    local ws_url="${BASE_URL/http/ws}/ws"
    
    # Simple WebSocket connectivity test
    local start_time=$(date +%s%3N)
    if curl -s -I "$BASE_URL/ws" --max-time 5 >/dev/null 2>&1; then
        local end_time=$(date +%s%3N)
        local duration=$((end_time - start_time))
        echo "$duration"
        return 0
    else
        return 1
    fi
}

# System resource monitoring
get_system_metrics() {
    local metrics="{}"
    
    # Memory usage
    if command -v free >/dev/null 2>&1; then
        local memory_info
        memory_info=$(free -m | awk 'NR==2{printf "%.1f", $3}')
        metrics=$(echo "$metrics" | jq --arg mem "$memory_info" '. + {memory_used_mb: $mem}')
    fi
    
    # CPU usage
    if command -v top >/dev/null 2>&1; then
        local cpu_usage
        cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 2>/dev/null || echo "0")
        metrics=$(echo "$metrics" | jq --arg cpu "$cpu_usage" '. + {cpu_usage_percent: $cpu}')
    fi
    
    # Disk usage
    if command -v df >/dev/null 2>&1; then
        local disk_usage
        disk_usage=$(df / | awk 'NR==2 {print $5}' | cut -d'%' -f1 2>/dev/null || echo "0")
        metrics=$(echo "$metrics" | jq --arg disk "$disk_usage" '. + {disk_usage_percent: $disk}')
    fi
    
    # Load average
    if command -v uptime >/dev/null 2>&1; then
        local load_avg
        load_avg=$(uptime | awk -F'load average:' '{print $2}' | cut -d, -f1 | xargs 2>/dev/null || echo "0")
        metrics=$(echo "$metrics" | jq --arg load "$load_avg" '. + {load_average: $load}')
    fi
    
    echo "$metrics"
}

# Database performance monitoring
monitor_database_performance() {
    local token="$1"
    
    # Test query performance on key endpoints
    local db_metrics="{}"
    
    # Dashboard query performance
    local dashboard_time
    if dashboard_time=$(measure_api_response_time "/api/investor/dashboard" "$token"); then
        db_metrics=$(echo "$db_metrics" | jq --arg time "$dashboard_time" '. + {dashboard_query_ms: $time}')
    fi
    
    # Pitch list query performance
    local pitches_time
    if pitches_time=$(measure_api_response_time "/api/investor/opportunities" "$token"); then
        db_metrics=$(echo "$db_metrics" | jq --arg time "$pitches_time" '. + {pitches_query_ms: $time}')
    fi
    
    # Search query performance
    local search_time
    if search_time=$(measure_api_response_time "/api/search?q=test&limit=5" "$token"); then
        db_metrics=$(echo "$db_metrics" | jq --arg time "$search_time" '. + {search_query_ms: $time}')
    fi
    
    echo "$db_metrics"
}

# Comprehensive performance check
run_performance_check() {
    log_info "Running comprehensive performance check..."
    
    local timestamp=$(date -Iseconds)
    local overall_status="healthy"
    local alerts=()
    local metrics="{}"
    
    # Get authentication tokens
    local investor_token creator_token production_token
    if investor_token=$(get_auth_token "$INVESTOR_EMAIL" "$INVESTOR_PASSWORD" "investor"); then
        log_success "Authentication: Investor token obtained"
    else
        log_warning "Authentication: Failed to obtain investor token"
        alerts+=("Failed investor authentication")
        overall_status="degraded"
    fi
    
    if creator_token=$(get_auth_token "$CREATOR_EMAIL" "$CREATOR_PASSWORD" "creator"); then
        log_success "Authentication: Creator token obtained"
    else
        log_warning "Authentication: Failed to obtain creator token"
    fi
    
    if production_token=$(get_auth_token "$PRODUCTION_EMAIL" "$PRODUCTION_PASSWORD" "production"); then
        log_success "Authentication: Production token obtained"
    else
        log_warning "Authentication: Failed to obtain production token"
    fi
    
    # API Response Time Monitoring
    if [[ -n "$investor_token" ]]; then
        log_info "Measuring API response times..."
        
        local endpoints=(
            "/api/investor/dashboard"
            "/api/investor/opportunities"
            "/api/investor/portfolio"
            "/api/investor/analytics"
        )
        
        local api_metrics="{}"
        local total_response_time=0
        local endpoint_count=0
        
        for endpoint in "${endpoints[@]}"; do
            local response_time
            if response_time=$(measure_api_response_time "$endpoint" "$investor_token"); then
                local endpoint_name=$(echo "$endpoint" | sed 's/[^a-zA-Z0-9]/_/g')
                api_metrics=$(echo "$api_metrics" | jq --arg name "$endpoint_name" --arg time "$response_time" '. + {($name): ($time | tonumber)}')
                total_response_time=$((total_response_time + response_time))
                ((endpoint_count++))
                
                # Check for slow responses
                if [[ $response_time -gt $ALERT_THRESHOLD_MS ]]; then
                    log_alert "Slow API response: $endpoint took ${response_time}ms (threshold: ${ALERT_THRESHOLD_MS}ms)"
                    alerts+=("Slow response: $endpoint")
                    overall_status="degraded"
                else
                    log_metric "$endpoint: ${response_time}ms"
                fi
            else
                log_warning "Failed to measure response time for $endpoint"
                alerts+=("Failed endpoint: $endpoint")
                overall_status="degraded"
            fi
        done
        
        # Calculate average response time
        if [[ $endpoint_count -gt 0 ]]; then
            local avg_response_time=$((total_response_time / endpoint_count))
            api_metrics=$(echo "$api_metrics" | jq --arg avg "$avg_response_time" '. + {average_response_ms: ($avg | tonumber)}')
            log_metric "Average API response time: ${avg_response_time}ms"
        fi
        
        metrics=$(echo "$metrics" | jq --argjson api "$api_metrics" '. + {api_performance: $api}')
    fi
    
    # WebSocket Latency Monitoring
    log_info "Measuring WebSocket latency..."
    local ws_latency
    if ws_latency=$(measure_websocket_latency); then
        metrics=$(echo "$metrics" | jq --arg latency "$ws_latency" '. + {websocket_latency_ms: ($latency | tonumber)}')
        log_metric "WebSocket latency: ${ws_latency}ms"
        
        if [[ $ws_latency -gt $((ALERT_THRESHOLD_MS / 2)) ]]; then
            log_warning "High WebSocket latency: ${ws_latency}ms"
            alerts+=("High WebSocket latency")
        fi
    else
        log_warning "Failed to measure WebSocket latency"
        alerts+=("WebSocket unavailable")
    fi
    
    # Database Performance Monitoring
    if [[ -n "$investor_token" ]]; then
        log_info "Monitoring database performance..."
        local db_metrics
        if db_metrics=$(monitor_database_performance "$investor_token"); then
            metrics=$(echo "$metrics" | jq --argjson db "$db_metrics" '. + {database_performance: $db}')
            
            # Check for slow database queries
            local dashboard_time
            dashboard_time=$(echo "$db_metrics" | jq -r '.dashboard_query_ms // "0"')
            if [[ $dashboard_time -gt $((ALERT_THRESHOLD_MS * 2)) ]]; then
                log_alert "Slow database query: Dashboard took ${dashboard_time}ms"
                alerts+=("Slow database queries")
                overall_status="degraded"
            fi
        else
            log_warning "Failed to monitor database performance"
            alerts+=("Database monitoring failed")
        fi
    fi
    
    # System Resource Monitoring
    log_info "Monitoring system resources..."
    local system_metrics
    if system_metrics=$(get_system_metrics); then
        metrics=$(echo "$metrics" | jq --argjson sys "$system_metrics" '. + {system_resources: $sys}')
        
        # Check memory usage
        local memory_used
        memory_used=$(echo "$system_metrics" | jq -r '.memory_used_mb // "0"')
        if [[ $(echo "$memory_used > $MEMORY_THRESHOLD_MB" | bc -l 2>/dev/null || echo "0") -eq 1 ]]; then
            log_alert "High memory usage: ${memory_used}MB (threshold: ${MEMORY_THRESHOLD_MB}MB)"
            alerts+=("High memory usage")
            overall_status="degraded"
        else
            log_metric "Memory usage: ${memory_used}MB"
        fi
        
        # Check CPU usage
        local cpu_usage
        cpu_usage=$(echo "$system_metrics" | jq -r '.cpu_usage_percent // "0"')
        if [[ $(echo "$cpu_usage > $CPU_THRESHOLD" | bc -l 2>/dev/null || echo "0") -eq 1 ]]; then
            log_alert "High CPU usage: ${cpu_usage}% (threshold: ${CPU_THRESHOLD}%)"
            alerts+=("High CPU usage")
            overall_status="degraded"
        else
            log_metric "CPU usage: ${cpu_usage}%"
        fi
    fi
    
    # Compile final metrics report
    local final_metrics
    final_metrics=$(jq -n \
        --arg timestamp "$timestamp" \
        --arg status "$overall_status" \
        --argjson alerts "$(printf '%s\n' "${alerts[@]}" | jq -R . | jq -s .)" \
        --argjson data "$metrics" \
        '{
            timestamp: $timestamp,
            status: $status,
            alert_count: ($alerts | length),
            alerts: $alerts,
            metrics: $data
        }')
    
    # Save current metrics
    echo "$final_metrics" > "$METRICS_JSON"
    
    # Add to trends
    local temp_file=$(mktemp)
    jq ". + [$final_metrics]" "$TRENDS_JSON" > "$temp_file" && mv "$temp_file" "$TRENDS_JSON"
    
    # Trim trends to last 24 hours (assuming 1-minute intervals)
    local trend_limit=1440
    jq "if length > $trend_limit then .[-$trend_limit:] else . end" "$TRENDS_JSON" > "$temp_file" && mv "$temp_file" "$TRENDS_JSON"
    
    log_info "Performance check completed. Status: $overall_status"
    
    if [[ "$overall_status" == "degraded" ]]; then
        log_warning "Performance degradation detected!"
        return 1
    else
        log_success "All systems operating normally"
        return 0
    fi
}

# Continuous monitoring loop
start_continuous_monitoring() {
    log_info "Starting continuous monitoring (interval: ${MONITORING_INTERVAL}s)..."
    
    MONITORING_ACTIVE=true
    
    while $MONITORING_ACTIVE; do
        run_performance_check || true
        
        # Generate real-time report
        generate_performance_report
        
        log_info "Next check in ${MONITORING_INTERVAL} seconds..."
        sleep "$MONITORING_INTERVAL"
    done
}

# Stop monitoring
stop_monitoring() {
    log_info "Stopping performance monitoring..."
    MONITORING_ACTIVE=false
    
    if [[ -n "$MONITORING_PID" && "$MONITORING_PID" != "0" ]]; then
        kill "$MONITORING_PID" 2>/dev/null || true
    fi
    
    log_info "Performance monitoring stopped"
}

# Generate performance report
generate_performance_report() {
    local report_file="$REPORT_DIR/performance-report-$(date +%Y%m%d_%H%M%S).html"
    
    # Calculate performance statistics from trends
    local stats
    stats=$(jq '
        {
            total_checks: length,
            healthy_checks: [.[] | select(.status == "healthy")] | length,
            degraded_checks: [.[] | select(.status == "degraded")] | length,
            average_response_time: [.[] | .metrics.api_performance.average_response_ms // 0] | add / length,
            max_response_time: [.[] | .metrics.api_performance.average_response_ms // 0] | max,
            average_memory: [.[] | .metrics.system_resources.memory_used_mb // 0 | tonumber] | add / length,
            average_cpu: [.[] | .metrics.system_resources.cpu_usage_percent // 0 | tonumber] | add / length,
            uptime_percentage: (([.[] | select(.status == "healthy")] | length) * 100 / length),
            last_check: .[-1].timestamp,
            alert_count: [.[] | .alert_count] | add
        }
    ' "$TRENDS_JSON" 2>/dev/null || echo '{}')
    
    # Generate HTML report
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Pitchey Platform Performance Report</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; color: #333; margin-bottom: 30px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 6px; border-left: 4px solid #007bff; }
        .metric-value { font-size: 24px; font-weight: bold; color: #007bff; }
        .metric-label { color: #666; font-size: 14px; }
        .status-healthy { border-left-color: #28a745; }
        .status-healthy .metric-value { color: #28a745; }
        .status-warning { border-left-color: #ffc107; }
        .status-warning .metric-value { color: #ffc107; }
        .status-error { border-left-color: #dc3545; }
        .status-error .metric-value { color: #dc3545; }
        .alerts { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 20px 0; }
        .timestamp { text-align: center; color: #666; margin-top: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: 600; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎬 Pitchey Platform Performance Report</h1>
            <p>Real-time monitoring and performance analytics</p>
        </div>
        
        <div class="metrics-grid">
            <div class="metric-card status-healthy">
                <div class="metric-value">$(echo "$stats" | jq -r '.uptime_percentage // 0 | floor')%</div>
                <div class="metric-label">Uptime Percentage</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">$(echo "$stats" | jq -r '.average_response_time // 0 | floor')ms</div>
                <div class="metric-label">Avg Response Time</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">$(echo "$stats" | jq -r '.average_memory // 0 | floor')MB</div>
                <div class="metric-label">Avg Memory Usage</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">$(echo "$stats" | jq -r '.average_cpu // 0 | floor')%</div>
                <div class="metric-label">Avg CPU Usage</div>
            </div>
        </div>
        
        <div class="alerts">
            <h3>Recent Alerts</h3>
            <p>Total alerts in monitoring period: $(echo "$stats" | jq -r '.alert_count // 0')</p>
        </div>
        
        <h3>Current System Status</h3>
        <table>
            <tr>
                <th>Component</th>
                <th>Status</th>
                <th>Response Time</th>
                <th>Last Check</th>
            </tr>
            <tr>
                <td>Investor Dashboard</td>
                <td>$(jq -r '.metrics.api_performance._api_investor_dashboard // "N/A"' "$METRICS_JSON")ms</td>
                <td>✅ Healthy</td>
                <td>$(jq -r '.timestamp // "N/A"' "$METRICS_JSON")</td>
            </tr>
        </table>
        
        <div class="timestamp">
            Report generated: $(date)<br>
            Monitoring base URL: $BASE_URL<br>
            Data points: $(jq 'length' "$TRENDS_JSON") checks
        </div>
    </div>
</body>
</html>
EOF
    
    log_success "Performance report generated: $report_file"
}

# Health check endpoint
run_health_check() {
    log_info "Running quick health check..."
    
    # Test server connectivity
    if curl -s "$BASE_URL/health" >/dev/null 2>&1; then
        log_success "Server is responding"
        
        # Quick response time check
        local response_time
        if response_time=$(measure_api_response_time "/health" "" "GET"); then
            log_metric "Health endpoint response: ${response_time}ms"
            
            if [[ $response_time -gt $ALERT_THRESHOLD_MS ]]; then
                log_warning "Health check slow: ${response_time}ms"
                return 1
            else
                log_success "Health check passed: ${response_time}ms"
                return 0
            fi
        else
            log_warning "Failed to measure health endpoint response time"
            return 1
        fi
    else
        log_alert "Server not responding to health check"
        return 1
    fi
}

# Main function
main() {
    local action="${1:-check}"
    
    case "$action" in
        "check")
            log_info "Running single performance check..."
            run_performance_check
            ;;
        "monitor")
            log_info "Starting continuous monitoring..."
            trap 'stop_monitoring; exit 0' SIGINT SIGTERM
            start_continuous_monitoring &
            MONITORING_PID=$!
            wait $MONITORING_PID
            ;;
        "health")
            run_health_check
            ;;
        "report")
            log_info "Generating performance report..."
            generate_performance_report
            ;;
        "stop")
            stop_monitoring
            ;;
        *)
            echo "Usage: $0 {check|monitor|health|report|stop}"
            echo ""
            echo "Commands:"
            echo "  check    - Run single performance check"
            echo "  monitor  - Start continuous monitoring"
            echo "  health   - Quick health check"
            echo "  report   - Generate performance report"
            echo "  stop     - Stop monitoring"
            echo ""
            echo "Environment variables:"
            echo "  API_URL              - Base URL (default: http://localhost:8001)"
            echo "  MONITOR_INTERVAL     - Check interval in seconds (default: 60)"
            echo "  ALERT_THRESHOLD      - Response time alert threshold in ms (default: 2000)"
            echo "  MEMORY_THRESHOLD     - Memory usage alert threshold in MB (default: 512)"
            echo "  CPU_THRESHOLD        - CPU usage alert threshold in % (default: 80)"
            echo "  WEBHOOK_URL          - Webhook URL for alerts"
            echo "  ALERT_EMAIL          - Email address for alerts"
            exit 1
            ;;
    esac
}

# Check dependencies
for cmd in jq curl; do
    if ! command -v "$cmd" &> /dev/null; then
        echo "Error: $cmd is required but not installed."
        exit 1
    fi
done

# Install bc if available for math operations
if ! command -v bc &> /dev/null; then
    log_warning "bc not available - some calculations may be limited"
fi

# Run the monitoring script
main "$@"