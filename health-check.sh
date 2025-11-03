#!/bin/bash

# =============================================================================
# Pitchey Production Health Check Script
# =============================================================================
# Comprehensive health monitoring for all production components
# Usage: ./health-check.sh [--detailed] [--json] [--alert-webhook=URL]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/health-check.log"

# URLs to check
FRONTEND_URL="https://pitchey.pages.dev"
API_WORKER_URL="https://pitchey-api-production.cavelltheleaddev.workers.dev"
BACKUP_API_URL="https://pitchey-backend-fresh.deno.dev"

# Options
DETAILED=false
JSON_OUTPUT=false
ALERT_WEBHOOK=""

# Parse command line arguments
for arg in "$@"; do
    case $arg in
        --detailed)
            DETAILED=true
            shift
            ;;
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        --alert-webhook=*)
            ALERT_WEBHOOK="${arg#*=}"
            shift
            ;;
    esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $*" >> "$LOG_FILE"
    if [ "$JSON_OUTPUT" = false ]; then
        echo "$*"
    fi
}

# Health check results
declare -A HEALTH_RESULTS

# Check HTTP endpoint
check_http_endpoint() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    local timeout=${4:-10}
    
    local start_time=$(date +%s%N)
    local status_code
    local response_time
    local error_message=""
    
    if status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$timeout" "$url" 2>/dev/null); then
        local end_time=$(date +%s%N)
        response_time=$(((end_time - start_time) / 1000000))
        
        if [ "$status_code" = "$expected_status" ]; then
            HEALTH_RESULTS["$name"]="healthy"
            HEALTH_RESULTS["${name}_status"]="$status_code"
            HEALTH_RESULTS["${name}_response_time"]="$response_time"
            log "✅ $name: OK ($status_code, ${response_time}ms)"
        else
            HEALTH_RESULTS["$name"]="unhealthy"
            HEALTH_RESULTS["${name}_status"]="$status_code"
            HEALTH_RESULTS["${name}_response_time"]="$response_time"
            error_message="Unexpected status code: $status_code"
            log "❌ $name: $error_message ($status_code, ${response_time}ms)"
        fi
    else
        HEALTH_RESULTS["$name"]="unreachable"
        HEALTH_RESULTS["${name}_status"]="0"
        HEALTH_RESULTS["${name}_response_time"]="0"
        error_message="Connection failed or timeout"
        log "❌ $name: $error_message"
    fi
    
    HEALTH_RESULTS["${name}_error"]="$error_message"
}

# Check WebSocket endpoint
check_websocket() {
    local name=$1
    local url=$2
    local timeout=${3:-10}
    
    log "🔍 Testing WebSocket: $name"
    
    if timeout "$timeout" node -e "
        const WebSocket = require('ws');
        const ws = new WebSocket('$url');
        ws.on('open', () => {
            console.log('WebSocket connected');
            ws.close();
            process.exit(0);
        });
        ws.on('error', (error) => {
            console.error('WebSocket error:', error.message);
            process.exit(1);
        });
        setTimeout(() => {
            console.error('WebSocket timeout');
            process.exit(1);
        }, $((timeout * 1000)));
    " 2>/dev/null; then
        HEALTH_RESULTS["$name"]="healthy"
        log "✅ $name: WebSocket connection successful"
    else
        HEALTH_RESULTS["$name"]="unhealthy"
        log "❌ $name: WebSocket connection failed"
    fi
}

# Check API endpoint with authentication
check_api_endpoint() {
    local name=$1
    local url=$2
    local method=${3:-GET}
    local expected_status=${4:-200}
    
    log "🔍 Testing API endpoint: $name"
    
    local start_time=$(date +%s%N)
    local status_code
    local response_time
    
    if status_code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" --max-time 10 "$url" 2>/dev/null); then
        local end_time=$(date +%s%N)
        response_time=$(((end_time - start_time) / 1000000))
        
        if [ "$status_code" = "$expected_status" ]; then
            HEALTH_RESULTS["$name"]="healthy"
            log "✅ $name: OK ($method $status_code, ${response_time}ms)"
        else
            HEALTH_RESULTS["$name"]="degraded"
            log "⚠️ $name: Unexpected status ($method $status_code, ${response_time}ms)"
        fi
    else
        HEALTH_RESULTS["$name"]="unhealthy"
        log "❌ $name: Failed ($method)"
    fi
}

