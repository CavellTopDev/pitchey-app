#!/bin/bash

# Comprehensive Negative Test Scenarios
# Tests invalid access attempts, edge cases, and error conditions
# Validates proper error handling and security measures
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
PRODUCTION_EMAIL="stellar.production@demo.com"
PRODUCTION_PASSWORD="Demo123"

# Global variables
CREATOR_TOKEN=""
INVESTOR_TOKEN=""
PRODUCTION_TOKEN=""
CREATOR_PITCH_ID=""

# Test tracking
TOTAL_NEGATIVE_TESTS=0
PASSED_NEGATIVE_TESTS=0
FAILED_NEGATIVE_TESTS=0
SECURITY_VIOLATIONS=()
PROPER_REJECTIONS=()

# Utility functions
log_negative_test_start() {
    echo -e "\n${PURPLE}🔒 Negative Test: $1${NC}"
    ((TOTAL_NEGATIVE_TESTS++))
}

log_proper_rejection() {
    echo -e "${GREEN}✅ Properly Rejected: $1${NC}"
    ((PASSED_NEGATIVE_TESTS++))
    PROPER_REJECTIONS+=("$1")
}

log_security_violation() {
    echo -e "${RED}🚨 SECURITY VIOLATION: $1${NC}"
    ((FAILED_NEGATIVE_TESTS++))
    SECURITY_VIOLATIONS+=("$1")
}

log_step() {
    echo -e "${BLUE}  → $1${NC}"
}

# HTTP request helper that expects failure
api_request_expect_fail() {
    local method="$1"
    local endpoint="$2"
    local token="$3"
    local data="$4"
    local expected_status="$5"  # Expected failure status
    
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
    response=$(eval "$curl_cmd")
    
    local body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]+$//')
    local status=$(echo "$response" | grep -o 'HTTPSTATUS:[0-9]*$' | cut -d: -f2)
    
    # For negative tests, we expect failure
    if [[ "$status" == "$expected_status" ]]; then
        return 0  # Success means proper rejection
    else
        if [[ "$VERBOSE" == "true" ]]; then
            echo "Expected failure status: $expected_status, Got: $status" >&2
            echo "Body: $body" >&2
        fi
        return 1  # Failure means security violation
    fi
}

