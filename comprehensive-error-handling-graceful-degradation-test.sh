#!/bin/bash

# Comprehensive Error Handling and Graceful Degradation Test Suite
# Tests system behavior under error conditions and edge cases
# Validates proper error responses and fallback mechanisms
# Server: localhost:8001

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
API_BASE="http://localhost:8001"
VERBOSE=${VERBOSE:-false}

# Test accounts
CREATOR_EMAIL="alex.creator@demo.com"
CREATOR_PASSWORD="Demo123"
INVESTOR_EMAIL="sarah.investor@demo.com"
INVESTOR_PASSWORD="Demo123"

# Global variables
CREATOR_TOKEN=""
INVESTOR_TOKEN=""
TEST_PITCH_ID=""

# Test tracking
TOTAL_ERROR_TESTS=0
PASSED_ERROR_TESTS=0
FAILED_ERROR_TESTS=0
GRACEFUL_RESPONSES=()
UNGRACEFUL_RESPONSES=()

# Utility functions
log_error_test_start() {
    echo -e "\n${PURPLE}🛠️ Error Handling Test: $1${NC}"
    ((TOTAL_ERROR_TESTS++))
}

log_graceful_handling() {
    echo -e "${GREEN}✅ Graceful: $1${NC}"
    ((PASSED_ERROR_TESTS++))
    GRACEFUL_RESPONSES+=("$1")
}

log_ungraceful_handling() {
    echo -e "${RED}❌ Ungraceful: $1${NC}"
    ((FAILED_ERROR_TESTS++))
    UNGRACEFUL_RESPONSES+=("$1")
}

log_step() {
    echo -e "${BLUE}  → $1${NC}"
}