# Check database connectivity (through API)
check_database() {
    local name="Database"
    log "🔍 Testing database connectivity through API"
    
    # Test through Worker API
    if curl -sf "$API_WORKER_URL/api/health" | grep -q "database.*healthy" 2>/dev/null; then
        HEALTH_RESULTS["$name"]="healthy"
        log "✅ $name: Connectivity OK (via Worker)"
    elif curl -sf "$BACKUP_API_URL/api/health" | grep -q "database.*healthy" 2>/dev/null; then
        HEALTH_RESULTS["$name"]="healthy"
        log "✅ $name: Connectivity OK (via Backup)"
    else
        HEALTH_RESULTS["$name"]="unhealthy"
        log "❌ $name: Connectivity issues"
    fi
}

# Check cache status
check_cache() {
    local name="Cache"
    log "🔍 Testing cache status"
    
    # Test Redis cache through API
    if curl -sf "$API_WORKER_URL/api/health" | grep -q "cache.*healthy" 2>/dev/null; then
        HEALTH_RESULTS["$name"]="healthy"
        log "✅ $name: Redis cache operational"
    elif curl -sf "$BACKUP_API_URL/api/health" | grep -q "cache.*healthy" 2>/dev/null; then
        HEALTH_RESULTS["$name"]="healthy"
        log "✅ $name: Redis cache operational (via Backup)"
    else
        HEALTH_RESULTS["$name"]="degraded"
        log "⚠️ $name: Using fallback cache"
    fi
}

# Performance benchmark
run_performance_test() {
    log "📊 Running performance benchmarks"
    
    # Frontend performance
    local frontend_time=$(curl -o /dev/null -s -w "%{time_total}" "$FRONTEND_URL" 2>/dev/null || echo "0")
    HEALTH_RESULTS["frontend_performance"]="$frontend_time"
    
    # API performance
    local api_time=$(curl -o /dev/null -s -w "%{time_total}" "$API_WORKER_URL/api/health" 2>/dev/null || echo "0")
    HEALTH_RESULTS["api_performance"]="$api_time"
    
    # Backup API performance
    local backup_time=$(curl -o /dev/null -s -w "%{time_total}" "$BACKUP_API_URL/api/health" 2>/dev/null || echo "0")
    HEALTH_RESULTS["backup_performance"]="$backup_time"
    
    log "📊 Performance: Frontend=${frontend_time}s, API=${api_time}s, Backup=${backup_time}s"
    
    # Check if performance is acceptable
    if (( $(echo "$frontend_time > 3.0" | bc -l 2>/dev/null || echo 0) )); then
        log "⚠️ Frontend response time is high: ${frontend_time}s"
    fi
    
    if (( $(echo "$api_time > 2.0" | bc -l 2>/dev/null || echo 0) )); then
        log "⚠️ API response time is high: ${api_time}s"
    fi
}

# Send alert to webhook
send_alert() {
    local message=$1
    local severity=${2:-warning}
    
    if [ -n "$ALERT_WEBHOOK" ]; then
        curl -s -X POST "$ALERT_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{
                \"text\": \"🚨 Pitchey Health Alert: $message\",
                \"severity\": \"$severity\",
                \"timestamp\": \"$(date --iso-8601=seconds)\"
            }" || log "Failed to send alert webhook"
    fi
}