# Regular API request helper
api_request() {
    local method="$1"
    local endpoint="$2"
    local token="$3"
    local data="$4"
    local expected_status="${5:-200}"
    
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

# Setup authentication and test data
setup_negative_test_environment() {
    echo -e "${CYAN}🔧 Setting up environment for negative testing...${NC}"
    
    # Authenticate users
    local creator_data="{\"email\":\"$CREATOR_EMAIL\",\"password\":\"$CREATOR_PASSWORD\"}"
    if response=$(api_request "POST" "/api/auth/creator/login" "" "$creator_data" "200"); then
        CREATOR_TOKEN=$(echo "$response" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    fi
    
    local investor_data="{\"email\":\"$INVESTOR_EMAIL\",\"password\":\"$INVESTOR_PASSWORD\"}"
    if response=$(api_request "POST" "/api/auth/investor/login" "" "$investor_data" "200"); then
        INVESTOR_TOKEN=$(echo "$response" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    fi
    
    local production_data="{\"email\":\"$PRODUCTION_EMAIL\",\"password\":\"$PRODUCTION_PASSWORD\"}"
    if response=$(api_request "POST" "/api/auth/production/login" "" "$production_data" "200"); then
        PRODUCTION_TOKEN=$(echo "$response" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    fi
    
    # Create test pitch if needed
    if [[ -n "$CREATOR_TOKEN" ]]; then
        local pitch_data='{
            "title": "Negative Test Pitch",
            "logline": "Test pitch for negative scenarios",
            "genre": "drama",
            "format": "feature",
            "shortSynopsis": "Test synopsis",
            "targetAudience": "Test audience",
            "estimatedBudget": 1000000
        }'
        if response=$(api_request "POST" "/api/creator/pitches" "$CREATOR_TOKEN" "$pitch_data" "201"); then
            CREATOR_PITCH_ID=$(echo "$response" | grep -o '"id":[0-9]*' | cut -d: -f2)
        fi
    fi
    
    echo -e "${CYAN}✓ Environment setup complete${NC}"
}

# Test 1: Invalid Authentication Attempts
test_invalid_authentication() {
    log_negative_test_start "Invalid Authentication Attempts"
    
    # Test 1.1: Invalid credentials
    log_step "Testing invalid login credentials"
    local invalid_data='{"email":"invalid@test.com","password":"wrongpassword"}'
    if api_request_expect_fail "POST" "/api/auth/login" "" "$invalid_data" "401"; then
        log_proper_rejection "Invalid credentials rejected"
    else
        log_security_violation "Invalid credentials accepted"
    fi
    
    # Test 1.2: Malformed login request
    log_step "Testing malformed login request"
    local malformed_data='{"invalid":"structure"}'
    if api_request_expect_fail "POST" "/api/auth/login" "" "$malformed_data" "400"; then
        log_proper_rejection "Malformed login request rejected"
    else
        log_security_violation "Malformed login request accepted"
    fi
    
    # Test 1.3: Empty credentials
    log_step "Testing empty credentials"
    local empty_data='{"email":"","password":""}'
    if api_request_expect_fail "POST" "/api/auth/login" "" "$empty_data" "400"; then
        log_proper_rejection "Empty credentials rejected"
    else
        log_security_violation "Empty credentials accepted"
    fi
    
    # Test 1.4: SQL injection attempt in login
    log_step "Testing SQL injection in login"
    local injection_data='{"email":"admin@test.com'\''OR 1=1--","password":"anything"}'
    if api_request_expect_fail "POST" "/api/auth/login" "" "$injection_data" "401"; then
        log_proper_rejection "SQL injection attempt blocked"
    else
        log_security_violation "SQL injection attempt succeeded"
    fi
}

# Test 2: Invalid Token Usage
test_invalid_token_usage() {
    log_negative_test_start "Invalid Token Usage Attempts"
    
    # Test 2.1: Invalid JWT token
    log_step "Testing invalid JWT token"
    local fake_token="invalid.jwt.token"
    if api_request_expect_fail "GET" "/api/creator/dashboard" "$fake_token" "" "401"; then
        log_proper_rejection "Invalid JWT token rejected")
    else
        log_security_violation "Invalid JWT token accepted"
    fi
    
    # Test 2.2: Expired token simulation
    log_step "Testing malformed token"
    local malformed_token="not-a-jwt-token"
    if api_request_expect_fail "GET" "/api/profile" "$malformed_token" "" "401"; then
        log_proper_rejection "Malformed token rejected"
    else
        log_security_violation "Malformed token accepted"
    fi
    
    # Test 2.3: Empty token
    log_step "Testing empty authorization header"
    if api_request_expect_fail "GET" "/api/creator/dashboard" "" "" "401"; then
        log_proper_rejection "Missing authorization properly rejected"
    else
        log_security_violation "Missing authorization accepted"
    fi
    
    # Test 2.4: Token in wrong portal
    log_step "Testing creator token in investor endpoint"
    if [[ -n "$CREATOR_TOKEN" ]]; then
        if api_request_expect_fail "GET" "/api/investor/portfolio" "$CREATOR_TOKEN" "" "403" ||
           api_request_expect_fail "GET" "/api/investor/portfolio" "$CREATOR_TOKEN" "" "401"; then
            log_proper_rejection "Cross-portal token usage blocked"
        else
            log_security_violation "Cross-portal token usage allowed"
        fi
    fi
}

# Test 3: Invalid NDA Requests
test_invalid_nda_requests() {
    log_negative_test_start "Invalid NDA Request Attempts"
    
    # Test 3.1: Creator requesting NDA for own pitch
    if [[ -n "$CREATOR_TOKEN" && -n "$CREATOR_PITCH_ID" ]]; then
        log_step "Creator requesting NDA for own pitch (should be blocked)"
        local own_pitch_nda='{"pitchId":'$CREATOR_PITCH_ID',"message":"Self request","requestType":"basic"}'
        if api_request_expect_fail "POST" "/api/ndas/request" "$CREATOR_TOKEN" "$own_pitch_nda" "400" ||
           api_request_expect_fail "POST" "/api/ndas/request" "$CREATOR_TOKEN" "$own_pitch_nda" "403"; then
            log_proper_rejection "Creator self-NDA request blocked"
        else
            log_security_violation "Creator can request NDA for own pitch"
        fi
    fi
    
    # Test 3.2: Invalid pitch ID in NDA request
    if [[ -n "$INVESTOR_TOKEN" ]]; then
        log_step "NDA request with non-existent pitch ID"
        local invalid_pitch_nda='{"pitchId":99999,"message":"Invalid pitch","requestType":"basic"}'
        if api_request_expect_fail "POST" "/api/ndas/request" "$INVESTOR_TOKEN" "$invalid_pitch_nda" "404" ||
           api_request_expect_fail "POST" "/api/ndas/request" "$INVESTOR_TOKEN" "$invalid_pitch_nda" "400"; then
            log_proper_rejection "Invalid pitch ID rejected in NDA request"
        else
            log_security_violation "Invalid pitch ID accepted in NDA request"
        fi
    fi
    
    # Test 3.3: Malformed NDA request
    if [[ -n "$INVESTOR_TOKEN" ]]; then
        log_step "Malformed NDA request data"
        local malformed_nda='{"invalid":"structure","missing":"required_fields"}'
        if api_request_expect_fail "POST" "/api/ndas/request" "$INVESTOR_TOKEN" "$malformed_nda" "400" ||
           api_request_expect_fail "POST" "/api/ndas/request" "$INVESTOR_TOKEN" "$malformed_nda" "422"; then
            log_proper_rejection "Malformed NDA request rejected"
        else
            log_security_violation "Malformed NDA request accepted"
        fi
    fi
    
    # Test 3.4: Anonymous user NDA request
    log_step "Anonymous user attempting NDA request"
    local anon_nda='{"pitchId":1,"message":"Anonymous request","requestType":"basic"}'
    if api_request_expect_fail "POST" "/api/ndas/request" "" "$anon_nda" "401"; then
        log_proper_rejection "Anonymous NDA request blocked"
    else
        log_security_violation "Anonymous NDA request allowed"
    fi
}

# Test 4: Unauthorized Resource Access
test_unauthorized_resource_access() {
    log_negative_test_start "Unauthorized Resource Access Attempts"
    
    # Test 4.1: Cross-portal dashboard access
    log_step "Cross-portal dashboard access attempts"
    
    if [[ -n "$INVESTOR_TOKEN" ]]; then
        if api_request_expect_fail "GET" "/api/creator/dashboard" "$INVESTOR_TOKEN" "" "403" ||
           api_request_expect_fail "GET" "/api/creator/dashboard" "$INVESTOR_TOKEN" "" "401"; then
            log_proper_rejection("Investor blocked from creator dashboard")
        else
            log_security_violation "Investor can access creator dashboard"
        fi
    fi
    
    if [[ -n "$PRODUCTION_TOKEN" ]]; then
        if api_request_expect_fail "GET" "/api/investor/watchlist" "$PRODUCTION_TOKEN" "" "403" ||
           api_request_expect_fail "GET" "/api/investor/watchlist" "$PRODUCTION_TOKEN" "" "401"; then
            log_proper_rejection "Production blocked from investor watchlist"
        else
            log_security_violation "Production can access investor watchlist"
        fi
    fi
    
    # Test 4.2: Anonymous access to protected endpoints
    log_step "Anonymous access to protected resources"
    
    local protected_endpoints=(
        "/api/creator/dashboard"
        "/api/investor/dashboard"
        "/api/production/dashboard"
        "/api/profile"
        "/api/creator/pitches"
        "/api/investor/portfolio"
    )
    
    local anonymous_blocked=true
    for endpoint in "${protected_endpoints[@]}"; do
        if ! api_request_expect_fail "GET" "$endpoint" "" "" "401"; then
            anonymous_blocked=false
            break
        fi
    done
    
    if $anonymous_blocked; then
        log_proper_rejection "All protected endpoints block anonymous access"
    else
        log_security_violation "Some protected endpoints allow anonymous access"
    fi
    
    # Test 4.3: Access to non-existent resources
    log_step "Access to non-existent resources"
    if [[ -n "$CREATOR_TOKEN" ]]; then
        if api_request_expect_fail "GET" "/api/pitches/99999" "$CREATOR_TOKEN" "" "404"; then
            log_proper_rejection "Non-existent pitch properly returns 404"
        else
            log_security_violation "Non-existent pitch returns unexpected response"
        fi
    fi
}

# Test 5: Input Validation and Injection Attacks
test_input_validation_attacks() {
    log_negative_test_start "Input Validation and Injection Attack Prevention"
    
    # Test 5.1: XSS attempts in pitch creation
    if [[ -n "$CREATOR_TOKEN" ]]; then
        log_step "XSS attempt in pitch title"
        local xss_pitch='{
            "title": "<script>alert(\"XSS\")</script>",
            "logline": "XSS test",
            "genre": "drama",
            "format": "feature",
            "shortSynopsis": "XSS test"
        }'
        
        # This should either be sanitized or rejected
        if response=$(api_request "POST" "/api/creator/pitches" "$CREATOR_TOKEN" "$xss_pitch" "201"); then
            # If accepted, check if script tags are sanitized
            if echo "$response" | grep -q "<script>"; then
                log_security_violation "XSS script tags not sanitized in pitch title"
            else
                log_proper_rejection "XSS script tags sanitized in pitch creation"
            fi
        elif api_request_expect_fail "POST" "/api/creator/pitches" "$CREATOR_TOKEN" "$xss_pitch" "400"; then
            log_proper_rejection "XSS attempt rejected in pitch creation"
        else
            log_security_violation "Unexpected response to XSS attempt"
        fi
    fi
    
    # Test 5.2: SQL injection in search
    log_step "SQL injection attempt in search"
    local sql_injection_query="test'; DROP TABLE pitches; --"
    local encoded_query=$(printf '%s' "$sql_injection_query" | jq -sRr @uri)
    
    if api_request "GET" "/api/pitches/search?q=$encoded_query" "" "" "200" >/dev/null; then
        log_proper_rejection "SQL injection in search handled safely"
    elif api_request_expect_fail "GET" "/api/pitches/search?q=$encoded_query" "" "" "400"; then
        log_proper_rejection "SQL injection in search properly rejected"
    else
        log_security_violation "SQL injection in search caused unexpected behavior"
    fi
    
    # Test 5.3: Oversized input validation
    if [[ -n "$CREATOR_TOKEN" ]]; then
        log_step "Oversized input validation"
        local oversized_title=$(printf 'A%.0s' {1..1000})  # 1000 character title
        local oversized_pitch="{
            \"title\": \"$oversized_title\",
            \"logline\": \"Test\",
            \"genre\": \"drama\",
            \"format\": \"feature\",
            \"shortSynopsis\": \"Test\"
        }"
        
        if api_request_expect_fail "POST" "/api/creator/pitches" "$CREATOR_TOKEN" "$oversized_pitch" "400" ||
           api_request_expect_fail "POST" "/api/creator/pitches" "$CREATOR_TOKEN" "$oversized_pitch" "413"; then
            log_proper_rejection "Oversized input properly rejected"
        else
            log_security_violation "Oversized input accepted without validation"
        fi
    fi
}

