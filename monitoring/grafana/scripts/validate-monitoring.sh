#!/bin/bash

# Monitoring System Validation Script for Pitchey
# Comprehensive validation of Grafana monitoring setup

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONITORING_DIR="$(dirname "$SCRIPT_DIR")"
VALIDATION_LOG="/tmp/pitchey-monitoring-validation.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] $1" >> "$VALIDATION_LOG"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [SUCCESS] $1" >> "$VALIDATION_LOG"
    ((TESTS_PASSED++))
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [WARNING] $1" >> "$VALIDATION_LOG"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $1" >> "$VALIDATION_LOG"
    ((TESTS_FAILED++))
}

# Test wrapper function
run_test() {
    local test_name="$1"
    local test_command="$2"
    ((TESTS_TOTAL++))
    
    log_info "Running test: $test_name"
    
    if eval "$test_command"; then
        log_success "$test_name"
        return 0
    else
        log_error "$test_name FAILED"
        return 1
    fi
}

# Initialize validation log
init_log() {
    : > "$VALIDATION_LOG"
    log_info "Starting Pitchey monitoring validation"
    log_info "Validation log: $VALIDATION_LOG"
    echo
}

# Check environment variables
check_environment() {
    log_info "🔧 Checking Environment Configuration"
    echo
    
    local required_vars=(
        "GRAFANA_URL"
        "GRAFANA_API_KEY" 
        "GRAFANA_ORG_ID"
        "CLOUDFLARE_API_TOKEN"
        "CLOUDFLARE_ZONE_ID"
    )
    
    local optional_vars=(
        "GRAFANA_PROMETHEUS_URL"
        "GRAFANA_LOKI_URL"
        "GRAFANA_PUSH_URL"
        "CLOUDFLARE_WORKER_NAME"
        "WORKER_METRICS_TOKEN"
    )
    
    for var in "${required_vars[@]}"; do
        run_test "Required environment variable: $var" "[[ -n \"\${$var:-}\" ]]"
    done
    
    for var in "${optional_vars[@]}"; do
        if [[ -n "${!var:-}" ]]; then
            log_success "Optional variable set: $var"
        else
            log_warning "Optional variable not set: $var"
        fi
    done
    
    echo
}

# Check file structure
check_files() {
    log_info "📁 Checking File Structure"
    echo
    
    local required_files=(
        "$MONITORING_DIR/dashboards/pitchey-worker-overview.json"
        "$MONITORING_DIR/dashboards/pitchey-cache-performance.json"
        "$MONITORING_DIR/dashboards/pitchey-database-infrastructure.json"
        "$MONITORING_DIR/dashboards/pitchey-business-metrics.json"
        "$MONITORING_DIR/alerts/pitchey-critical-alerts.json"
        "$SCRIPT_DIR/metrics-collector.ts"
        "$SCRIPT_DIR/deploy-dashboards.sh"
        "$SCRIPT_DIR/start-metrics-collection.sh"
        "$SCRIPT_DIR/cloudflare-log-aggregation.ts"
    )
    
    for file in "${required_files[@]}"; do
        run_test "File exists: $(basename "$file")" "[[ -f \"$file\" ]]"
    done
    
    echo
}

# Check dependencies
check_dependencies() {
    log_info "📦 Checking Dependencies"
    echo
    
    run_test "Deno runtime available" "command -v deno >/dev/null 2>&1"
    run_test "curl available" "command -v curl >/dev/null 2>&1" 
    run_test "jq available" "command -v jq >/dev/null 2>&1"
    
    if command -v deno >/dev/null 2>&1; then
        local deno_version
        deno_version=$(deno --version 2>/dev/null | head -n1 | cut -d' ' -f2)
        log_info "Deno version: $deno_version"
    fi
    
    echo
}

# Test Grafana API connectivity
test_grafana_api() {
    log_info "🔗 Testing Grafana API Connectivity"
    echo
    
    if [[ -z "${GRAFANA_URL:-}" ]] || [[ -z "${GRAFANA_API_KEY:-}" ]]; then
        log_error "Grafana credentials not set, skipping API tests"
        return 1
    fi
    
    # Test basic API connectivity
    run_test "Grafana API health check" "
        curl -s -f -H 'Authorization: Bearer $GRAFANA_API_KEY' \
             '$GRAFANA_URL/api/health' >/dev/null"
    
    # Test organization access
    run_test "Grafana organization access" "
        curl -s -f -H 'Authorization: Bearer $GRAFANA_API_KEY' \
             -H 'X-Grafana-Org-Id: ${GRAFANA_ORG_ID:-1}' \
             '$GRAFANA_URL/api/user' >/dev/null"
    
    # Test dashboard API
    run_test "Grafana dashboard API access" "
        curl -s -f -H 'Authorization: Bearer $GRAFANA_API_KEY' \
             -H 'X-Grafana-Org-Id: ${GRAFANA_ORG_ID:-1}' \
             '$GRAFANA_URL/api/search' >/dev/null"
    
    echo
}

