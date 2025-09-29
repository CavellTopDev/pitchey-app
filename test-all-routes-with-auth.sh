#!/bin/bash

# Comprehensive Route and Authentication Test Script for Pitchey v0.2
# Tests all login flows, dashboard access, and major routes for each user type
# Captures and logs errors, validates that all pages load correctly

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="http://localhost:8001"
FRONTEND_URL="http://localhost:5173"
LOG_FILE="route-test-results.log"
ERROR_LOG="route-test-errors.log"

# Initialize log files
echo "Route Testing Started at $(date)" > "$LOG_FILE"
echo "Route Testing Errors at $(date)" > "$ERROR_LOG"

# Test credentials from backend demo accounts
CREATOR_EMAIL="alex.creator@demo.com"
INVESTOR_EMAIL="sarah.investor@demo.com"
PRODUCTION_EMAIL="stellar.production@demo.com"
DEMO_PASSWORD="Demo123"

# Counters for results
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

# Function to log messages
log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${BLUE}[INFO $timestamp]${NC} $message"
            echo "[INFO $timestamp] $message" >> "$LOG_FILE"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS $timestamp]${NC} $message"
            echo "[SUCCESS $timestamp] $message" >> "$LOG_FILE"
            ((TESTS_PASSED++))
            ;;
        "ERROR")
            echo -e "${RED}[ERROR $timestamp]${NC} $message"
            echo "[ERROR $timestamp] $message" >> "$LOG_FILE"
            echo "[ERROR $timestamp] $message" >> "$ERROR_LOG"
            ((TESTS_FAILED++))
            ;;
        "WARNING")
            echo -e "${YELLOW}[WARNING $timestamp]${NC} $message"
            echo "[WARNING $timestamp] $message" >> "$LOG_FILE"
            ;;
    esac
    ((TOTAL_TESTS++))
}

# Function to test API endpoint
test_api_endpoint() {
    local method="$1"
    local endpoint="$2"
    local description="$3"
    local auth_token="$4"
    local expected_status="${5:-200}"
    local data="$6"
    
    log_message "INFO" "Testing $method $endpoint - $description"
    
    local curl_args=("-s" "-w" "HTTPSTATUS:%{http_code}" "-X" "$method")
    
    if [ -n "$auth_token" ]; then
        curl_args+=("-H" "Authorization: Bearer $auth_token")
    fi
    curl_args+=("-H" "Content-Type: application/json")
    
    if [ -n "$data" ]; then
        curl_args+=("-d" "$data")
    fi
    
    curl_args+=("$BACKEND_URL$endpoint")
    
    local response=$(curl "${curl_args[@]}" 2>/dev/null || echo "HTTPSTATUS:000")
    local status_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    local response_body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    # Handle multiple expected status codes
    local is_expected=false
    IFS=',' read -ra EXPECTED_CODES <<< "$expected_status"
    for code in "${EXPECTED_CODES[@]}"; do
        if [ "$status_code" = "$code" ]; then
            is_expected=true
            break
        fi
    done
    
    if [ "$is_expected" = true ]; then
        log_message "SUCCESS" "$description: Status $status_code (expected $expected_status)"
        return 0
    else
        log_message "ERROR" "$description: Status $status_code (expected $expected_status). Response: $response_body"
        return 1
    fi
}

