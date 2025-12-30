#!/bin/bash

# Pitchey Platform - Comprehensive Endpoint Testing Script
# Tests all critical API endpoints with proper authentication

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_FILE="$SCRIPT_DIR/test-results-$(date +%Y%m%d_%H%M%S).json"
FAILED_TESTS_FILE="$SCRIPT_DIR/failed-tests-$(date +%Y%m%d_%H%M%S).log"

# Default values
ENVIRONMENT="production"
BASE_URL=""
TEST_TYPE="full"
TIMEOUT=30
VERBOSE=false
AUTH_TOKEN=""

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test demo credentials
DEMO_CREATOR_EMAIL="alex.creator@demo.com"
DEMO_INVESTOR_EMAIL="sarah.investor@demo.com"
DEMO_PRODUCTION_EMAIL="stellar.production@demo.com"
DEMO_PASSWORD="Demo123"

function show_help() {
    cat << EOF
Pitchey Platform Endpoint Testing Script

Usage: $0 [OPTIONS]

OPTIONS:
    --environment=ENV    Set environment (production, staging, local) [default: production]
    --url=URL           Override base URL
    --test-type=TYPE    Test type (full, health, auth, core) [default: full]
    --timeout=SEC       Request timeout in seconds [default: 30]
    --verbose           Enable verbose output
    --help              Show this help message

ENVIRONMENTS:
    production          https://pitchey-api-prod.ndlovucavelle.workers.dev
    staging             https://pitchey-staging.ndlovucavelle.workers.dev
    local               http://localhost:8001

EXAMPLES:
    $0                                          # Full production test
    $0 --environment=local --test-type=auth     # Local auth tests only
    $0 --url=https://custom-url.com --verbose   # Custom URL with verbose output
EOF
}

function log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

function log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

function log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

function log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    echo "$(date): [FAIL] $1" >> "$FAILED_TESTS_FILE"
}

function increment_test() {
    ((TOTAL_TESTS++))
}

function increment_passed() {
    ((PASSED_TESTS++))
}

function increment_failed() {
    ((FAILED_TESTS++))
}

function setup_environment() {
    case "$ENVIRONMENT" in
        "production")
            BASE_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
            ;;
        "staging")
            BASE_URL="https://pitchey-staging.ndlovucavelle.workers.dev"
            ;;
        "local")
            BASE_URL="http://localhost:8001"
            ;;
        *)
            if [[ -z "$BASE_URL" ]]; then
                log_error "Unknown environment: $ENVIRONMENT. Use --url to specify base URL."
                exit 1
            fi
            ;;
    esac

    log_info "Testing environment: $ENVIRONMENT"
    log_info "Base URL: $BASE_URL"
    log_info "Test type: $TEST_TYPE"
    log_info "Timeout: ${TIMEOUT}s"
    echo
}

function make_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local auth_header="$4"
    local expected_status="$5"
    
    local url="${BASE_URL}${endpoint}"
    local curl_opts="-s -w '%{http_code}|%{time_total}' --max-time $TIMEOUT"
    
    if [[ -n "$auth_header" ]]; then
        curl_opts="$curl_opts -H 'Authorization: Bearer $auth_header'"
    fi
    
    if [[ -n "$data" ]]; then
        curl_opts="$curl_opts -H 'Content-Type: application/json' -d '$data'"
    fi
    
    local response
    response=$(eval "curl $curl_opts -X $method '$url'" 2>/dev/null || echo "ERROR|0")
    
    local http_code="${response##*|}"
    local response_time="${response%|*}"
    response_time="${response_time%|*}"
    local body="${response%|*|*}"
    
    if [[ "$response" == "ERROR|0" ]]; then
        echo "NETWORK_ERROR|0|Request failed - connection error or timeout"
        return 1
    fi
    
    echo "$http_code|$response_time|$body"
}