log_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# HTTP request helper with detailed error analysis
api_request_with_analysis() {
    local method="$1"
    local endpoint="$2"
    local token="$3"
    local data="$4"
    local expected_status="$5"
    local test_description="$6"
    
    local url="${API_BASE}${endpoint}"
    local headers=("Content-Type: application/json")
    
    if [[ -n "$token" ]]; then
        headers+=("Authorization: Bearer $token")
    fi
    
    local curl_cmd="curl -s -X $method"
    for header in "${headers[@]}"; do
        curl_cmd+=" -H \"$header\""
    done
    
    if [[ -n "$data" ]]; then
        curl_cmd+=" -d '$data'"
    fi
    
    curl_cmd+=" -w \"HTTPSTATUS:%{http_code}\" \"$url\""
    
    local response
    response=$(eval "$curl_cmd" 2>/dev/null || echo "CURL_ERROR")
    
    if [[ "$response" == "CURL_ERROR" ]]; then
        log_step "Network error occurred - testing connection recovery"
        log_ungraceful_handling "$test_description - Network error not handled gracefully"
        return 1
    fi
    
    local body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]+$//')
    local status=$(echo "$response" | grep -o 'HTTPSTATUS:[0-9]*$' | cut -d: -f2)
    
    # Analyze error response structure
    local error_analysis_passed=true
    
    if [[ "$status" == "$expected_status" ]]; then
        # Check error response structure
        if [[ $expected_status -ge 400 ]]; then
            # Should have proper error structure
            if echo "$body" | grep -q "\"error\"\|\"message\""; then
                log_step "✓ Proper error structure in response"
            else
                error_analysis_passed=false
                log_step "✗ Error response lacks proper structure"
            fi
            
            # Should not expose sensitive information
            if echo "$body" | grep -qiE "(password|secret|token|database|sql|stack|trace)"; then
                error_analysis_passed=false
                log_step "✗ Error response exposes sensitive information"
            else
                log_step "✓ No sensitive information exposed in error"
            fi
            
            # Should have user-friendly message
            if echo "$body" | grep -q "\"message\""; then
                local message=$(echo "$body" | grep -o '"message":"[^"]*' | cut -d'"' -f4)
                if [[ ${#message} -gt 5 && ! "$message" =~ ^[0-9]+$ ]]; then
                    log_step "✓ User-friendly error message provided"
                else
                    error_analysis_passed=false
                    log_step "✗ Error message not user-friendly"
                fi
            fi
        fi
        
        if $error_analysis_passed; then
            log_graceful_handling "$test_description"
            echo "$body"
            return 0
        else
            log_ungraceful_handling "$test_description"
            return 1
        fi
    else
        log_ungraceful_handling "$test_description - Expected $expected_status, got $status"
        if [[ "$VERBOSE" == "true" ]]; then
            echo "Response body: $body" >&2
        fi
        return 1
    fi
}

# Regular API request helper
api_request() {
    local method="$1"
    local endpoint="$2"
    local token="$3"
    local data="$4"
    local expected_status="${5:-200}"
    
    local curl_cmd="curl -s -X $method"
    curl_cmd+=" -H \"Content-Type: application/json\""
    
    if [[ -n "$token" ]]; then
        curl_cmd+=" -H \"Authorization: Bearer $token\""
    fi
    
    if [[ -n "$data" ]]; then
        curl_cmd+=" -d '$data'"
    fi
    
    curl_cmd+=" -w \"HTTPSTATUS:%{http_code}\" \"${API_BASE}${endpoint}\""
    
    local response
    response=$(eval "$curl_cmd")
    
    local body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]+$//')
    local status=$(echo "$response" | grep -o 'HTTPSTATUS:[0-9]*$' | cut -d: -f2)
    
    if [[ "$status" == "$expected_status" ]]; then
        echo "$body"
        return 0
    else
        return 1
    fi
}

# Setup environment for error testing
setup_error_testing_environment() {
    echo -e "${CYAN}🔧 Setting up error handling test environment...${NC}"
    
    # Authenticate users
    local creator_data="{\"email\":\"$CREATOR_EMAIL\",\"password\":\"$CREATOR_PASSWORD\"}"
    if response=$(api_request "POST" "/api/auth/creator/login" "" "$creator_data" "200"); then
        CREATOR_TOKEN=$(echo "$response" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    fi
    
    local investor_data="{\"email\":\"$INVESTOR_EMAIL\",\"password\":\"$INVESTOR_PASSWORD\"}"
    if response=$(api_request "POST" "/api/auth/investor/login" "" "$investor_data" "200"); then
        INVESTOR_TOKEN=$(echo "$response" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    fi
    
    # Create test pitch for error scenarios
    if [[ -n "$CREATOR_TOKEN" ]]; then
        local pitch_data='{
            "title": "Error Handling Test Pitch",
            "logline": "Test pitch for error scenarios",
            "genre": "drama",
            "format": "feature",
            "shortSynopsis": "Error test synopsis"
        }'
        if response=$(api_request "POST" "/api/creator/pitches" "$CREATOR_TOKEN" "$pitch_data" "201"); then
            TEST_PITCH_ID=$(echo "$response" | grep -o '"id":[0-9]*' | cut -d: -f2)
        fi
    fi
    
    echo -e "${CYAN}✓ Error testing environment ready${NC}"
}

# Test 1: Authentication Error Handling
test_authentication_error_handling() {
    log_error_test_start "Authentication Error Scenarios"
    
    # Test 1.1: Invalid credentials
    log_step "Testing invalid login credentials error handling"
    api_request_with_analysis "POST" "/api/auth/login" "" '{"email":"invalid@test.com","password":"wrong"}' "401" \
        "Invalid credentials provide proper error response"
    
    # Test 1.2: Malformed login request
    log_step "Testing malformed authentication request"
    api_request_with_analysis "POST" "/api/auth/login" "" '{"invalid":"data"}' "400" \
        "Malformed auth request handled gracefully"
    
    # Test 1.3: Missing authentication token
    log_step "Testing missing authentication token"
    api_request_with_analysis "GET" "/api/creator/dashboard" "" "" "401" \
        "Missing auth token handled properly"
    
    # Test 1.4: Invalid authentication token
    log_step "Testing invalid authentication token"
    api_request_with_analysis "GET" "/api/profile" "invalid.jwt.token" "" "401" \
        "Invalid auth token handled gracefully"
    
    # Test 1.5: Expired/malformed JWT
    log_step "Testing malformed JWT token"
    api_request_with_analysis "GET" "/api/creator/pitches" "not-a-jwt" "" "401" \
        "Malformed JWT handled properly"
}

# Test 2: Input Validation Error Handling
test_input_validation_error_handling() {
    log_error_test_start "Input Validation Error Scenarios"
    
    if [[ -z "$CREATOR_TOKEN" ]]; then
        log_step "Skipping input validation tests - no creator token"
        return
    fi
    
    # Test 2.1: Missing required fields
    log_step "Testing missing required fields in pitch creation"
    api_request_with_analysis "POST" "/api/creator/pitches" "$CREATOR_TOKEN" '{"title":""}' "400" \
        "Missing required fields handled with proper validation errors"
    
    # Test 2.2: Invalid data types
    log_step "Testing invalid data types"
    api_request_with_analysis "POST" "/api/creator/pitches" "$CREATOR_TOKEN" \
        '{"title":"Test","estimatedBudget":"not-a-number"}' "400" \
        "Invalid data types handled gracefully"
    
    # Test 2.3: Data too long/oversized
    log_step "Testing oversized input data"
    local oversized_title=$(printf 'A%.0s' {1..1000})  # 1000 character title
    api_request_with_analysis "POST" "/api/creator/pitches" "$CREATOR_TOKEN" \
        "{\"title\":\"$oversized_title\",\"logline\":\"test\"}" "400" \
        "Oversized input handled with proper limits"
    
    # Test 2.4: Invalid enum values
    log_step "Testing invalid enum values"
    api_request_with_analysis "POST" "/api/creator/pitches" "$CREATOR_TOKEN" \
        '{"title":"Test","genre":"invalid_genre","format":"invalid_format","logline":"test"}' "400" \
        "Invalid enum values handled with validation errors"
    
    # Test 2.5: SQL injection attempts
    log_step "Testing SQL injection in input"
    api_request_with_analysis "POST" "/api/creator/pitches" "$CREATOR_TOKEN" \
        '{"title":"Test'\'')); DROP TABLE pitches; --","logline":"test"}' "400" \
        "SQL injection attempts handled safely"
}