# Test 6: Rate Limiting and Abuse Prevention
test_rate_limiting() {
    log_negative_test_start "Rate Limiting and Abuse Prevention"
    
    # Test 6.1: Rapid multiple requests
    log_step "Testing rapid multiple login attempts"
    local rapid_requests_blocked=true
    local invalid_data='{"email":"fake@test.com","password":"wrong"}'
    
    for i in {1..10}; do
        if ! api_request_expect_fail "POST" "/api/auth/login" "" "$invalid_data" "401"; then
            # After several attempts, should get rate limited
            if [[ $i -gt 5 ]] && api_request_expect_fail "POST" "/api/auth/login" "" "$invalid_data" "429"; then
                log_proper_rejection "Rate limiting activated after multiple failed attempts"
                break
            fi
        fi
        sleep 0.1  # Brief delay between requests
    done
    
    # Test 6.2: Multiple NDA requests for same pitch
    if [[ -n "$INVESTOR_TOKEN" && -n "$CREATOR_PITCH_ID" ]]; then
        log_step "Testing duplicate NDA requests"
        local nda_data='{"pitchId":'$CREATOR_PITCH_ID',"message":"First request","requestType":"basic"}'
        
        # First request should succeed or be handled
        api_request "POST" "/api/ndas/request" "$INVESTOR_TOKEN" "$nda_data" "201" >/dev/null || 
        api_request "POST" "/api/ndas/request" "$INVESTOR_TOKEN" "$nda_data" "200" >/dev/null || true
        
        # Second request should be rejected as duplicate
        if api_request_expect_fail "POST" "/api/ndas/request" "$INVESTOR_TOKEN" "$nda_data" "409" ||
           api_request_expect_fail "POST" "/api/ndas/request" "$INVESTOR_TOKEN" "$nda_data" "400"; then
            log_proper_rejection "Duplicate NDA request properly rejected"
        else
            log_security_violation "Duplicate NDA requests allowed"
        fi
    fi
}