function test_endpoint() {
    local test_name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local auth_token="$5"
    local expected_status="$6"
    
    increment_test
    
    if [[ "$VERBOSE" == "true" ]]; then
        log_info "Testing: $test_name ($method $endpoint)"
    fi
    
    local result
    result=$(make_request "$method" "$endpoint" "$data" "$auth_token" "$expected_status")
    
    local status_code="${result%%|*}"
    local response_time="${result#*|}"
    response_time="${response_time%%|*}"
    local response_body="${result#*|*|}"
    
    # Check if request failed
    if [[ "$status_code" == "NETWORK_ERROR" ]]; then
        log_error "$test_name - Network error or timeout"
        increment_failed
        return 1
    fi
    
    # Check status code
    if [[ "$status_code" == "$expected_status" ]]; then
        log_success "$test_name (${status_code}, ${response_time}s)"
        increment_passed
        
        # Store detailed results
        cat >> "$RESULTS_FILE" << EOF
{
  "test": "$test_name",
  "method": "$method",
  "endpoint": "$endpoint",
  "status": "PASS",
  "status_code": $status_code,
  "response_time": $response_time,
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
},
EOF
        return 0
    else
        log_error "$test_name - Expected $expected_status, got $status_code"
        if [[ "$VERBOSE" == "true" && -n "$response_body" ]]; then
            echo "Response: $response_body"
        fi
        increment_failed
        
        # Store detailed results
        cat >> "$RESULTS_FILE" << EOF
{
  "test": "$test_name",
  "method": "$method", 
  "endpoint": "$endpoint",
  "status": "FAIL",
  "status_code": $status_code,
  "expected_status": $expected_status,
  "response_time": $response_time,
  "response_body": "$response_body",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
},
EOF
        return 1
    fi
}