# Test 3: Resource Not Found Error Handling
test_resource_not_found_handling() {
    log_error_test_start "Resource Not Found Error Scenarios"
    
    # Test 3.1: Non-existent pitch
    log_step "Testing access to non-existent pitch"
    api_request_with_analysis "GET" "/api/pitches/99999" "$CREATOR_TOKEN" "" "404" \
        "Non-existent pitch returns proper 404 error"
    
    # Test 3.2: Non-existent user profile
    log_step "Testing access to non-existent user"
    api_request_with_analysis "GET" "/api/users/99999/profile" "" "" "404" \
        "Non-existent user profile handled gracefully"
    
    # Test 3.3: Non-existent NDA request
    log_step "Testing access to non-existent NDA"
    api_request_with_analysis "GET" "/api/ndas/99999/status" "$INVESTOR_TOKEN" "" "404" \
        "Non-existent NDA handled with proper 404"
    
    # Test 3.4: Invalid endpoint paths
    log_step "Testing invalid endpoint paths"
    api_request_with_analysis "GET" "/api/invalid/endpoint" "" "" "404" \
        "Invalid endpoints return proper 404 responses"
}

# Test 4: Authorization Error Handling
test_authorization_error_handling() {
    log_error_test_start "Authorization Error Scenarios"
    
    if [[ -z "$CREATOR_TOKEN" || -z "$INVESTOR_TOKEN" ]]; then
        log_step "Skipping authorization tests - missing tokens"
        return
    fi
    
    # Test 4.1: Cross-portal access attempts
    log_step "Testing unauthorized cross-portal access"
    api_request_with_analysis "GET" "/api/investor/portfolio" "$CREATOR_TOKEN" "" "403" \
        "Cross-portal access properly denied with 403"
    
    # Test 4.2: Accessing other user's resources
    log_step "Testing access to other user's private resources"
    if [[ -n "$TEST_PITCH_ID" ]]; then
        api_request_with_analysis "PUT" "/api/creator/pitches/$TEST_PITCH_ID" "$INVESTOR_TOKEN" \
            '{"title":"Unauthorized edit"}' "403" \
            "Unauthorized resource modification properly blocked"
    fi
    
    # Test 4.3: Insufficient permissions
    log_step "Testing insufficient permission scenarios"
    api_request_with_analysis "POST" "/api/creator/pitches" "$INVESTOR_TOKEN" \
        '{"title":"Unauthorized creation","logline":"test"}' "403" \
        "Insufficient permissions handled with proper error"
    
    # Test 4.4: Role-based access violations
    log_step "Testing role-based access control"
    api_request_with_analysis "GET" "/api/admin/users" "$CREATOR_TOKEN" "" "403" \
        "Admin-only endpoints properly protected"
}