# Function to test login and get token
test_login() {
    local user_type="$1"
    local email="$2"
    local password="$3"
    
    log_message "INFO" "Testing $user_type login: $email"
    
    local login_endpoint="/api/auth/$user_type/login"
    local login_data="{\"email\":\"$email\",\"password\":\"$password\"}"
    
    local response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$login_data" \
        "$BACKEND_URL$login_endpoint" 2>/dev/null || echo "HTTPSTATUS:000")
    
    local status_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    local response_body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    if [ "$status_code" = "200" ]; then
        local token=$(echo "$response_body" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
        if [ -n "$token" ]; then
            log_message "SUCCESS" "$user_type login successful. Token received."
            echo "$token"
            return 0
        else
            log_message "ERROR" "$user_type login: No token in response. Response: $response_body"
            return 1
        fi
    else
        log_message "ERROR" "$user_type login failed: Status $status_code. Response: $response_body"
        return 1
    fi
}

# Function to test protected routes
test_protected_routes() {
    local user_type="$1"
    local token="$2"
    
    log_message "INFO" "Testing protected routes for $user_type"
    
    # Common protected routes for all user types
    test_api_endpoint "GET" "/api/profile" "Profile endpoint for $user_type" "$token"
    
    # User type specific routes
    case $user_type in
        "creator")
            test_api_endpoint "GET" "/api/creator/dashboard" "Creator dashboard" "$token"
            test_api_endpoint "GET" "/api/pitches" "Creator pitches list" "$token"
            test_api_endpoint "GET" "/api/follows/followers" "Creator followers" "$token"
            test_api_endpoint "GET" "/api/follows/following" "Creator following" "$token"
            ;;
        "investor")
            test_api_endpoint "GET" "/api/investor/dashboard" "Investor dashboard" "$token"
            test_api_endpoint "GET" "/api/pitches/public" "Public pitches for investor" "$token"
            test_api_endpoint "GET" "/api/follows/following" "Investor following" "$token"
            ;;
        "production")
            test_api_endpoint "GET" "/api/production/dashboard" "Production dashboard" "$token"
            test_api_endpoint "GET" "/api/pitches/public" "Public pitches for production" "$token"
            test_api_endpoint "GET" "/api/follows/following" "Production following" "$token"
            ;;
    esac
}