function authenticate_user() {
    local user_type="$1"
    local email="$2"
    local password="$3"
    
    log_info "Authenticating as $user_type user..."
    
    local auth_data="{\"email\":\"$email\",\"password\":\"$password\"}"
    local result
    result=$(make_request "POST" "/api/auth/$user_type/login" "$auth_data" "" "200")
    
    local status_code="${result%%|*}"
    local response_body="${result#*|*|}"
    
    if [[ "$status_code" == "200" ]]; then
        # Extract token from response (assuming JSON response with token field)
        local token
        token=$(echo "$response_body" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
        
        if [[ -n "$token" ]]; then
            echo "$token"
            return 0
        else
            log_warning "Authentication succeeded but no token found in response"
            return 1
        fi
    else
        log_warning "Authentication failed for $user_type (Status: $status_code)"
        return 1
    fi
}

function test_health_endpoints() {
    log_info "Testing health endpoints..."
    
    test_endpoint "Health Check" "GET" "/api/health" "" "" "200"
}

function test_auth_endpoints() {
    log_info "Testing authentication endpoints..."
    
    # Test login endpoints
    local creator_data="{\"email\":\"$DEMO_CREATOR_EMAIL\",\"password\":\"$DEMO_PASSWORD\"}"
    local investor_data="{\"email\":\"$DEMO_INVESTOR_EMAIL\",\"password\":\"$DEMO_PASSWORD\"}"
    local production_data="{\"email\":\"$DEMO_PRODUCTION_EMAIL\",\"password\":\"$DEMO_PASSWORD\"}"
    
    test_endpoint "Creator Login" "POST" "/api/auth/creator/login" "$creator_data" "" "200"
    test_endpoint "Investor Login" "POST" "/api/auth/investor/login" "$investor_data" "" "200" 
    test_endpoint "Production Login" "POST" "/api/auth/production/login" "$production_data" "" "200"
    
    # Test invalid credentials
    local invalid_data="{\"email\":\"invalid@test.com\",\"password\":\"wrong\"}"
    test_endpoint "Invalid Login" "POST" "/api/auth/creator/login" "$invalid_data" "" "401"
    
    # Get auth token for further testing
    AUTH_TOKEN=$(authenticate_user "creator" "$DEMO_CREATOR_EMAIL" "$DEMO_PASSWORD" 2>/dev/null || echo "")
}

function test_pitch_endpoints() {
    log_info "Testing pitch endpoints..."
    
    # Public endpoints (no auth required)
    test_endpoint "Browse Pitches Enhanced" "GET" "/api/pitches/browse/enhanced" "" "" "200"
    test_endpoint "Public Pitches" "GET" "/api/pitches/public" "" "" "200"
    
    # Test with query parameters
    test_endpoint "Browse with Filters" "GET" "/api/pitches/browse/enhanced?limit=5&genre=action" "" "" "200"
    test_endpoint "Browse Trending" "GET" "/api/pitches/browse/enhanced?sort=trending" "" "" "200"
    
    if [[ -n "$AUTH_TOKEN" ]]; then
        # Authenticated endpoints
        test_endpoint "Create Pitch" "POST" "/api/pitches/create" \
            '{"title":"Test Pitch","genre":"Action","logline":"A test pitch for endpoint verification"}' \
            "$AUTH_TOKEN" "201"
        
        test_endpoint "User Pitches" "GET" "/api/pitches/user" "" "$AUTH_TOKEN" "200"
    fi
}

function test_user_endpoints() {
    log_info "Testing user endpoints..."
    
    if [[ -n "$AUTH_TOKEN" ]]; then
        test_endpoint "User Profile" "GET" "/api/user/profile" "" "$AUTH_TOKEN" "200"
        test_endpoint "User Stats" "GET" "/api/user/stats" "" "$AUTH_TOKEN" "200"
        
        # Test profile update
        test_endpoint "Update Profile" "PUT" "/api/user/profile" \
            '{"bio":"Updated bio for testing"}' \
            "$AUTH_TOKEN" "200"
    fi
}

function test_follow_endpoints() {
    log_info "Testing follow endpoints..."
    
    if [[ -n "$AUTH_TOKEN" ]]; then
        # Test follow/unfollow (using demo user IDs)
        test_endpoint "Follow User" "POST" "/api/follows/follow" \
            '{"targetType":"user","targetId":2}' \
            "$AUTH_TOKEN" "200"
        
        test_endpoint "Follow Stats" "GET" "/api/follows/stats?userId=1" "" "$AUTH_TOKEN" "200"
        
        test_endpoint "Unfollow User" "POST" "/api/follows/unfollow" \
            '{"targetType":"user","targetId":2}' \
            "$AUTH_TOKEN" "200"
        
        # Test legacy format for backward compatibility
        test_endpoint "Follow Legacy Format" "POST" "/api/follows/follow" \
            '{"creatorId":2}' \
            "$AUTH_TOKEN" "200"
    fi
}

function test_nda_endpoints() {
    log_info "Testing NDA endpoints..."
    
    if [[ -n "$AUTH_TOKEN" ]]; then
        test_endpoint "Request NDA" "POST" "/api/nda/request" \
            '{"pitchId":1,"requestMessage":"Test NDA request"}' \
            "$AUTH_TOKEN" "200"
        
        test_endpoint "Signed NDAs" "GET" "/api/nda/signed" "" "$AUTH_TOKEN" "200"
    fi
}

function test_dashboard_endpoints() {
    log_info "Testing dashboard endpoints..."
    
    # Get different user type tokens for dashboard testing
    local creator_token investor_token production_token
    
    creator_token=$(authenticate_user "creator" "$DEMO_CREATOR_EMAIL" "$DEMO_PASSWORD" 2>/dev/null || echo "")
    investor_token=$(authenticate_user "investor" "$DEMO_INVESTOR_EMAIL" "$DEMO_PASSWORD" 2>/dev/null || echo "")
    production_token=$(authenticate_user "production" "$DEMO_PRODUCTION_EMAIL" "$DEMO_PASSWORD" 2>/dev/null || echo "")
    
    if [[ -n "$creator_token" ]]; then
        test_endpoint "Creator Dashboard" "GET" "/api/creator/dashboard" "" "$creator_token" "200"
    fi
    
    if [[ -n "$investor_token" ]]; then
        test_endpoint "Investor Dashboard" "GET" "/api/investor/dashboard" "" "$investor_token" "200"
    fi
    
    if [[ -n "$production_token" ]]; then
        test_endpoint "Production Dashboard" "GET" "/api/production/dashboard" "" "$production_token" "200"
    fi
}

function test_error_endpoints() {
    log_info "Testing error handling..."
    
    # Test 404 endpoints
    test_endpoint "Non-existent Endpoint" "GET" "/api/nonexistent" "" "" "404"
    
    # Test method not allowed
    test_endpoint "Invalid Method" "PUT" "/api/health" "" "" "405"
    
    # Test malformed JSON
    test_endpoint "Malformed JSON" "POST" "/api/auth/creator/login" "invalid-json" "" "400"
}

function run_all_tests() {
    echo "# Pitchey Platform Test Results" > "$RESULTS_FILE"
    echo "# Started at: $(date)" >> "$RESULTS_FILE"
    echo "[" >> "$RESULTS_FILE"
    
    case "$TEST_TYPE" in
        "health")
            test_health_endpoints
            ;;
        "auth")
            test_health_endpoints
            test_auth_endpoints
            ;;
        "core")
            test_health_endpoints
            test_auth_endpoints
            test_pitch_endpoints
            test_user_endpoints
            ;;
        "full"|*)
            test_health_endpoints
            test_auth_endpoints
            test_pitch_endpoints
            test_user_endpoints
            test_follow_endpoints
            test_nda_endpoints
            test_dashboard_endpoints
            test_error_endpoints
            ;;
    esac
    
    # Close JSON array (remove last comma)
    sed -i '$ s/,$//' "$RESULTS_FILE" 2>/dev/null || true
    echo "]" >> "$RESULTS_FILE"
}