# Test 5: Rate Limiting and Abuse Error Handling
test_rate_limiting_error_handling() {
    log_error_test_start "Rate Limiting and Abuse Prevention"
    
    # Test 5.1: Rapid successive requests
    log_step "Testing rate limiting on rapid requests"
    local rate_limit_triggered=false
    
    # Make rapid requests to trigger rate limiting
    for i in {1..15}; do
        if response=$(api_request "POST" "/api/auth/login" "" '{"email":"fake@test.com","password":"wrong"}' "401" 2>/dev/null); then
            continue
        elif response=$(api_request "POST" "/api/auth/login" "" '{"email":"fake@test.com","password":"wrong"}' "429" 2>/dev/null); then
            rate_limit_triggered=true
            break
        fi
        sleep 0.1
    done
    
    if $rate_limit_triggered; then
        log_graceful_handling "Rate limiting properly activated on rapid requests"
    else
        log_ungraceful_handling "Rate limiting not properly implemented"
    fi
    
    # Test 5.2: Duplicate resource creation
    if [[ -n "$CREATOR_TOKEN" && -n "$TEST_PITCH_ID" ]]; then
        log_step "Testing duplicate NDA request prevention"
        local nda_data='{"pitchId":'$TEST_PITCH_ID',"message":"Test request","requestType":"basic"}'
        
        # First request
        api_request "POST" "/api/ndas/request" "$INVESTOR_TOKEN" "$nda_data" "201" >/dev/null || 
        api_request "POST" "/api/ndas/request" "$INVESTOR_TOKEN" "$nda_data" "200" >/dev/null || true
        
        # Duplicate request should be handled gracefully
        api_request_with_analysis "POST" "/api/ndas/request" "$INVESTOR_TOKEN" "$nda_data" "409" \
            "Duplicate resource creation handled with proper conflict response"
    fi
}

# Test 6: Database and System Error Handling
test_system_error_handling() {
    log_error_test_start "System and Database Error Scenarios"
    
    # Test 6.1: Invalid ID formats
    log_step "Testing invalid ID formats"
    api_request_with_analysis "GET" "/api/pitches/invalid-id" "$CREATOR_TOKEN" "" "400" \
        "Invalid ID formats handled gracefully"
    
    # Test 6.2: Negative ID values
    log_step "Testing negative ID values"
    api_request_with_analysis "GET" "/api/pitches/-1" "$CREATOR_TOKEN" "" "400" \
        "Negative ID values handled properly"
    
    # Test 6.3: Large number ID values
    log_step "Testing very large ID values"
    api_request_with_analysis "GET" "/api/pitches/999999999999999" "$CREATOR_TOKEN" "" "404" \
        "Large ID values handled without system errors"
    
    # Test 6.4: Special characters in URLs
    log_step "Testing special characters in URL parameters"
    api_request_with_analysis "GET" "/api/pitches/search?q=%3Cscript%3E" "" "" "200" \
        "Special characters in URLs handled safely"
}