# Generate JSON report
generate_json_report() {
    local overall_status="healthy"
    local critical_issues=0
    
    # Determine overall status
    for key in "${!HEALTH_RESULTS[@]}"; do
        if [[ "$key" != *"_"* ]]; then  # Main status keys
            if [ "${HEALTH_RESULTS[$key]}" = "unhealthy" ] || [ "${HEALTH_RESULTS[$key]}" = "unreachable" ]; then
                overall_status="unhealthy"
                ((critical_issues++))
            elif [ "${HEALTH_RESULTS[$key]}" = "degraded" ] && [ "$overall_status" = "healthy" ]; then
                overall_status="degraded"
            fi
        fi
    done
    
    cat << EOF
{
  "timestamp": "$(date --iso-8601=seconds)",
  "overall_status": "$overall_status",
  "critical_issues": $critical_issues,
  "components": {
    "frontend": {
      "status": "${HEALTH_RESULTS[Frontend]:-unknown}",
      "response_time": "${HEALTH_RESULTS[Frontend_response_time]:-0}",
      "performance": "${HEALTH_RESULTS[frontend_performance]:-0}"
    },
    "api_worker": {
      "status": "${HEALTH_RESULTS[API_Worker]:-unknown}",
      "response_time": "${HEALTH_RESULTS[API_Worker_response_time]:-0}",
      "performance": "${HEALTH_RESULTS[api_performance]:-0}"
    },
    "backup_api": {
      "status": "${HEALTH_RESULTS[Backup_API]:-unknown}",
      "response_time": "${HEALTH_RESULTS[Backup_API_response_time]:-0}",
      "performance": "${HEALTH_RESULTS[backup_performance]:-0}"
    },
    "database": {
      "status": "${HEALTH_RESULTS[Database]:-unknown}"
    },
    "cache": {
      "status": "${HEALTH_RESULTS[Cache]:-unknown}"
    },
    "websocket": {
      "status": "${HEALTH_RESULTS[WebSocket]:-unknown}"
    }
  },
  "urls": {
    "frontend": "$FRONTEND_URL",
    "api_worker": "$API_WORKER_URL",
    "backup_api": "$BACKUP_API_URL"
  }
}
EOF
}

# Main health check function
main() {
    local start_time=$(date +%s)
    
    if [ "$JSON_OUTPUT" = false ]; then
        log "🏥 Starting Pitchey production health check..."
        log "⏰ Timestamp: $(date)"
    fi
    
    # Basic endpoint checks
    check_http_endpoint "Frontend" "$FRONTEND_URL"
    check_http_endpoint "API_Worker" "$API_WORKER_URL/api/health"
    check_http_endpoint "Backup_API" "$BACKUP_API_URL/api/health"
    
    # WebSocket check
    check_websocket "WebSocket" "wss://pitchey-api-production.cavelltheleaddev.workers.dev/ws"
    
    # Service-specific checks
    check_database
    check_cache
    
    if [ "$DETAILED" = true ]; then
        # Detailed API endpoint checks
        check_api_endpoint "Auth_Endpoint" "$API_WORKER_URL/api/auth/login" "POST" "405"
        check_api_endpoint "Pitches_Endpoint" "$API_WORKER_URL/api/pitches/trending"
        check_api_endpoint "Search_Endpoint" "$API_WORKER_URL/api/search" "POST" "400"
        
        # Performance tests
        run_performance_test
    fi
    
    # Calculate overall health
    local healthy_count=0
    local total_count=0
    local critical_issues=0
    
    for key in "${!HEALTH_RESULTS[@]}"; do
        if [[ "$key" != *"_"* ]]; then  # Main status keys only
            ((total_count++))
            case "${HEALTH_RESULTS[$key]}" in
                "healthy")
                    ((healthy_count++))
                    ;;
                "unhealthy"|"unreachable")
                    ((critical_issues++))
                    ;;
            esac
        fi
    done
    
    local health_percentage=$((healthy_count * 100 / total_count))
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [ "$JSON_OUTPUT" = true ]; then
        generate_json_report
    else
        log ""
        log "📊 Health Check Summary:"
        log "   Healthy Components: $healthy_count/$total_count ($health_percentage%)"
        log "   Critical Issues: $critical_issues"
        log "   Check Duration: ${duration}s"
        
        if [ $critical_issues -gt 0 ]; then
            log "🚨 CRITICAL: $critical_issues component(s) are unhealthy!"
            send_alert "$critical_issues critical component failures detected" "critical"
        elif [ $health_percentage -lt 100 ]; then
            log "⚠️ WARNING: Some components are degraded"
            send_alert "Some components showing degraded performance" "warning"
        else
            log "✅ ALL SYSTEMS OPERATIONAL"
        fi
    fi
    
    # Exit with appropriate code
    if [ $critical_issues -gt 0 ]; then
        exit 1
    elif [ $health_percentage -lt 100 ]; then
        exit 2
    else
        exit 0
    fi
}

# Run main function
main "$@"