# Test 7: Error Response Information Disclosure
test_error_information_disclosure() {
    log_negative_test_start "Error Response Information Disclosure"
    
    # Test 7.1: Database errors don't expose sensitive information
    log_step "Testing that database errors don't expose sensitive info"
    
    # Try to access non-existent pitch with ID that might cause database error
    if [[ -n "$CREATOR_TOKEN" ]]; then
        if response=$(api_request_expect_fail "GET" "/api/pitches/-1" "$CREATOR_TOKEN" "" "404" 2>&1); then
            # Check that error doesn't contain database schema info
            if echo "$response" | grep -qiE "(sql|database|table|column|schema|postgres)"; then
                log_security_violation "Database error exposes sensitive information"
            else
                log_proper_rejection "Database error doesn't expose sensitive information"
            fi
        fi
    fi
    
    # Test 7.2: Authentication errors don't reveal user existence
    log_step "Testing that auth errors don't reveal user existence"
    local nonexistent_user_data='{"email":"definitely.not.real@fake.domain","password":"password"}'
    local existing_user_wrong_pass='{"email":"'$CREATOR_EMAIL'","password":"wrongpassword"}'
    
    # Both should return same error type to prevent user enumeration
    if api_request_expect_fail "POST" "/api/auth/login" "" "$nonexistent_user_data" "401" &&
       api_request_expect_fail "POST" "/api/auth/login" "" "$existing_user_wrong_pass" "401"; then
        log_proper_rejection "Authentication errors don't reveal user existence"
    else
        log_security_violation "Authentication errors may reveal user existence"
    fi
}