function generate_report() {
    echo
    echo "========================================="
    echo "         TEST EXECUTION SUMMARY"
    echo "========================================="
    echo
    echo -e "Environment:      ${BLUE}$ENVIRONMENT${NC}"
    echo -e "Base URL:         ${BLUE}$BASE_URL${NC}"
    echo -e "Test Type:        ${BLUE}$TEST_TYPE${NC}"
    echo
    echo -e "Total Tests:      ${BLUE}$TOTAL_TESTS${NC}"
    echo -e "Passed:           ${GREEN}$PASSED_TESTS${NC}"
    echo -e "Failed:           ${RED}$FAILED_TESTS${NC}"
    
    local success_rate=0
    if [[ $TOTAL_TESTS -gt 0 ]]; then
        success_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    fi
    
    echo -e "Success Rate:     ${BLUE}${success_rate}%${NC}"
    echo
    
    if [[ $FAILED_TESTS -gt 0 ]]; then
        echo -e "${RED}⚠️  Some tests failed. Check $FAILED_TESTS_FILE for details.${NC}"
        echo
    fi
    
    echo "Detailed results: $RESULTS_FILE"
    
    if [[ -f "$FAILED_TESTS_FILE" && -s "$FAILED_TESTS_FILE" ]]; then
        echo "Failed tests log: $FAILED_TESTS_FILE"
    fi
    
    echo
    echo "========================================="
    
    # Return appropriate exit code
    if [[ $FAILED_TESTS -gt 0 ]]; then
        return 1
    else
        return 0
    fi
}

function cleanup() {
    # Clean up any temporary files or connections if needed
    true
}

function main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --environment=*)
                ENVIRONMENT="${1#*=}"
                shift
                ;;
            --url=*)
                BASE_URL="${1#*=}"
                shift
                ;;
            --test-type=*)
                TEST_TYPE="${1#*=}"
                shift
                ;;
            --timeout=*)
                TIMEOUT="${1#*=}"
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown parameter: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Setup trap for cleanup
    trap cleanup EXIT
    
    # Banner
    echo
    echo "==========================================="
    echo "    Pitchey Platform Endpoint Testing"
    echo "==========================================="
    echo
    
    # Initialize environment
    setup_environment
    
    # Run tests
    run_all_tests
    
    # Generate final report
    generate_report
}

# Only run main if script is executed directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi