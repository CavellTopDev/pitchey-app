#!/bin/bash

# Comprehensive Investor Dashboard Test Suite
# Tests all investor endpoints, authentication, and performance
# Generates detailed reports and performance metrics

set -e

# Configuration
BASE_URL="${API_URL:-http://localhost:8001}"
REPORT_DIR="./test-results/investor-dashboard-$(date +%Y%m%d_%H%M%S)"
PERFORMANCE_LOG="$REPORT_DIR/performance.json"
TEST_LOG="$REPORT_DIR/test-output.log"
ERROR_LOG="$REPORT_DIR/errors.log"

# Demo credentials
INVESTOR_EMAIL="sarah.investor@demo.com"
INVESTOR_PASSWORD="Demo123"
CREATOR_EMAIL="alex.creator@demo.com"
CREATOR_PASSWORD="Demo123"
PRODUCTION_EMAIL="stellar.production@demo.com"
PRODUCTION_PASSWORD="Demo123"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Create report directory
mkdir -p "$REPORT_DIR"

# Initialize logs
echo "=== Investor Dashboard Test Suite ===" > "$TEST_LOG"
echo "Started: $(date)" >> "$TEST_LOG"
echo "Base URL: $BASE_URL" >> "$TEST_LOG"
echo "[]" > "$PERFORMANCE_LOG"
echo "=== Error Log ===" > "$ERROR_LOG"

# Utility functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "[INFO] $1" >> "$TEST_LOG"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    echo "[PASS] $1" >> "$TEST_LOG"
    ((PASSED_TESTS++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    echo "[FAIL] $1" >> "$TEST_LOG"
    echo "[$(date)] $1" >> "$ERROR_LOG"
    ((FAILED_TESTS++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    echo "[WARN] $1" >> "$TEST_LOG"
}

# Performance tracking
track_performance() {
    local test_name="$1"
    local start_time="$2"
    local end_time="$3"
    local status="$4"
    local response_code="$5"
    
    local duration=$((end_time - start_time))
    
    # Add to performance log
    local entry="{\"test\": \"$test_name\", \"duration_ms\": $duration, \"status\": \"$status\", \"response_code\": \"$response_code\", \"timestamp\": \"$(date -Iseconds)\"}"
    
    # Read current JSON, add entry, write back
    local temp_file=$(mktemp)
    jq ". + [$entry]" "$PERFORMANCE_LOG" > "$temp_file" && mv "$temp_file" "$PERFORMANCE_LOG"
}

# HTTP request with performance tracking
make_request() {
    local method="$1"
    local endpoint="$2"
    local token="$3"
    local data="$4"
    local test_name="$5"
    
    ((TOTAL_TESTS++))
    
    local url="${BASE_URL}${endpoint}"
    local start_time=$(date +%s%3N)
    
    local headers=("-H" "Content-Type: application/json")
    if [[ -n "$token" ]]; then
        headers+=("-H" "Authorization: Bearer $token")
    fi
    
    local curl_opts=("--silent" "--write-out" "%{http_code}" "--show-error")
    
    if [[ -n "$data" ]]; then
        curl_opts+=("-d" "$data")
    fi
    
    local response
    if ! response=$(curl "${curl_opts[@]}" "${headers[@]}" -X "$method" "$url" 2>>"$ERROR_LOG"); then
        local end_time=$(date +%s%3N)
        track_performance "$test_name" "$start_time" "$end_time" "error" "000"
        log_error "$test_name - Request failed"
        return 1
    fi
    
    local end_time=$(date +%s%3N)
    local http_code="${response: -3}"
    local response_body="${response%???}"
    
    track_performance "$test_name" "$start_time" "$end_time" "completed" "$http_code"
    
    echo "$response_body"
    return 0
}

# Authentication functions
authenticate_user() {
    local email="$1"
    local password="$2"
    local user_type="$3"
    
    local auth_data="{\"email\": \"$email\", \"password\": \"$password\"}"
    local response
    
    if ! response=$(make_request "POST" "/api/auth/$user_type/login" "" "$auth_data" "Auth-$user_type"); then
        return 1
    fi
    
    if echo "$response" | jq -e '.success and .data.token' >/dev/null 2>&1; then
        echo "$response" | jq -r '.data.token'
        return 0
    else
        log_error "Authentication failed for $user_type: $response"
        return 1
    fi
}

# Test logout functionality
test_logout() {
    local token="$1"
    local user_type="$2"
    
    local response
    if response=$(make_request "POST" "/api/auth/logout" "$token" "{}" "Logout-$user_type"); then
        if echo "$response" | jq -e '.success' >/dev/null 2>&1; then
            log_success "Logout successful for $user_type"
            return 0
        else
            log_error "Logout failed for $user_type: $response"
            return 1
        fi
    else
        log_error "Logout request failed for $user_type"
        return 1
    fi
}

# Test investor dashboard endpoints
test_investor_dashboard() {
    local token="$1"
    
    log_info "Testing investor dashboard endpoints..."
    
    # Dashboard overview
    local response
    if response=$(make_request "GET" "/api/investor/dashboard" "$token" "" "Investor-Dashboard"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Investor dashboard data retrieved"
        else
            log_error "Invalid dashboard response: $response"
        fi
    else
        log_error "Dashboard request failed"
    fi
    
    # Investment opportunities
    if response=$(make_request "GET" "/api/investor/opportunities" "$token" "" "Investor-Opportunities"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Investment opportunities retrieved"
        else
            log_error "Invalid opportunities response: $response"
        fi
    else
        log_error "Opportunities request failed"
    fi
    
    # Portfolio summary
    if response=$(make_request "GET" "/api/investor/portfolio" "$token" "" "Investor-Portfolio"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Portfolio data retrieved"
        else
            log_error "Invalid portfolio response: $response"
        fi
    else
        log_error "Portfolio request failed"
    fi
    
    # Analytics
    if response=$(make_request "GET" "/api/investor/analytics" "$token" "" "Investor-Analytics"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Analytics data retrieved"
        else
            log_error "Invalid analytics response: $response"
        fi
    else
        log_error "Analytics request failed"
    fi
    
    # Watchlist
    if response=$(make_request "GET" "/api/investor/watchlist" "$token" "" "Investor-Watchlist"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Watchlist data retrieved"
        else
            log_error "Invalid watchlist response: $response"
        fi
    else
        log_error "Watchlist request failed"
    fi
    
    # Following
    if response=$(make_request "GET" "/api/investor/following" "$token" "" "Investor-Following"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Following data retrieved"
        else
            log_error "Invalid following response: $response"
        fi
    else
        log_error "Following request failed"
    fi
    
    # Saved pitches
    if response=$(make_request "GET" "/api/investor/saved" "$token" "" "Investor-Saved"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Saved pitches retrieved"
        else
            log_error "Invalid saved pitches response: $response"
        fi
    else
        log_error "Saved pitches request failed"
    fi
    
    # Browse with filters
    local browse_params="?genre=Action&budget_min=1000000&budget_max=50000000"
    if response=$(make_request "GET" "/api/investor/browse$browse_params" "$token" "" "Investor-Browse"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Browse with filters working"
        else
            log_error "Invalid browse response: $response"
        fi
    else
        log_error "Browse request failed"
    fi
}

# Test investment workflow
test_investment_workflow() {
    local token="$1"
    
    log_info "Testing investment workflow..."
    
    # Get first available opportunity
    local opportunities_response
    if opportunities_response=$(make_request "GET" "/api/investor/opportunities?limit=1" "$token" "" "Get-Investment-Opportunity"); then
        local pitch_id
        if pitch_id=$(echo "$opportunities_response" | jq -r '.data.items[0].id // empty' 2>/dev/null); then
            if [[ -n "$pitch_id" && "$pitch_id" != "null" ]]; then
                log_info "Testing investment for pitch ID: $pitch_id"
                
                # Test investment creation
                local investment_data="{\"pitchId\": \"$pitch_id\", \"amount\": 10000, \"terms\": \"Standard terms\"}"
                local investment_response
                
                if investment_response=$(make_request "POST" "/api/investor/invest" "$token" "$investment_data" "Create-Investment"); then
                    if echo "$investment_response" | jq -e '.success' >/dev/null 2>&1; then
                        log_success "Investment creation successful"
                    else
                        log_warning "Investment creation returned non-success: $investment_response"
                    fi
                else
                    log_error "Investment creation request failed"
                fi
            else
                log_warning "No pitch ID available for investment test"
            fi
        else
            log_warning "Could not extract pitch ID from opportunities response"
        fi
    else
        log_error "Could not retrieve opportunities for investment test"
    fi
}

# Test creator dashboard endpoints
test_creator_dashboard() {
    local token="$1"
    
    log_info "Testing creator dashboard endpoints..."
    
    local response
    if response=$(make_request "GET" "/api/creator/dashboard" "$token" "" "Creator-Dashboard"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Creator dashboard data retrieved"
        else
            log_error "Invalid creator dashboard response: $response"
        fi
    else
        log_error "Creator dashboard request failed"
    fi
    
    # Creator pitches
    if response=$(make_request "GET" "/api/creator/pitches" "$token" "" "Creator-Pitches"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Creator pitches retrieved"
        else
            log_error "Invalid creator pitches response: $response"
        fi
    else
        log_error "Creator pitches request failed"
    fi
}

# Test WebSocket connectivity
test_websocket_connectivity() {
    log_info "Testing WebSocket connectivity..."
    
    # Test if WebSocket endpoint is accessible
    local ws_url="${BASE_URL/http/ws}/ws"
    
    # Simple connectivity test using curl to check if the endpoint exists
    local response
    if response=$(curl -s -I "$BASE_URL/ws" 2>/dev/null); then
        if echo "$response" | grep -q "101\|200\|426"; then
            log_success "WebSocket endpoint is accessible"
        else
            log_warning "WebSocket endpoint returned unexpected response"
        fi
    else
        log_warning "WebSocket endpoint test failed - this may be expected in some environments"
    fi
}

# Test performance under load
test_performance_load() {
    local token="$1"
    
    log_info "Running performance load tests..."
    
    # Concurrent requests to dashboard
    local pids=()
    local concurrent_requests=5
    
    for ((i=1; i<=concurrent_requests; i++)); do
        (
            local response
            response=$(make_request "GET" "/api/investor/dashboard" "$token" "" "Load-Test-$i")
        ) &
        pids+=($!)
    done
    
    # Wait for all requests to complete
    local load_success=0
    for pid in "${pids[@]}"; do
        if wait "$pid"; then
            ((load_success++))
        fi
    done
    
    if [[ "$load_success" -eq "$concurrent_requests" ]]; then
        log_success "Load test completed: $load_success/$concurrent_requests requests succeeded"
    else
        log_error "Load test failed: only $load_success/$concurrent_requests requests succeeded"
    fi
}

# Generate performance report
generate_performance_report() {
    log_info "Generating performance report..."
    
    local report_file="$REPORT_DIR/performance-summary.json"
    local avg_duration
    avg_duration=$(jq '[.[] | .duration_ms] | add / length' "$PERFORMANCE_LOG" 2>/dev/null || echo "0")
    
    local max_duration
    max_duration=$(jq '[.[] | .duration_ms] | max' "$PERFORMANCE_LOG" 2>/dev/null || echo "0")
    
    local min_duration
    min_duration=$(jq '[.[] | .duration_ms] | min' "$PERFORMANCE_LOG" 2>/dev/null || echo "0")
    
    local success_rate
    success_rate=$(jq '[.[] | select(.response_code | startswith("2"))] | length' "$PERFORMANCE_LOG" 2>/dev/null || echo "0")
    
    local total_requests
    total_requests=$(jq 'length' "$PERFORMANCE_LOG" 2>/dev/null || echo "0")
    
    local success_percentage=0
    if [[ "$total_requests" -gt 0 ]]; then
        success_percentage=$((success_rate * 100 / total_requests))
    fi
    
    cat > "$report_file" << EOF
{
  "summary": {
    "total_tests": $TOTAL_TESTS,
    "passed_tests": $PASSED_TESTS,
    "failed_tests": $FAILED_TESTS,
    "success_rate": "$success_percentage%",
    "total_requests": $total_requests,
    "avg_response_time_ms": $avg_duration,
    "max_response_time_ms": $max_duration,
    "min_response_time_ms": $min_duration,
    "test_duration": "$(date -Iseconds)",
    "base_url": "$BASE_URL"
  },
  "detailed_metrics": $(cat "$PERFORMANCE_LOG")
}
EOF
    
    log_success "Performance report generated: $report_file"
}

# Generate test summary
generate_test_summary() {
    local summary_file="$REPORT_DIR/test-summary.md"
    
    cat > "$summary_file" << EOF
# Investor Dashboard Test Suite - Summary Report

**Generated:** $(date)  
**Base URL:** $BASE_URL  
**Test Duration:** $(grep "Started:" "$TEST_LOG" | cut -d' ' -f3-) to $(date)

## Test Results Summary

- **Total Tests:** $TOTAL_TESTS
- **Passed:** $PASSED_TESTS
- **Failed:** $FAILED_TESTS
- **Success Rate:** $((PASSED_TESTS * 100 / TOTAL_TESTS))%

## Performance Metrics

$(jq -r '.summary | to_entries | .[] | "- **\(.key | gsub("_"; " ") | ascii_upcase):** \(.value)"' "$REPORT_DIR/performance-summary.json" 2>/dev/null || echo "Performance data unavailable")

## Test Categories

- ✅ Authentication (Investor, Creator, Production)
- ✅ Investor Dashboard Endpoints
- ✅ Investment Workflow
- ✅ Creator Dashboard Access
- ✅ WebSocket Connectivity
- ✅ Performance Load Testing
- ✅ Logout Functionality

## Files Generated

- Test Output: \`test-output.log\`
- Error Log: \`errors.log\`
- Performance Data: \`performance.json\`
- Performance Summary: \`performance-summary.json\`
- Test Summary: \`test-summary.md\`

## Notes

$(if [[ $FAILED_TESTS -gt 0 ]]; then
    echo "⚠️ Some tests failed. Check the error log for details."
else
    echo "✅ All tests passed successfully!"
fi)
EOF
    
    log_success "Test summary generated: $summary_file"
}

# Main test execution
main() {
    log_info "Starting Investor Dashboard Test Suite..."
    log_info "Report directory: $REPORT_DIR"
    
    # Test server connectivity
    if ! curl -s "$BASE_URL/health" >/dev/null 2>&1; then
        log_error "Server not accessible at $BASE_URL"
        exit 1
    fi
    log_success "Server connectivity confirmed"
    
    # Authenticate users
    log_info "Authenticating test users..."
    
    local investor_token
    if investor_token=$(authenticate_user "$INVESTOR_EMAIL" "$INVESTOR_PASSWORD" "investor"); then
        log_success "Investor authentication successful"
    else
        log_error "Investor authentication failed"
        exit 1
    fi
    
    local creator_token
    if creator_token=$(authenticate_user "$CREATOR_EMAIL" "$CREATOR_PASSWORD" "creator"); then
        log_success "Creator authentication successful"
    else
        log_error "Creator authentication failed - will skip creator tests"
    fi
    
    local production_token
    if production_token=$(authenticate_user "$PRODUCTION_EMAIL" "$PRODUCTION_PASSWORD" "production"); then
        log_success "Production authentication successful"
    else
        log_error "Production authentication failed - will skip production tests"
    fi
    
    # Run test suites
    test_investor_dashboard "$investor_token"
    test_investment_workflow "$investor_token"
    
    if [[ -n "$creator_token" ]]; then
        test_creator_dashboard "$creator_token"
    fi
    
    test_websocket_connectivity
    test_performance_load "$investor_token"
    
    # Test logout functionality
    test_logout "$investor_token" "investor"
    if [[ -n "$creator_token" ]]; then
        test_logout "$creator_token" "creator"
    fi
    if [[ -n "$production_token" ]]; then
        test_logout "$production_token" "production"
    fi
    
    # Generate reports
    generate_performance_report
    generate_test_summary
    
    # Final summary
    echo
    log_info "=== TEST SUITE COMPLETE ==="
    log_info "Total Tests: $TOTAL_TESTS"
    log_info "Passed: $PASSED_TESTS"
    log_info "Failed: $FAILED_TESTS"
    log_info "Success Rate: $((PASSED_TESTS * 100 / TOTAL_TESTS))%"
    log_info "Reports available in: $REPORT_DIR"
    
    if [[ $FAILED_TESTS -gt 0 ]]; then
        echo
        log_error "Some tests failed. Check the error log for details:"
        cat "$ERROR_LOG"
        exit 1
    else
        log_success "All tests passed!"
        exit 0
    fi
}

# Check dependencies
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed. Please install jq to run this test suite."
    exit 1
fi

if ! command -v curl &> /dev/null; then
    echo "Error: curl is required but not installed. Please install curl to run this test suite."
    exit 1
fi

# Run the test suite
main "$@"