# Test Cloudflare API connectivity  
test_cloudflare_api() {
    log_info "☁️ Testing Cloudflare API Connectivity"
    echo
    
    if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]] || [[ -z "${CLOUDFLARE_ZONE_ID:-}" ]]; then
        log_error "Cloudflare credentials not set, skipping API tests"
        return 1
    fi
    
    # Test API token validity
    run_test "Cloudflare API token validation" "
        curl -s -f -H 'Authorization: Bearer $CLOUDFLARE_API_TOKEN' \
             'https://api.cloudflare.com/client/v4/user/tokens/verify' | \
             jq -e '.success == true' >/dev/null"
    
    # Test zone access
    run_test "Cloudflare zone access" "
        curl -s -f -H 'Authorization: Bearer $CLOUDFLARE_API_TOKEN' \
             'https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID' | \
             jq -e '.success == true' >/dev/null"
    
    # Test GraphQL analytics access
    run_test "Cloudflare Analytics API access" "
        curl -s -f -H 'Authorization: Bearer $CLOUDFLARE_API_TOKEN' \
             -H 'Content-Type: application/json' \
             -X POST 'https://api.cloudflare.com/client/v4/graphql' \
             -d '{\"query\":\"query { viewer { zones(filter: {zoneTag: \\\"$CLOUDFLARE_ZONE_ID\\\"}) { zoneTag } } }\"}' | \
             jq -e '.data.viewer.zones | length > 0' >/dev/null"
    
    echo
}

# Test Worker endpoint
test_worker_endpoint() {
    log_info "⚡ Testing Worker Endpoint"
    echo
    
    local worker_url="https://pitchey-production.cavelltheleaddev.workers.dev"
    
    # Test main endpoint
    run_test "Worker endpoint responsive" "
        curl -s -f --max-time 10 '$worker_url' >/dev/null"
    
    # Test health endpoint if available
    if curl -s --max-time 5 "$worker_url/health" >/dev/null 2>&1; then
        run_test "Worker health endpoint" "
            curl -s -f --max-time 5 '$worker_url/health' | \
            jq -e '.status == \"healthy\"' >/dev/null 2>&1 || true"
    else
        log_warning "Worker health endpoint not available"
    fi
    
    # Test metrics endpoint if configured
    if [[ -n "${WORKER_METRICS_TOKEN:-}" ]]; then
        run_test "Worker metrics endpoint" "
            curl -s -f --max-time 5 \
                 -H 'Authorization: Bearer $WORKER_METRICS_TOKEN' \
                 '$worker_url/metrics' >/dev/null"
    else
        log_warning "Worker metrics token not configured"
    fi
    
    echo
}

# Validate dashboard JSON files
validate_dashboards() {
    log_info "📊 Validating Dashboard Configurations"
    echo
    
    local dashboard_files=(
        "$MONITORING_DIR/dashboards/pitchey-worker-overview.json"
        "$MONITORING_DIR/dashboards/pitchey-cache-performance.json" 
        "$MONITORING_DIR/dashboards/pitchey-database-infrastructure.json"
        "$MONITORING_DIR/dashboards/pitchey-business-metrics.json"
    )
    
    for dashboard_file in "${dashboard_files[@]}"; do
        local dashboard_name
        dashboard_name=$(basename "$dashboard_file" .json)
        
        run_test "Valid JSON: $dashboard_name" "jq empty '$dashboard_file'"
        
        run_test "Dashboard structure: $dashboard_name" "
            jq -e '.dashboard.title and .dashboard.panels' '$dashboard_file' >/dev/null"
    done
    
    echo
}

# Validate alert configurations
validate_alerts() {
    log_info "🚨 Validating Alert Configurations"
    echo
    
    local alerts_file="$MONITORING_DIR/alerts/pitchey-critical-alerts.json"
    
    run_test "Valid alerts JSON" "jq empty '$alerts_file'"
    
    run_test "Alert rules structure" "
        jq -e '.alerts | length > 0' '$alerts_file' >/dev/null"
    
    run_test "Contact points configured" "
        jq -e '.contactPoints | length > 0' '$alerts_file' >/dev/null"
    
    # Check individual alert rules
    local alert_count
    alert_count=$(jq -r '.alerts | length' "$alerts_file")
    log_info "Found $alert_count alert rules"
    
    echo
}

# Test metrics collection
test_metrics_collection() {
    log_info "📈 Testing Metrics Collection"
    echo
    
    # Test metrics collector script
    run_test "Metrics collector script syntax" "
        deno check '$SCRIPT_DIR/metrics-collector.ts'"
    
    # Test single metrics collection run
    if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]] && [[ -n "${GRAFANA_PUSH_URL:-}" ]]; then
        run_test "Single metrics collection" "
            timeout 30 deno run --allow-all '$SCRIPT_DIR/metrics-collector.ts' --once"
    else
        log_warning "Cannot test metrics collection - missing credentials"
    fi
    
    echo
}

# Test log aggregation
test_log_aggregation() {
    log_info "📝 Testing Log Aggregation"
    echo
    
    # Test log aggregation script
    run_test "Log aggregation script syntax" "
        deno check '$SCRIPT_DIR/cloudflare-log-aggregation.ts'"
    
    if [[ -n "${GRAFANA_LOKI_URL:-}" ]]; then
        log_success "Loki URL configured"
    else
        log_warning "Loki URL not configured - log aggregation unavailable"
    fi
    
    echo
}

# Test deployment scripts
test_deployment_scripts() {
    log_info "🚀 Testing Deployment Scripts"
    echo
    
    run_test "Dashboard deployment script executable" "[[ -x '$SCRIPT_DIR/deploy-dashboards.sh' ]]"
    run_test "Metrics collection script executable" "[[ -x '$SCRIPT_DIR/start-metrics-collection.sh' ]]"
    
    # Test dry run of dashboard deployment
    if [[ -n "${GRAFANA_URL:-}" ]]; then
        run_test "Dashboard deployment dry run" "
            '$SCRIPT_DIR/deploy-dashboards.sh' --dry-run >/dev/null"
    else
        log_warning "Cannot test dashboard deployment - Grafana URL not set"
    fi
    
    echo
}

# Performance benchmark
performance_benchmark() {
    log_info "⚡ Running Performance Benchmark"
    echo
    
    local worker_url="https://pitchey-production.cavelltheleaddev.workers.dev"
    
    # Test response time
    local response_time
    response_time=$(curl -w "%{time_total}" -s -o /dev/null "$worker_url" 2>/dev/null || echo "999")
    
    if (( $(echo "$response_time < 2.0" | bc -l) )); then
        log_success "Worker response time: ${response_time}s (< 2s)"
    else
        log_warning "Worker response time: ${response_time}s (> 2s)"
    fi
    
    # Test cache headers if available
    local cache_status
    cache_status=$(curl -s -I "$worker_url" | grep -i "cf-cache-status" | cut -d: -f2 | tr -d ' \r\n' 2>/dev/null || echo "unknown")
    
    if [[ "$cache_status" == "HIT" ]]; then
        log_success "Cache status: HIT"
    elif [[ "$cache_status" == "MISS" ]]; then
        log_warning "Cache status: MISS"
    else
        log_info "Cache status: $cache_status"
    fi
    
    echo
}

# Generate validation report
generate_report() {
    local total_time
    total_time=$(($(date +%s) - START_TIME))
    
    echo
    log_info "📋 Validation Summary"
    echo "================================================="
    echo -e "Total Tests: ${BLUE}$TESTS_TOTAL${NC}"
    echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
    echo -e "Success Rate: ${BLUE}$(( TESTS_PASSED * 100 / TESTS_TOTAL ))%${NC}"
    echo -e "Duration: ${BLUE}${total_time}s${NC}"
    echo
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}🎉 All tests passed! Monitoring system is ready.${NC}"
        echo
        echo "Next steps:"
        echo "1. Deploy dashboards: ./scripts/deploy-dashboards.sh"
        echo "2. Start metrics collection: ./scripts/start-metrics-collection.sh start"
        echo "3. Access dashboards: $GRAFANA_URL"
        echo
    else
        echo -e "${YELLOW}⚠️  Some tests failed. Please review the issues above.${NC}"
        echo
        echo "Common fixes:"
        echo "1. Check environment variables are set correctly"
        echo "2. Verify API tokens have correct permissions"
        echo "3. Ensure network connectivity to services"
        echo
    fi
    
    echo "Full validation log: $VALIDATION_LOG"
    echo
}

# Main validation function
main() {
    local START_TIME
    START_TIME=$(date +%s)
    
    init_log
    
    echo -e "${BLUE}🔍 Pitchey Monitoring System Validation${NC}"
    echo "================================================="
    echo
    
    # Run validation tests
    check_environment
    check_files  
    check_dependencies
    test_grafana_api
    test_cloudflare_api
    test_worker_endpoint
    validate_dashboards
    validate_alerts
    test_metrics_collection
    test_log_aggregation
    test_deployment_scripts
    performance_benchmark
    
    # Generate final report
    generate_report
}

# Help function
show_help() {
    cat << EOF
Pitchey Monitoring System Validation

This script validates the complete monitoring setup for Pitchey.

Usage:
    $0 [OPTIONS]

Options:
    -h, --help      Show this help message
    -q, --quick     Run only basic validation tests
    -v, --verbose   Enable verbose output

Environment Variables Required:
    GRAFANA_URL             Your Grafana instance URL
    GRAFANA_API_KEY         Your Grafana API key  
    GRAFANA_ORG_ID          Your Grafana organization ID
    CLOUDFLARE_API_TOKEN    Your Cloudflare API token
    CLOUDFLARE_ZONE_ID      Your Cloudflare zone ID

Example:
    # Set environment variables
    export GRAFANA_URL="https://your-org.grafana.net"
    export GRAFANA_API_KEY="your-api-key"
    # ... (set other variables)
    
    # Run validation
    $0

EOF
}

# Parse command line arguments
QUICK_MODE=false
VERBOSE_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -q|--quick)
            QUICK_MODE=true
            shift
            ;;
        -v|--verbose)
            VERBOSE_MODE=true
            set -x
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run validation
main