# Function to check if services are running
check_services() {
    log_message "INFO" "Checking if backend and frontend services are running..."
    
    # Check backend
    local backend_response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$BACKEND_URL" 2>/dev/null || echo "HTTPSTATUS:000")
    local backend_status=$(echo "$backend_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    if [ "$backend_status" != "000" ] && [ -n "$backend_status" ]; then
        log_message "SUCCESS" "Backend is running at $BACKEND_URL (status: $backend_status)"
    else
        log_message "ERROR" "Backend is not accessible at $BACKEND_URL"
        exit 1
    fi
    
    # Check frontend (optional)
    local frontend_response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$FRONTEND_URL" 2>/dev/null || echo "HTTPSTATUS:000")
    local frontend_status=$(echo "$frontend_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    if [ "$frontend_status" != "000" ] && [ -n "$frontend_status" ]; then
        log_message "SUCCESS" "Frontend is running at $FRONTEND_URL (status: $frontend_status)"
    else
        log_message "WARNING" "Frontend is not accessible at $FRONTEND_URL (this may be normal if testing backend only)"
    fi
}

# Function to test public endpoints
test_public_endpoints() {
    log_message "INFO" "Testing public endpoints..."
    
    test_api_endpoint "GET" "/api/pitches/public" "Public pitches endpoint"
    test_api_endpoint "GET" "/api/health" "Health check endpoint" "" "200,404"
}

# Function to test rate limiting
test_rate_limiting() {
    log_message "INFO" "Testing rate limiting behavior..."
    
    for i in {1..5}; do
        test_api_endpoint "GET" "/api/pitches/public" "Rate limit test $i"
        sleep 0.1
    done
}

# Function to test CORS and headers
test_cors() {
    log_message "INFO" "Testing CORS headers..."
    
    local response=$(curl -s -I -X OPTIONS "$BACKEND_URL/api/pitches/public" 2>/dev/null || echo "")
    if echo "$response" | grep -q "Access-Control-Allow-Origin"; then
        log_message "SUCCESS" "CORS headers present"
    else
        log_message "WARNING" "CORS headers not found or OPTIONS not supported"
    fi
}

# Function to validate route configurations
validate_routes() {
    log_message "INFO" "Validating route configurations..."
    
    # Test various route patterns that should exist
    local routes=(
        "/api/auth/creator/login"
        "/api/auth/investor/login"
        "/api/auth/production/login"
        "/api/pitches/public"
        "/api/profile"
    )
    
    for route in "${routes[@]}"; do
        # Test if the route exists (even if it returns 401/405, it means the route is configured)
        local response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X GET "$BACKEND_URL$route" 2>/dev/null || echo "HTTPSTATUS:000")
        local status_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
        if [ "$status_code" != "000" ] && [ "$status_code" != "404" ]; then
            log_message "SUCCESS" "Route $route is configured (status: $status_code)"
        else
            log_message "ERROR" "Route $route not found or not accessible (status: $status_code)"
        fi
    done
}

# Function to test authentication flows end-to-end
test_auth_flows() {
    log_message "INFO" "Starting comprehensive authentication tests..."
    
    # Test creator authentication flow
    log_message "INFO" "=== CREATOR AUTHENTICATION FLOW ==="
    local creator_token=$(test_login "creator" "$CREATOR_EMAIL" "$DEMO_PASSWORD")
    if [ $? -eq 0 ] && [ -n "$creator_token" ]; then
        test_protected_routes "creator" "$creator_token"
    fi
    
    # Test investor authentication flow
    log_message "INFO" "=== INVESTOR AUTHENTICATION FLOW ==="
    local investor_token=$(test_login "investor" "$INVESTOR_EMAIL" "$DEMO_PASSWORD")
    if [ $? -eq 0 ] && [ -n "$investor_token" ]; then
        test_protected_routes "investor" "$investor_token"
    fi
    
    # Test production authentication flow
    log_message "INFO" "=== PRODUCTION AUTHENTICATION FLOW ==="
    local production_token=$(test_login "production" "$PRODUCTION_EMAIL" "$DEMO_PASSWORD")
    if [ $? -eq 0 ] && [ -n "$production_token" ]; then
        test_protected_routes "production" "$production_token"
    fi
}

# Function to test unauthorized access
test_unauthorized_access() {
    log_message "INFO" "Testing unauthorized access to protected routes..."
    
    # These should all return 401
    test_api_endpoint "GET" "/api/profile" "Profile without auth" "" "401"
    test_api_endpoint "GET" "/api/creator/dashboard" "Creator dashboard without auth" "" "401"
    test_api_endpoint "GET" "/api/investor/dashboard" "Investor dashboard without auth" "" "401"
    test_api_endpoint "GET" "/api/production/dashboard" "Production dashboard without auth" "" "401"
}

# Function to test invalid credentials
test_invalid_credentials() {
    log_message "INFO" "Testing invalid credentials..."
    
    test_api_endpoint "POST" "/api/auth/creator/login" "Invalid creator credentials" "" "401" '{"email":"invalid@test.com","password":"wrongpassword"}'
}

# Function to generate summary report
generate_summary() {
    echo ""
    echo "======================================"
    echo "        TEST SUMMARY REPORT"
    echo "======================================"
    echo "Total Tests: $TOTAL_TESTS"
    echo "Passed: $GREEN$TESTS_PASSED$NC"
    echo "Failed: $RED$TESTS_FAILED$NC"
    echo "Success Rate: $(( TESTS_PASSED * 100 / TOTAL_TESTS ))%"
    echo ""
    echo "Detailed logs saved to: $LOG_FILE"
    echo "Error logs saved to: $ERROR_LOG"
    echo "======================================"
    
    # Add summary to log file
    {
        echo ""
        echo "======================================"
        echo "        TEST SUMMARY REPORT"
        echo "======================================"
        echo "Total Tests: $TOTAL_TESTS"
        echo "Passed: $TESTS_PASSED"
        echo "Failed: $TESTS_FAILED"
        echo "Success Rate: $(( TESTS_PASSED * 100 / TOTAL_TESTS ))%"
        echo "======================================"
    } >> "$LOG_FILE"
}

# Main execution
main() {
    echo -e "${BLUE}🚀 Starting Comprehensive Route and Authentication Tests${NC}"
    echo "Backend URL: $BACKEND_URL"
    echo "Frontend URL: $FRONTEND_URL"
    echo ""
    
    # Step 1: Check if services are running
    check_services
    
    # Step 2: Test public endpoints
    test_public_endpoints
    
    # Step 3: Validate route configurations
    validate_routes
    
    # Step 4: Test CORS
    test_cors
    
    # Step 5: Test unauthorized access
    test_unauthorized_access
    
    # Step 6: Test authentication flows
    test_auth_flows
    
    # Step 7: Test rate limiting
    test_rate_limiting
    
    # Step 8: Generate summary
    generate_summary
    
    # Exit with appropriate code
    if [ $TESTS_FAILED -eq 0 ]; then
        log_message "SUCCESS" "All tests passed!"
        exit 0
    else
        log_message "ERROR" "Some tests failed. Check $ERROR_LOG for details."
        exit 1
    fi
}

# Run the main function
main "$@"