# Test 7: Content Type and Format Error Handling
test_content_format_error_handling() {
    log_error_test_start "Content Format and Type Error Scenarios"
    
    # Test 7.1: Invalid JSON format
    log_step "Testing invalid JSON in request body"
    local curl_response=$(curl -s -X POST "${API_BASE}/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"invalid":"json",' \
        -w "HTTPSTATUS:%{http_code}")
    
    local status=$(echo "$curl_response" | grep -o 'HTTPSTATUS:[0-9]*$' | cut -d: -f2)
    if [[ "$status" == "400" ]]; then
        log_graceful_handling "Invalid JSON format handled with 400 error"
    else
        log_ungraceful_handling "Invalid JSON format not handled properly"
    fi
    
    # Test 7.2: Wrong content type
    log_step "Testing wrong content type in requests"
    local curl_response=$(curl -s -X POST "${API_BASE}/api/auth/login" \
        -H "Content-Type: text/plain" \
        -d "not json data" \
        -w "HTTPSTATUS:%{http_code}")
    
    local status=$(echo "$curl_response" | grep -o 'HTTPSTATUS:[0-9]*$' | cut -d: -f2)
    if [[ "$status" == "400" || "$status" == "415" ]]; then
        log_graceful_handling "Wrong content type handled appropriately"
    else
        log_ungraceful_handling "Wrong content type not handled properly"
    fi
    
    # Test 7.3: Empty request body when required
    log_step "Testing empty request body"
    api_request_with_analysis "POST" "/api/auth/login" "" "" "400" \
        "Empty request body handled with validation error"
}

# Test 8: Network and Connection Error Simulation
test_network_error_simulation() {
    log_error_test_start "Network and Connection Error Simulation"
    
    # Test 8.1: Very long URL
    log_step "Testing very long URL handling"
    local long_path=$(printf '/api/pitches/search?q=%s' $(printf 'a%.0s' {1..2000}))
    api_request_with_analysis "GET" "$long_path" "" "" "414" \
        "Very long URLs handled with appropriate error" || 
    api_request_with_analysis "GET" "$long_path" "" "" "400" \
        "Very long URLs handled with client error"
    
    # Test 8.2: Invalid HTTP methods
    log_step "Testing invalid HTTP methods"
    local curl_response=$(curl -s -X INVALID "${API_BASE}/api/health" -w "HTTPSTATUS:%{http_code}")
    local status=$(echo "$curl_response" | grep -o 'HTTPSTATUS:[0-9]*$' | cut -d: -f2)
    
    if [[ "$status" == "405" || "$status" == "400" ]]; then
        log_graceful_handling "Invalid HTTP methods handled appropriately"
    else
        log_ungraceful_handling "Invalid HTTP methods not handled properly"
    fi
}

# Test 9: Graceful Degradation in Data Responses
test_graceful_degradation_responses() {
    log_error_test_start "Graceful Degradation in Data Responses"
    
    # Test 9.1: Partial data availability
    log_step "Testing response structure with missing optional data"
    if [[ -n "$CREATOR_TOKEN" ]]; then
        if response=$(api_request "GET" "/api/creator/dashboard" "$CREATOR_TOKEN" "" "200"); then
            # Check if response provides fallback values for missing data
            if echo "$response" | grep -q "\"overview\"\|\"stats\""; then
                log_graceful_handling "Dashboard provides graceful fallbacks for missing data"
            else
                log_ungraceful_handling "Dashboard doesn't handle missing data gracefully"
            fi
        fi
    fi
    
    # Test 9.2: Empty result sets
    log_step "Testing empty result set handling"
    if response=$(api_request "GET" "/api/pitches/search?q=nonexistentquery123456" "" "" "200"); then
        # Should return empty array, not error
        if echo "$response" | grep -q "\[\]\|\"results\":\[]"; then
            log_graceful_handling "Empty search results handled gracefully"
        else
            log_ungraceful_handling "Empty search results not handled gracefully"
        fi
    fi
    
    # Test 9.3: Configuration data availability
    log_step "Testing configuration endpoint resilience"
    if response=$(api_request "GET" "/api/config/all" "" "" "200"); then
        # Should provide at least basic configuration
        if echo "$response" | grep -q "\"genres\"\|\"formats\""; then
            log_graceful_handling "Configuration data provides resilient defaults"
        else
            log_ungraceful_handling "Configuration data not resilient to failures"
        fi
    fi
}

# Generate comprehensive error handling report
generate_error_handling_report() {
    echo ""
    echo "=================================================================="
    echo "🛠️ COMPREHENSIVE ERROR HANDLING & GRACEFUL DEGRADATION REPORT"
    echo "=================================================================="
    echo "Test Environment: $API_BASE"
    echo "Total Error Scenarios Tested: $TOTAL_ERROR_TESTS"
    echo -e "${GREEN}✅ Graceful Responses: $PASSED_ERROR_TESTS${NC}"
    echo -e "${RED}❌ Ungraceful Responses: $FAILED_ERROR_TESTS${NC}"
    
    local reliability_score=$(( PASSED_ERROR_TESTS * 100 / TOTAL_ERROR_TESTS ))
    
    if [[ $FAILED_ERROR_TESTS -eq 0 ]]; then
        echo -e "${GREEN}🎉 RELIABILITY STATUS: EXCELLENT${NC}"
        echo "System handles all error scenarios gracefully!"
    elif [[ $reliability_score -gt 85 ]]; then
        echo -e "${YELLOW}⚠️ RELIABILITY STATUS: GOOD${NC}"
        echo "Most errors handled well, some improvements needed."
    elif [[ $reliability_score -gt 70 ]]; then
        echo -e "${YELLOW}⚠️ RELIABILITY STATUS: FAIR${NC}"
        echo "Adequate error handling, several areas need improvement."
    else
        echo -e "${RED}❌ RELIABILITY STATUS: POOR${NC}"
        echo "Significant error handling issues need immediate attention."
    fi
    
    echo ""
    echo "=================================================================="
    echo "📊 ERROR HANDLING ANALYSIS"
    echo "=================================================================="
    
    echo ""
    echo -e "${GREEN}✅ GRACEFUL ERROR RESPONSES:${NC}"
    if [[ ${#GRACEFUL_RESPONSES[@]} -gt 0 ]]; then
        printf '   • %s\n' "${GRACEFUL_RESPONSES[@]}"
    else
        echo "   (None - all error handling failed)"
    fi
    
    if [[ ${#UNGRACEFUL_RESPONSES[@]} -gt 0 ]]; then
        echo ""
        echo -e "${RED}❌ UNGRACEFUL ERROR RESPONSES:${NC}"
        printf '   • %s\n' "${UNGRACEFUL_RESPONSES[@]}"
        
        echo ""
        echo "=================================================================="
        echo "🔧 ERROR HANDLING IMPROVEMENTS NEEDED"
        echo "=================================================================="
        echo "1. Fix ungraceful error responses listed above"
        echo "2. Implement proper error message structure"
        echo "3. Add user-friendly error messages"
        echo "4. Prevent sensitive information exposure in errors"
        echo "5. Implement proper HTTP status codes"
        echo "6. Add input validation and sanitization"
        echo "7. Implement rate limiting and abuse prevention"
        echo "8. Add graceful degradation for partial failures"
        echo "9. Improve error logging without exposing internals"
        echo "10. Add proper fallback mechanisms"
    fi
    
    echo ""
    echo "=================================================================="
    echo "🎯 ERROR HANDLING CATEGORIES"
    echo "=================================================================="
    
    local auth_errors=$(printf '%s\n' "${GRACEFUL_RESPONSES[@]}" | grep -c "auth\|login\|token" || echo "0")
    local validation_errors=$(printf '%s\n' "${GRACEFUL_RESPONSES[@]}" | grep -c "validation\|input\|field" || echo "0")
    local resource_errors=$(printf '%s\n' "${GRACEFUL_RESPONSES[@]}" | grep -c "404\|not found\|non-existent" || echo "0")
    local auth_errors_total=$(printf '%s\n' "${UNGRACEFUL_RESPONSES[@]}" | grep -c "auth\|login\|token" || echo "0")
    
    echo "Authentication Errors: $(( auth_errors > auth_errors_total ? auth_errors - auth_errors_total : 0 )) graceful, $auth_errors_total ungraceful"
    echo "Validation Errors: $validation_errors handled gracefully"
    echo "Resource Errors: $resource_errors handled gracefully"
    
    echo ""
    echo "=================================================================="
    echo "📈 RELIABILITY SCORE: $reliability_score%"
    echo "=================================================================="
    
    if [[ $reliability_score -ge 95 ]]; then
        echo "RATING: EXCELLENT ERROR HANDLING & RESILIENCE"
    elif [[ $reliability_score -ge 85 ]]; then
        echo "RATING: GOOD ERROR HANDLING WITH MINOR ISSUES"
    elif [[ $reliability_score -ge 70 ]]; then
        echo "RATING: ADEQUATE ERROR HANDLING NEEDS IMPROVEMENT"
    else
        echo "RATING: POOR ERROR HANDLING REQUIRES MAJOR FIXES"
    fi
}

# Main execution
main() {
    echo "=================================================================="
    echo "🛠️ Comprehensive Error Handling & Graceful Degradation Suite"
    echo "=================================================================="
    echo "Testing server: $API_BASE"
    echo "Focus: System resilience and error response quality"
    echo "=================================================================="
    
    setup_error_testing_environment
    
    # Run all error handling tests
    test_authentication_error_handling
    test_input_validation_error_handling
    test_resource_not_found_handling
    test_authorization_error_handling
    test_rate_limiting_error_handling
    test_system_error_handling
    test_content_format_error_handling
    test_network_error_simulation
    test_graceful_degradation_responses
    
    # Generate comprehensive report
    generate_error_handling_report
    
    # Exit with appropriate code
    if [[ $FAILED_ERROR_TESTS -eq 0 ]]; then
        exit 0
    else
        exit 1
    fi
}

# Handle arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Comprehensive Error Handling & Graceful Degradation Test Suite"
            echo ""
            echo "Options:"
            echo "  -v, --verbose    Enable verbose output with error details"
            echo "  -h, --help       Show this help message"
            echo ""
            echo "This suite tests:"
            echo "• Authentication error scenarios"
            echo "• Input validation error handling"
            echo "• Resource not found scenarios"
            echo "• Authorization error responses"
            echo "• Rate limiting and abuse prevention"
            echo "• System and database error handling"
            echo "• Content format error scenarios"
            echo "• Network error simulation"
            echo "• Graceful degradation mechanisms"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run the comprehensive error handling test suite
main "$@"