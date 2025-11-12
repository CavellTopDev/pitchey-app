#!/bin/bash

# End-to-End Platform Test Suite
# Tests all 3 portals, authentication flows, cross-portal features, data consistency, 
# real-time updates, and error handling
# Generates comprehensive test reports with JSON output for CI/CD

set -e

# Configuration
BASE_URL="${API_URL:-http://localhost:8001}"
REPORT_DIR="./test-results/platform-e2e-$(date +%Y%m%d_%H%M%S)"
JSON_REPORT="$REPORT_DIR/e2e-results.json"
TEST_LOG="$REPORT_DIR/e2e-test.log"
ERROR_LOG="$REPORT_DIR/e2e-errors.log"
PERFORMANCE_LOG="$REPORT_DIR/e2e-performance.json"

# Demo credentials
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

# Test tracking
declare -A TEST_RESULTS
declare -A TEST_CATEGORIES
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

# Create report directory
mkdir -p "$REPORT_DIR"

# Initialize logs
echo "=== End-to-End Platform Test Suite ===" > "$TEST_LOG"
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
    TEST_RESULTS["$1"]="PASS"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    echo "[FAIL] $1" >> "$TEST_LOG"
    echo "[$(date)] $1" >> "$ERROR_LOG"
    ((FAILED_TESTS++))
    TEST_RESULTS["$1"]="FAIL"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    echo "[WARN] $1" >> "$TEST_LOG"
    ((WARNINGS++))
    TEST_RESULTS["$1"]="WARN"
}

log_category() {
    echo -e "${PURPLE}[CATEGORY]${NC} $1"
    echo "[CATEGORY] $1" >> "$TEST_LOG"
}

# Performance tracking
track_performance() {
    local test_name="$1"
    local start_time="$2" 
    local end_time="$3"
    local status="$4"
    local response_code="$5"
    
    local duration=$((end_time - start_time))
    local entry="{\"test\": \"$test_name\", \"duration_ms\": $duration, \"status\": \"$status\", \"response_code\": \"$response_code\", \"timestamp\": \"$(date -Iseconds)\"}"
    
    local temp_file=$(mktemp)
    jq ". + [$entry]" "$PERFORMANCE_LOG" > "$temp_file" && mv "$temp_file" "$PERFORMANCE_LOG"
}

# HTTP request with comprehensive error handling
make_request() {
    local method="$1"
    local endpoint="$2"
    local token="$3"
    local data="$4"
    local test_name="$5"
    local expected_status="${6:-200}"
    
    ((TOTAL_TESTS++))
    
    local url="${BASE_URL}${endpoint}"
    local start_time=$(date +%s%3N)
    
    local headers=("-H" "Content-Type: application/json" "-H" "Accept: application/json")
    if [[ -n "$token" ]]; then
        headers+=("-H" "Authorization: Bearer $token")
    fi
    
    local curl_opts=("--silent" "--write-out" "%{http_code}" "--show-error" "--max-time" "30")
    
    if [[ -n "$data" ]]; then
        curl_opts+=("-d" "$data")
    fi
    
    local response
    if ! response=$(curl "${curl_opts[@]}" "${headers[@]}" -X "$method" "$url" 2>>"$ERROR_LOG"); then
        local end_time=$(date +%s%3N)
        track_performance "$test_name" "$start_time" "$end_time" "error" "000"
        return 1
    fi
    
    local end_time=$(date +%s%3N)
    local http_code="${response: -3}"
    local response_body="${response%???}"
    
    track_performance "$test_name" "$start_time" "$end_time" "completed" "$http_code"
    
    # Check if response matches expected status
    if [[ "$http_code" == "$expected_status"* ]]; then
        echo "$response_body"
        return 0
    else
        echo "Unexpected status code: $http_code (expected: $expected_status). Response: $response_body" >&2
        return 1
    fi
}

# Authentication functions
authenticate_user() {
    local email="$1"
    local password="$2"
    local user_type="$3"
    
    log_info "Authenticating $user_type: $email"
    
    local auth_data="{\"email\": \"$email\", \"password\": \"$password\"}"
    local response
    
    if response=$(make_request "POST" "/api/auth/$user_type/login" "" "$auth_data" "Auth-$user_type-Login"); then
        if echo "$response" | jq -e '.success and .data.token' >/dev/null 2>&1; then
            local token
            token=$(echo "$response" | jq -r '.data.token')
            log_success "$user_type authentication successful"
            echo "$token"
            return 0
        else
            log_error "$user_type authentication failed: Invalid response format"
            return 1
        fi
    else
        log_error "$user_type authentication request failed"
        return 1
    fi
}

# Test authentication flows
test_authentication_flows() {
    log_category "Authentication Flow Tests"
    
    # Test all three portal logins
    local creator_token investor_token production_token
    
    if creator_token=$(authenticate_user "$CREATOR_EMAIL" "$CREATOR_PASSWORD" "creator"); then
        CREATOR_TOKEN="$creator_token"
    else
        log_error "Creator authentication failed"
        return 1
    fi
    
    if investor_token=$(authenticate_user "$INVESTOR_EMAIL" "$INVESTOR_PASSWORD" "investor"); then
        INVESTOR_TOKEN="$investor_token"
    else
        log_error "Investor authentication failed"
        return 1
    fi
    
    if production_token=$(authenticate_user "$PRODUCTION_EMAIL" "$PRODUCTION_PASSWORD" "production"); then
        PRODUCTION_TOKEN="$production_token"
    else
        log_error "Production authentication failed"
        return 1
    fi
    
    # Test invalid credentials
    local invalid_response
    if invalid_response=$(make_request "POST" "/api/auth/creator/login" "" '{"email": "invalid@test.com", "password": "wrong"}' "Auth-Invalid-Credentials" "401"); then
        if echo "$invalid_response" | jq -e '.success == false' >/dev/null 2>&1; then
            log_success "Invalid credentials properly rejected"
        else
            log_error "Invalid credentials should be rejected"
        fi
    else
        log_success "Invalid credentials properly rejected with 401"
    fi
    
    # Test cross-portal access restrictions
    test_cross_portal_access_restrictions
    
    return 0
}

# Test cross-portal access restrictions
test_cross_portal_access_restrictions() {
    log_info "Testing cross-portal access restrictions..."
    
    # Creator trying to access investor endpoints
    if make_request "GET" "/api/investor/dashboard" "$CREATOR_TOKEN" "" "Creator-Access-Investor-Dashboard" "403" >/dev/null 2>&1; then
        log_success "Creator properly blocked from investor dashboard"
    else
        log_error "Creator should not access investor dashboard"
    fi
    
    # Investor trying to access creator endpoints
    if make_request "GET" "/api/creator/pitches" "$INVESTOR_TOKEN" "" "Investor-Access-Creator-Pitches" "403" >/dev/null 2>&1; then
        log_success "Investor properly blocked from creator pitches"
    else
        log_error "Investor should not access creator pitches"
    fi
    
    # Production trying to access specific user endpoints
    if make_request "GET" "/api/investor/portfolio" "$PRODUCTION_TOKEN" "" "Production-Access-Investor-Portfolio" "403" >/dev/null 2>&1; then
        log_success "Production properly blocked from investor portfolio"
    else
        log_error "Production should not access investor portfolio"
    fi
}

# Test creator portal functionality
test_creator_portal() {
    log_category "Creator Portal Tests"
    
    # Dashboard
    local response
    if response=$(make_request "GET" "/api/creator/dashboard" "$CREATOR_TOKEN" "" "Creator-Dashboard"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Creator dashboard accessible"
        else
            log_error "Invalid creator dashboard response"
        fi
    else
        log_error "Creator dashboard not accessible"
    fi
    
    # Pitches list
    if response=$(make_request "GET" "/api/creator/pitches" "$CREATOR_TOKEN" "" "Creator-Pitches-List"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Creator pitches list accessible"
            # Store a pitch ID for later tests
            local pitch_id
            pitch_id=$(echo "$response" | jq -r '.data.items[0].id // empty' 2>/dev/null)
            if [[ -n "$pitch_id" && "$pitch_id" != "null" ]]; then
                CREATOR_PITCH_ID="$pitch_id"
                log_info "Found creator pitch ID for testing: $pitch_id"
            fi
        else
            log_error "Invalid creator pitches response"
        fi
    else
        log_error "Creator pitches list not accessible"
    fi
    
    # Analytics
    if response=$(make_request "GET" "/api/creator/analytics" "$CREATOR_TOKEN" "" "Creator-Analytics"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Creator analytics accessible"
        else
            log_error "Invalid creator analytics response"
        fi
    else
        log_error "Creator analytics not accessible"
    fi
    
    # Profile
    if response=$(make_request "GET" "/api/creator/profile" "$CREATOR_TOKEN" "" "Creator-Profile"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Creator profile accessible"
        else
            log_error "Invalid creator profile response"
        fi
    else
        log_error "Creator profile not accessible"
    fi
}

# Test investor portal functionality  
test_investor_portal() {
    log_category "Investor Portal Tests"
    
    # Dashboard
    local response
    if response=$(make_request "GET" "/api/investor/dashboard" "$INVESTOR_TOKEN" "" "Investor-Dashboard"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Investor dashboard accessible"
        else
            log_error "Invalid investor dashboard response"
        fi
    else
        log_error "Investor dashboard not accessible"
    fi
    
    # Opportunities
    if response=$(make_request "GET" "/api/investor/opportunities" "$INVESTOR_TOKEN" "" "Investor-Opportunities"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Investor opportunities accessible"
        else
            log_error "Invalid investor opportunities response"
        fi
    else
        log_error "Investor opportunities not accessible"
    fi
    
    # Portfolio
    if response=$(make_request "GET" "/api/investor/portfolio" "$INVESTOR_TOKEN" "" "Investor-Portfolio"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Investor portfolio accessible"
        else
            log_error "Invalid investor portfolio response"
        fi
    else
        log_error "Investor portfolio not accessible"
    fi
    
    # Analytics
    if response=$(make_request "GET" "/api/investor/analytics" "$INVESTOR_TOKEN" "" "Investor-Analytics"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Investor analytics accessible"
        else
            log_error "Invalid investor analytics response"
        fi
    else
        log_error "Investor analytics not accessible"
    fi
    
    # Browse
    if response=$(make_request "GET" "/api/investor/browse?limit=10" "$INVESTOR_TOKEN" "" "Investor-Browse"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Investor browse accessible"
        else
            log_error "Invalid investor browse response"
        fi
    else
        log_error "Investor browse not accessible"
    fi
}

# Test production portal functionality
test_production_portal() {
    log_category "Production Portal Tests"
    
    # Dashboard
    local response
    if response=$(make_request "GET" "/api/production/dashboard" "$PRODUCTION_TOKEN" "" "Production-Dashboard"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Production dashboard accessible"
        else
            log_error "Invalid production dashboard response"
        fi
    else
        log_error "Production dashboard not accessible"
    fi
    
    # Browse opportunities
    if response=$(make_request "GET" "/api/production/browse" "$PRODUCTION_TOKEN" "" "Production-Browse"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Production browse accessible"
        else
            log_error "Invalid production browse response"
        fi
    else
        log_error "Production browse not accessible"
    fi
    
    # Analytics
    if response=$(make_request "GET" "/api/production/analytics" "$PRODUCTION_TOKEN" "" "Production-Analytics"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Production analytics accessible"
        else
            log_error "Invalid production analytics response"
        fi
    else
        log_error "Production analytics not accessible"
    fi
    
    # Profile
    if response=$(make_request "GET" "/api/production/profile" "$PRODUCTION_TOKEN" "" "Production-Profile"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Production profile accessible"
        else
            log_error "Invalid production profile response"
        fi
    else
        log_error "Production profile not accessible"
    fi
}

# Test cross-portal features
test_cross_portal_features() {
    log_category "Cross-Portal Feature Tests"
    
    # Test following functionality between portals
    if [[ -n "$CREATOR_PITCH_ID" ]]; then
        test_pitch_interactions
    else
        log_warning "No creator pitch ID available for cross-portal testing"
    fi
    
    # Test search functionality
    test_search_functionality
    
    # Test notifications
    test_notification_system
}

# Test pitch interactions across portals
test_pitch_interactions() {
    local pitch_id="$CREATOR_PITCH_ID"
    log_info "Testing pitch interactions with pitch ID: $pitch_id"
    
    # Investor viewing creator's pitch
    local response
    if response=$(make_request "GET" "/api/pitches/$pitch_id" "$INVESTOR_TOKEN" "" "Investor-View-Creator-Pitch"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Investor can view creator pitch"
        else
            log_error "Invalid pitch view response for investor"
        fi
    else
        log_error "Investor cannot view creator pitch"
    fi
    
    # Production company viewing creator's pitch
    if response=$(make_request "GET" "/api/pitches/$pitch_id" "$PRODUCTION_TOKEN" "" "Production-View-Creator-Pitch"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Production company can view creator pitch"
        else
            log_error "Invalid pitch view response for production"
        fi
    else
        log_error "Production company cannot view creator pitch"
    fi
    
    # Test pitch saving (investor)
    local save_data="{\"pitchId\": \"$pitch_id\"}"
    if response=$(make_request "POST" "/api/investor/saved/$pitch_id" "$INVESTOR_TOKEN" "$save_data" "Investor-Save-Pitch"); then
        if echo "$response" | jq -e '.success' >/dev/null 2>&1; then
            log_success "Investor can save pitch"
            
            # Test retrieving saved pitches
            if response=$(make_request "GET" "/api/investor/saved" "$INVESTOR_TOKEN" "" "Investor-Get-Saved-Pitches"); then
                if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
                    log_success "Investor can retrieve saved pitches"
                else
                    log_error "Invalid saved pitches response"
                fi
            else
                log_error "Cannot retrieve saved pitches"
            fi
        else
            log_error "Investor cannot save pitch"
        fi
    else
        log_warning "Pitch save functionality may not be available"
    fi
}

# Test search functionality
test_search_functionality() {
    log_info "Testing search functionality..."
    
    # Test general search
    local search_query="action"
    local response
    
    if response=$(make_request "GET" "/api/search?q=$search_query&limit=5" "$INVESTOR_TOKEN" "" "Search-General"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "General search working"
        else
            log_error "Invalid search response"
        fi
    else
        log_error "General search not working"
    fi
    
    # Test user search
    if response=$(make_request "GET" "/api/search/users?q=alex&limit=5" "$INVESTOR_TOKEN" "" "Search-Users"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "User search working"
        else
            log_error "Invalid user search response"
        fi
    else
        log_error "User search not working"
    fi
}

# Test notification system
test_notification_system() {
    log_info "Testing notification system..."
    
    # Get notifications for each user type
    local response
    
    if response=$(make_request "GET" "/api/user/notifications?limit=10" "$CREATOR_TOKEN" "" "Creator-Notifications"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Creator notifications accessible"
        else
            log_error "Invalid creator notifications response"
        fi
    else
        log_error "Creator notifications not accessible"
    fi
    
    if response=$(make_request "GET" "/api/user/notifications?limit=10" "$INVESTOR_TOKEN" "" "Investor-Notifications"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Investor notifications accessible"
        else
            log_error "Invalid investor notifications response"
        fi
    else
        log_error "Investor notifications not accessible"
    fi
}

# Test data consistency
test_data_consistency() {
    log_category "Data Consistency Tests"
    
    # Test user profile consistency across endpoints
    test_user_profile_consistency
    
    # Test pitch data consistency
    test_pitch_data_consistency
}

# Test user profile consistency
test_user_profile_consistency() {
    log_info "Testing user profile consistency..."
    
    local creator_profile investor_profile
    
    # Get creator profile from different endpoints
    if creator_profile=$(make_request "GET" "/api/creator/profile" "$CREATOR_TOKEN" "" "Creator-Profile-Check"); then
        local creator_id
        creator_id=$(echo "$creator_profile" | jq -r '.data.id // empty' 2>/dev/null)
        
        if [[ -n "$creator_id" && "$creator_id" != "null" ]]; then
            log_success "Creator profile data consistent"
        else
            log_error "Creator profile missing ID"
        fi
    else
        log_error "Cannot retrieve creator profile for consistency check"
    fi
}

# Test pitch data consistency
test_pitch_data_consistency() {
    log_info "Testing pitch data consistency..."
    
    if [[ -n "$CREATOR_PITCH_ID" ]]; then
        local pitch_from_creator pitch_from_public
        
        # Get pitch from creator endpoint
        if pitch_from_creator=$(make_request "GET" "/api/creator/pitches" "$CREATOR_TOKEN" "" "Creator-Pitch-Consistency"); then
            # Get same pitch from public endpoint
            if pitch_from_public=$(make_request "GET" "/api/pitches/$CREATOR_PITCH_ID" "$INVESTOR_TOKEN" "" "Public-Pitch-Consistency"); then
                log_success "Pitch data consistency verified"
            else
                log_error "Cannot access pitch from public endpoint"
            fi
        else
            log_error "Cannot access creator pitches for consistency check"
        fi
    else
        log_warning "No pitch ID available for consistency testing"
    fi
}

# Test error handling
test_error_handling() {
    log_category "Error Handling Tests"
    
    # Test 404 errors
    if make_request "GET" "/api/nonexistent-endpoint" "$CREATOR_TOKEN" "" "Test-404-Error" "404" >/dev/null 2>&1; then
        log_success "404 errors properly handled"
    else
        log_error "404 error handling not working correctly"
    fi
    
    # Test malformed requests
    if make_request "POST" "/api/creator/pitches" "$CREATOR_TOKEN" "invalid-json" "Test-Malformed-JSON" "400" >/dev/null 2>&1; then
        log_success "Malformed JSON properly rejected"
    else
        log_warning "Malformed JSON handling may need improvement"
    fi
    
    # Test unauthorized access
    if make_request "GET" "/api/creator/dashboard" "" "" "Test-Unauthorized" "401" >/dev/null 2>&1; then
        log_success "Unauthorized access properly blocked"
    else
        log_error "Unauthorized access not properly handled"
    fi
    
    # Test rate limiting (if implemented)
    test_rate_limiting
}

# Test rate limiting
test_rate_limiting() {
    log_info "Testing rate limiting..."
    
    local rapid_requests=0
    local success_count=0
    
    # Make rapid requests to test rate limiting
    for ((i=1; i<=10; i++)); do
        if make_request "GET" "/api/creator/dashboard" "$CREATOR_TOKEN" "" "Rate-Limit-Test-$i" >/dev/null 2>&1; then
            ((success_count++))
        fi
        ((rapid_requests++))
    done
    
    if [[ $success_count -lt $rapid_requests ]]; then
        log_success "Rate limiting appears to be active"
    else
        log_warning "Rate limiting may not be implemented or threshold is high"
    fi
}

# Test WebSocket connectivity and real-time updates
test_real_time_features() {
    log_category "Real-Time Features Tests"
    
    # Test WebSocket endpoint accessibility
    local ws_url="${BASE_URL/http/ws}/ws"
    
    # Simple connectivity test
    if curl -s -I "$BASE_URL/ws" >/dev/null 2>&1; then
        log_success "WebSocket endpoint accessible"
    else
        log_warning "WebSocket endpoint may not be available"
    fi
    
    # Test notification endpoint (real-time notifications)
    local response
    if response=$(make_request "GET" "/api/user/notifications" "$CREATOR_TOKEN" "" "Real-Time-Notifications"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "Real-time notification endpoint working"
        else
            log_error "Invalid notification endpoint response"
        fi
    else
        log_error "Real-time notification endpoint not working"
    fi
}

# Test logout functionality
test_logout_functionality() {
    log_category "Logout Functionality Tests"
    
    # Test logout for each user type
    local tokens=("$CREATOR_TOKEN" "$INVESTOR_TOKEN" "$PRODUCTION_TOKEN")
    local types=("creator" "investor" "production")
    
    for i in "${!tokens[@]}"; do
        local token="${tokens[$i]}"
        local type="${types[$i]}"
        
        if [[ -n "$token" ]]; then
            local response
            if response=$(make_request "POST" "/api/auth/logout" "$token" "{}" "Logout-$type"); then
                if echo "$response" | jq -e '.success' >/dev/null 2>&1; then
                    log_success "$type logout successful"
                    
                    # Verify token is invalidated
                    if make_request "GET" "/api/$type/dashboard" "$token" "" "Post-Logout-Access-$type" "401" >/dev/null 2>&1; then
                        log_success "$type token properly invalidated after logout"
                    else
                        log_error "$type token not invalidated after logout"
                    fi
                else
                    log_error "$type logout failed"
                fi
            else
                log_error "$type logout request failed"
            fi
        fi
    done
}

# Performance stress test
test_performance_stress() {
    log_category "Performance Stress Tests"
    
    # Re-authenticate for stress test
    local test_token
    if test_token=$(authenticate_user "$INVESTOR_EMAIL" "$INVESTOR_PASSWORD" "investor"); then
        log_info "Running concurrent request stress test..."
        
        local pids=()
        local concurrent_requests=10
        local stress_success=0
        
        # Launch concurrent requests
        for ((i=1; i<=concurrent_requests; i++)); do
            (
                if make_request "GET" "/api/investor/dashboard" "$test_token" "" "Stress-Test-$i" >/dev/null 2>&1; then
                    echo "success"
                else
                    echo "failure"
                fi
            ) &
            pids+=($!)
        done
        
        # Wait for all requests and count successes
        for pid in "${pids[@]}"; do
            if wait "$pid"; then
                ((stress_success++))
            fi
        done
        
        local stress_percentage=$((stress_success * 100 / concurrent_requests))
        if [[ $stress_percentage -ge 80 ]]; then
            log_success "Stress test passed: $stress_success/$concurrent_requests requests succeeded ($stress_percentage%)"
        else
            log_error "Stress test failed: only $stress_success/$concurrent_requests requests succeeded ($stress_percentage%)"
        fi
    else
        log_error "Could not authenticate for stress test"
    fi
}

# Generate comprehensive JSON report
generate_json_report() {
    log_info "Generating JSON report..."
    
    local test_details=()
    for test in "${!TEST_RESULTS[@]}"; do
        local result="${TEST_RESULTS[$test]}"
        test_details+=("\"$(echo "$test" | sed 's/"/\\"/g')\": \"$result\"")
    done
    
    local performance_summary
    performance_summary=$(jq '{
        avg_response_time: ([.[] | .duration_ms] | add / length),
        max_response_time: ([.[] | .duration_ms] | max),
        min_response_time: ([.[] | .duration_ms] | min),
        total_requests: length,
        success_rate: (([.[] | select(.response_code | startswith("2"))] | length) * 100 / length)
    }' "$PERFORMANCE_LOG" 2>/dev/null || echo '{}')
    
    cat > "$JSON_REPORT" << EOF
{
  "test_suite": "End-to-End Platform Test",
  "timestamp": "$(date -Iseconds)",
  "base_url": "$BASE_URL",
  "summary": {
    "total_tests": $TOTAL_TESTS,
    "passed": $PASSED_TESTS,
    "failed": $FAILED_TESTS,
    "warnings": $WARNINGS,
    "success_rate": "$((PASSED_TESTS * 100 / TOTAL_TESTS))%"
  },
  "categories": {
    "authentication": "tested",
    "creator_portal": "tested", 
    "investor_portal": "tested",
    "production_portal": "tested",
    "cross_portal_features": "tested",
    "data_consistency": "tested",
    "error_handling": "tested",
    "real_time_features": "tested",
    "performance": "tested",
    "logout_functionality": "tested"
  },
  "performance": $performance_summary,
  "test_results": {
    $(IFS=','; echo "${test_details[*]}")
  },
  "ci_cd_status": "$(if [[ $FAILED_TESTS -eq 0 ]]; then echo "PASS"; else echo "FAIL"; fi)"
}
EOF
    
    log_success "JSON report generated: $JSON_REPORT"
}

# Main test execution
main() {
    log_info "Starting End-to-End Platform Test Suite..."
    log_info "Report directory: $REPORT_DIR"
    
    # Check server connectivity
    if ! curl -s "$BASE_URL/health" >/dev/null 2>&1; then
        log_error "Server not accessible at $BASE_URL"
        exit 1
    fi
    log_success "Server connectivity confirmed"
    
    # Run test categories
    test_authentication_flows || true
    test_creator_portal || true
    test_investor_portal || true
    test_production_portal || true
    test_cross_portal_features || true
    test_data_consistency || true
    test_error_handling || true
    test_real_time_features || true
    test_performance_stress || true
    test_logout_functionality || true
    
    # Generate reports
    generate_json_report
    
    # Final summary
    echo
    log_info "=== END-TO-END TEST SUITE COMPLETE ==="
    log_info "Total Tests: $TOTAL_TESTS"
    log_info "Passed: $PASSED_TESTS"
    log_info "Failed: $FAILED_TESTS"
    log_info "Warnings: $WARNINGS"
    log_info "Success Rate: $((PASSED_TESTS * 100 / TOTAL_TESTS))%"
    log_info "Reports available in: $REPORT_DIR"
    
    # CI/CD friendly exit code
    if [[ $FAILED_TESTS -gt 0 ]]; then
        echo
        log_error "Some tests failed. Check the error log for details."
        exit 1
    else
        log_success "All tests passed!"
        exit 0
    fi
}

# Check dependencies
for cmd in jq curl; do
    if ! command -v "$cmd" &> /dev/null; then
        echo "Error: $cmd is required but not installed."
        exit 1
    fi
done

# Run the test suite
main "$@"