# Generate comprehensive negative test report
generate_negative_test_report() {
    echo ""
    echo "=================================================================="
    echo "🔒 COMPREHENSIVE NEGATIVE TEST SCENARIOS REPORT"
    echo "=================================================================="
    echo "Test Environment: $API_BASE"
    echo "Total Negative Tests: $TOTAL_NEGATIVE_TESTS"
    echo -e "${GREEN}✅ Properly Rejected: $PASSED_NEGATIVE_TESTS${NC}"
    echo -e "${RED}🚨 Security Violations: $FAILED_NEGATIVE_TESTS${NC}"
    
    local security_score=$(( PASSED_NEGATIVE_TESTS * 100 / TOTAL_NEGATIVE_TESTS ))
    
    if [[ $FAILED_NEGATIVE_TESTS -eq 0 ]]; then
        echo -e "${GREEN}🎉 SECURITY STATUS: ROBUST - All attacks properly blocked${NC}"
    elif [[ $security_score -gt 80 ]]; then
        echo -e "${YELLOW}⚠️ SECURITY STATUS: GOOD - Most attacks blocked, some issues${NC}"
    else
        echo -e "${RED}🚨 SECURITY STATUS: VULNERABLE - Multiple security issues detected${NC}"
    fi
    
    echo ""
    echo "=================================================================="
    echo "📊 SECURITY ANALYSIS DETAILS"
    echo "=================================================================="
    
    echo ""
    echo -e "${GREEN}✅ PROPER SECURITY REJECTIONS:${NC}"
    if [[ ${#PROPER_REJECTIONS[@]} -gt 0 ]]; then
        printf '   • %s\n' "${PROPER_REJECTIONS[@]}"
    else
        echo "   (None - all tests failed)"
    fi
    
    if [[ ${#SECURITY_VIOLATIONS[@]} -gt 0 ]]; then
        echo ""
        echo -e "${RED}🚨 CRITICAL SECURITY VIOLATIONS:${NC}"
        printf '   • %s\n' "${SECURITY_VIOLATIONS[@]}"
        
        echo ""
        echo "=================================================================="
        echo "🛠️ URGENT SECURITY FIXES NEEDED"
        echo "=================================================================="
        echo "1. Review and fix all security violations listed above"
        echo "2. Implement proper input validation and sanitization"
        echo "3. Add comprehensive authorization checks"
        echo "4. Implement rate limiting and abuse prevention"
        echo "5. Ensure error messages don't leak sensitive information"
        echo "6. Add logging for security events and attempted breaches"
        echo "7. Consider implementing additional security middleware"
    fi
    
    echo ""
    echo "=================================================================="
    echo "🛡️ SECURITY SCORE: $security_score%"
    echo "=================================================================="
    
    if [[ $security_score -ge 95 ]]; then
        echo "RATING: EXCELLENT SECURITY POSTURE"
    elif [[ $security_score -ge 85 ]]; then
        echo "RATING: GOOD SECURITY WITH MINOR ISSUES"
    elif [[ $security_score -ge 70 ]]; then
        echo "RATING: ADEQUATE SECURITY NEEDS IMPROVEMENT"
    else
        echo "RATING: POOR SECURITY REQUIRES IMMEDIATE ATTENTION"
    fi
}

# Main execution
main() {
    echo "=================================================================="
    echo "🔒 Comprehensive Negative Test Scenarios Suite"
    echo "=================================================================="
    echo "Testing server: $API_BASE"
    echo "Focus: Security vulnerabilities and edge cases"
    echo "=================================================================="
    
    setup_negative_test_environment
    
    # Run all negative tests
    test_invalid_authentication
    test_invalid_token_usage
    test_invalid_nda_requests
    test_unauthorized_resource_access
    test_input_validation_attacks
    test_rate_limiting
    test_error_information_disclosure
    
    # Generate comprehensive report
    generate_negative_test_report
    
    # Exit with appropriate code
    if [[ $FAILED_NEGATIVE_TESTS -eq 0 ]]; then
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
            echo "Comprehensive Negative Test Scenarios Suite"
            echo ""
            echo "Options:"
            echo "  -v, --verbose    Enable verbose output with detailed error info"
            echo "  -h, --help       Show this help message"
            echo ""
            echo "This suite tests:"
            echo "• Invalid authentication attempts"
            echo "• Unauthorized resource access"
            echo "• Input validation and injection attacks"
            echo "• Rate limiting and abuse prevention"
            echo "• Error information disclosure"
            echo "• Cross-portal security violations"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run the comprehensive negative test suite
main "$@"