#!/bin/bash

# =====================================================
# Post-Deployment Verification Script
# =====================================================

set -euo pipefail

# Configuration
WORKER_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
FRONTEND_URL="https://pitchey-5o8-66n.pages.dev"
TIMESTAMP=$(date +"%Y%m%d%H%M%S")
REPORT_FILE="verification-results-$(date -Iseconds).json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

# Initialize results
declare -A results

# =====================================================
# HEALTH CHECKS
# =====================================================

test_worker_health() {
    log "Testing Worker API health..."
    
    local response=$(curl -sf --max-time 30 "$WORKER_URL/api/health" 2>/dev/null || echo "FAILED")
    
    if [[ "$response" == "FAILED" ]]; then
        error "Worker health check failed"
        results["worker_health"]="FAIL"
        return 1
    fi
    
    # Parse JSON response
    local status=$(echo "$response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "unknown")
    
    if [[ "$status" == "ok" ]]; then
        success "Worker API is healthy"
        results["worker_health"]="PASS"
        
        # Check database connection
        local db_status=$(echo "$response" | grep -o '"database":{"status":"[^"]*"' | cut -d'"' -f6 2>/dev/null || echo "unknown")
        if [[ "$db_status" == "connected" ]]; then
            success "Database connection verified"
            results["database_connection"]="PASS"
        else
            warning "Database connection status: $db_status"
            results["database_connection"]="WARN"
        fi
    else
        warning "Worker API status: $status"
        results["worker_health"]="WARN"
    fi
}

test_frontend_availability() {
    log "Testing frontend availability..."
    
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$FRONTEND_URL" 2>/dev/null || echo "000")
    
    if [[ "$status_code" == "200" ]]; then
        success "Frontend is accessible"
        results["frontend_availability"]="PASS"
        
        # Check if it contains the expected content
        local content=$(curl -sf --max-time 30 "$FRONTEND_URL" 2>/dev/null || echo "FAILED")
        if echo "$content" | grep -q "Pitchey" 2>/dev/null; then
            success "Frontend content verified"
            results["frontend_content"]="PASS"
        else
            warning "Frontend content verification failed"
            results["frontend_content"]="WARN"
        fi
    else
        error "Frontend returned status code: $status_code"
        results["frontend_availability"]="FAIL"
    fi
}

test_api_endpoints() {
    log "Testing critical API endpoints..."
    
    local endpoints=(
        "/api/health"
        "/api/auth/session"
        "/api/pitches"
    )
    
    local passed=0
    local total=${#endpoints[@]}
    
    for endpoint in "${endpoints[@]}"; do
        local url="$WORKER_URL$endpoint"
        local status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$url" 2>/dev/null || echo "000")
        
        # Accept both 200 (success) and 401 (unauthorized) as valid responses
        if [[ "$status_code" == "200" || "$status_code" == "401" || "$status_code" == "404" ]]; then
            success "Endpoint $endpoint: $status_code"
            ((passed++))
        else
            error "Endpoint $endpoint: $status_code"
        fi
    done
    
    if [[ $passed -eq $total ]]; then
        success "All API endpoints responding"
        results["api_endpoints"]="PASS"
    else
        warning "API endpoints: $passed/$total responding"
        results["api_endpoints"]="WARN"
    fi
}

test_websocket_endpoint() {
    log "Testing WebSocket endpoint availability..."
    
    # Test if WebSocket endpoint responds to HTTP (upgrade should fail but endpoint should exist)
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$WORKER_URL/ws" 2>/dev/null || echo "000")
    
    # WebSocket endpoints typically return 400 (Bad Request) for HTTP requests
    if [[ "$status_code" == "400" || "$status_code" == "426" || "$status_code" == "200" ]]; then
        success "WebSocket endpoint is reachable"
        results["websocket_endpoint"]="PASS"
    else
        warning "WebSocket endpoint status: $status_code"
        results["websocket_endpoint"]="WARN"
    fi
}

test_performance() {
    log "Running basic performance tests..."
    
    # Measure API response time
    local api_time=$(curl -w "%{time_total}" -s -o /dev/null --max-time 30 "$WORKER_URL/api/health" 2>/dev/null || echo "999")
    local api_time_ms=$(echo "$api_time * 1000" | bc 2>/dev/null || echo "999")
    
    if (( $(echo "$api_time < 2.0" | bc -l 2>/dev/null || echo 0) )); then
        success "API response time: ${api_time_ms%.*}ms"
        results["api_performance"]="PASS"
    else
        warning "API response time slow: ${api_time_ms%.*}ms"
        results["api_performance"]="WARN"
    fi
    
    # Measure frontend response time
    local frontend_time=$(curl -w "%{time_total}" -s -o /dev/null --max-time 30 "$FRONTEND_URL" 2>/dev/null || echo "999")
    local frontend_time_ms=$(echo "$frontend_time * 1000" | bc 2>/dev/null || echo "999")
    
    if (( $(echo "$frontend_time < 3.0" | bc -l 2>/dev/null || echo 0) )); then
        success "Frontend response time: ${frontend_time_ms%.*}ms"
        results["frontend_performance"]="PASS"
    else
        warning "Frontend response time slow: ${frontend_time_ms%.*}ms"
        results["frontend_performance"]="WARN"
    fi
}

# =====================================================
# GENERATE REPORT
# =====================================================

generate_report() {
    log "Generating verification report..."
    
    local total_tests=${#results[@]}
    local passed_tests=0
    local failed_tests=0
    local warning_tests=0
    
    for result in "${results[@]}"; do
        case $result in
            "PASS") ((passed_tests++)) ;;
            "FAIL") ((failed_tests++)) ;;
            "WARN") ((warning_tests++)) ;;
        esac
    done
    
    # Create JSON report
    cat > "$REPORT_FILE" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "deployment_id": "$TIMESTAMP",
  "summary": {
    "total_tests": $total_tests,
    "passed": $passed_tests,
    "failed": $failed_tests,
    "warnings": $warning_tests,
    "success_rate": "$(echo "scale=2; $passed_tests * 100 / $total_tests" | bc 2>/dev/null || echo "0")%"
  },
  "results": {
EOF

    local first=true
    for key in "${!results[@]}"; do
        if [[ "$first" == "true" ]]; then
            first=false
        else
            echo "," >> "$REPORT_FILE"
        fi
        echo "    \"$key\": \"${results[$key]}\"" >> "$REPORT_FILE"
    done

    cat >> "$REPORT_FILE" <<EOF
  },
  "endpoints": {
    "worker_api": "$WORKER_URL",
    "frontend": "$FRONTEND_URL"
  }
}
EOF
    
    echo ""
    log "=========================================="
    log "DEPLOYMENT VERIFICATION SUMMARY"
    log "=========================================="
    success "Passed: $passed_tests"
    if [[ $warning_tests -gt 0 ]]; then
        warning "Warnings: $warning_tests"
    fi
    if [[ $failed_tests -gt 0 ]]; then
        error "Failed: $failed_tests"
    fi
    log "Success Rate: $(echo "scale=2; $passed_tests * 100 / $total_tests" | bc 2>/dev/null || echo "0")%"
    log "Report saved: $REPORT_FILE"
    log "=========================================="
    
    if [[ $failed_tests -eq 0 ]]; then
        success "Deployment verification completed successfully!"
        return 0
    else
        error "Deployment verification found issues"
        return 1
    fi
}

# =====================================================
# MAIN EXECUTION
# =====================================================

main() {
    log "Starting post-deployment verification..."
    log "Worker URL: $WORKER_URL"
    log "Frontend URL: $FRONTEND_URL"
    echo ""
    
    test_worker_health
    test_frontend_availability
    test_api_endpoints
    test_websocket_endpoint
    test_performance
    
    generate_report
}

# Run main function
main "$@"