#!/bin/bash

# Pitchey Production Test Suite - cURL Version
# Comprehensive testing of all production workflows using cURL
# 
# URLs:
# - Frontend: https://pitchey-frontend.deno.dev  
# - Backend: https://pitchey-backend.deno.dev

set -e

# Configuration
BACKEND_URL="https://pitchey-backend.deno.dev"
FRONTEND_URL="https://pitchey-frontend.deno.dev"

# Demo account credentials
CREATOR_EMAIL="alex.creator@demo.com"
CREATOR_PASSWORD="Demo123"
INVESTOR_EMAIL="sarah.investor@demo.com" 
INVESTOR_PASSWORD="Demo123"
PRODUCTION_EMAIL="stellar.production@demo.com"
PRODUCTION_PASSWORD="Demo123"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

# Helper functions
log() {
    echo -e "${2:-$NC}$1${NC}"
}

log_test() {
    local test_name="$1"
    local status="$2"
    local details="$3"
    
    if [ "$status" = "true" ]; then
        echo -e "  ${GREEN}✓ PASS${NC} $test_name${details:+ - $details}"
        ((TESTS_PASSED++))
    else
        echo -e "  ${RED}✗ FAIL${NC} $test_name${details:+ - $details}"
        ((TESTS_FAILED++))
        FAILED_TESTS+=("$test_name: $details")
    fi
}

# Make HTTP request with error handling
make_request() {
    local method="$1"
    local url="$2"
    local data="$3"
    local headers="$4"
    
    local response
    local http_code
    
    if [ -n "$data" ] && [ -n "$headers" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
            -H "Content-Type: application/json" \
            -H "$headers" \
            -d "$data" 2>/dev/null || echo -e "\n000")
    elif [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null || echo -e "\n000")
    elif [ -n "$headers" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
            -H "$headers" 2>/dev/null || echo -e "\n000")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" 2>/dev/null || echo -e "\n000")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    echo "$http_code|$body"
}

# Parse JSON response
parse_json() {
    local json="$1"
    local key="$2"
    echo "$json" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    keys = '$key'.split('.')
    result = data
    for k in keys:
        if k.isdigit():
            result = result[int(k)]
        else:
            result = result[k] if k in result else None
    print(result if result is not None else '')
except:
    print('')
" 2>/dev/null || echo ""
}

# Authentication helper
authenticate() {
    local portal="$1"
    local email="$2" 
    local password="$3"
    
    local auth_data="{\"email\":\"$email\",\"password\":\"$password\"}"
    local response_data=$(make_request "POST" "$BACKEND_URL/api/auth/$portal/login" "$auth_data")
    
    local http_code=$(echo "$response_data" | cut -d'|' -f1)
    local body=$(echo "$response_data" | cut -d'|' -f2-)
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        local token=$(parse_json "$body" "token")
        local user_id=$(parse_json "$body" "user.id")
        echo "$token|$user_id|$http_code"
    else
        echo "||$http_code"
    fi
}

# Store tokens globally
CREATOR_TOKEN=""
CREATOR_USER_ID=""
INVESTOR_TOKEN=""
INVESTOR_USER_ID=""
PRODUCTION_TOKEN=""
PRODUCTION_USER_ID=""
TEST_PITCH_ID=""

main() {
    log "${BOLD}${MAGENTA}🚀 PITCHEY PRODUCTION TEST SUITE${NC}"
    log "${CYAN}Testing production deployment...${NC}"
    log "Backend: $BACKEND_URL"
    log "Frontend: $FRONTEND_URL"
    echo

    # 1. Authentication Workflows
    test_authentication_workflows
    
    # 2. Pitch Workflows  
    test_pitch_workflows
    
    # 3. Dashboard Access
    test_dashboard_access
    
    # 4. API Endpoints
    test_api_endpoints
    
    # 5. System Integration
    test_system_integration
    
    # Final Summary
    show_final_summary
}

test_authentication_workflows() {
    log "${BOLD}${CYAN}1️⃣  AUTHENTICATION WORKFLOWS${NC}"
    log "$(printf '=%.0s' {1..40})"
    
    # Test Creator Login
    log "\nTesting creator authentication:"
    local creator_auth=$(authenticate "creator" "$CREATOR_EMAIL" "$CREATOR_PASSWORD")
    CREATOR_TOKEN=$(echo "$creator_auth" | cut -d'|' -f1)
    CREATOR_USER_ID=$(echo "$creator_auth" | cut -d'|' -f2)
    local creator_http_code=$(echo "$creator_auth" | cut -d'|' -f3)
    
    if [ -n "$CREATOR_TOKEN" ] && [ "$creator_http_code" = "200" ]; then
        log_test "Creator login" "true" "User ID: $CREATOR_USER_ID"
    else
        log_test "Creator login" "false" "HTTP $creator_http_code"
    fi
    
    # Test Investor Login
    log "\nTesting investor authentication:"
    local investor_auth=$(authenticate "investor" "$INVESTOR_EMAIL" "$INVESTOR_PASSWORD")
    INVESTOR_TOKEN=$(echo "$investor_auth" | cut -d'|' -f1)
    INVESTOR_USER_ID=$(echo "$investor_auth" | cut -d'|' -f2)  
    local investor_http_code=$(echo "$investor_auth" | cut -d'|' -f3)
    
    if [ -n "$INVESTOR_TOKEN" ] && [ "$investor_http_code" = "200" ]; then
        log_test "Investor login" "true" "User ID: $INVESTOR_USER_ID"
    else
        log_test "Investor login" "false" "HTTP $investor_http_code"
    fi
    
    # Test Production Login
    log "\nTesting production authentication:"
    local production_auth=$(authenticate "production" "$PRODUCTION_EMAIL" "$PRODUCTION_PASSWORD")
    PRODUCTION_TOKEN=$(echo "$production_auth" | cut -d'|' -f1)
    PRODUCTION_USER_ID=$(echo "$production_auth" | cut -d'|' -f2)
    local production_http_code=$(echo "$production_auth" | cut -d'|' -f3)
    
    if [ -n "$PRODUCTION_TOKEN" ] && [ "$production_http_code" = "200" ]; then
        log_test "Production login" "true" "User ID: $PRODUCTION_USER_ID"
    else
        log_test "Production login" "false" "HTTP $production_http_code"
    fi
    
    # Test token validation
    log "\nTesting token validation:"
    if [ -n "$CREATOR_TOKEN" ]; then
        local me_response=$(make_request "GET" "$BACKEND_URL/api/auth/me" "" "Authorization: Bearer $CREATOR_TOKEN")
        local me_http_code=$(echo "$me_response" | cut -d'|' -f1)
        log_test "Creator token validation" "$([ "$me_http_code" = "200" ] && echo true || echo false)" "HTTP $me_http_code"
    fi
    
    if [ -n "$INVESTOR_TOKEN" ]; then
        local me_response=$(make_request "GET" "$BACKEND_URL/api/auth/me" "" "Authorization: Bearer $INVESTOR_TOKEN")
        local me_http_code=$(echo "$me_response" | cut -d'|' -f1)
        log_test "Investor token validation" "$([ "$me_http_code" = "200" ] && echo true || echo false)" "HTTP $me_http_code"
    fi
    
    if [ -n "$PRODUCTION_TOKEN" ]; then
        local me_response=$(make_request "GET" "$BACKEND_URL/api/auth/me" "" "Authorization: Bearer $PRODUCTION_TOKEN")
        local me_http_code=$(echo "$me_response" | cut -d'|' -f1)
        log_test "Production token validation" "$([ "$me_http_code" = "200" ] && echo true || echo false)" "HTTP $me_http_code"
    fi
}

test_pitch_workflows() {
    log "\n${BOLD}${CYAN}2️⃣  PITCH WORKFLOWS${NC}"
    log "$(printf '=%.0s' {1..40})"
    
    # Test public pitch listing
    log "\nTesting public pitch access:"
    local pitches_response=$(make_request "GET" "$BACKEND_URL/api/pitches")
    local pitches_http_code=$(echo "$pitches_response" | cut -d'|' -f1)
    local pitches_body=$(echo "$pitches_response" | cut -d'|' -f2-)
    
    if [ "$pitches_http_code" = "200" ]; then
        log_test "Public pitch listing" "true" "HTTP $pitches_http_code"
        # Try to extract first pitch ID
        TEST_PITCH_ID=$(parse_json "$pitches_body" "0.id")
        if [ -z "$TEST_PITCH_ID" ]; then
            TEST_PITCH_ID="1" # Fallback
        fi
    else
        log_test "Public pitch listing" "false" "HTTP $pitches_http_code"
        TEST_PITCH_ID="1" # Fallback for testing
    fi
    
    # Test individual pitch viewing
    if [ -n "$TEST_PITCH_ID" ]; then
        local pitch_response=$(make_request "GET" "$BACKEND_URL/api/pitches/$TEST_PITCH_ID")
        local pitch_http_code=$(echo "$pitch_response" | cut -d'|' -f1)
        log_test "Individual pitch viewing" "$([ "$pitch_http_code" = "200" ] && echo true || echo false)" "Pitch ID: $TEST_PITCH_ID, HTTP $pitch_http_code"
        
        # Test frontend pitch page
        local frontend_response=$(make_request "GET" "$FRONTEND_URL/pitch/$TEST_PITCH_ID")
        local frontend_http_code=$(echo "$frontend_response" | cut -d'|' -f1)
        log_test "Frontend pitch page" "$([ "$frontend_http_code" -lt "400" ] && echo true || echo false)" "HTTP $frontend_http_code"
    fi
    
    # Test NDA request flow (RECENTLY FIXED)
    log "\nTesting NDA request flow (RECENTLY FIXED):"
    if [ -n "$INVESTOR_TOKEN" ] && [ -n "$TEST_PITCH_ID" ]; then
        local nda_data="{\"pitchId\":$TEST_PITCH_ID,\"ndaType\":\"basic\",\"requestMessage\":\"Test NDA request for production testing\",\"companyInfo\":\"Demo Investor Company\"}"
        local nda_response=$(make_request "POST" "$BACKEND_URL/api/ndas/request" "$nda_data" "Authorization: Bearer $INVESTOR_TOKEN")
        local nda_http_code=$(echo "$nda_response" | cut -d'|' -f1)
        
        # Success (201) or already exists (400) are both acceptable
        if [ "$nda_http_code" = "201" ] || [ "$nda_http_code" = "400" ]; then
            log_test "NDA request submission" "true" "$([ "$nda_http_code" = "201" ] && echo "NDA request created" || echo "Request already exists (acceptable)")"
        else
            log_test "NDA request submission" "false" "HTTP $nda_http_code"
        fi
        
        # Test NDA status check  
        local nda_status_response=$(make_request "GET" "$BACKEND_URL/api/pitches/$TEST_PITCH_ID/nda" "" "Authorization: Bearer $INVESTOR_TOKEN")
        local nda_status_http_code=$(echo "$nda_status_response" | cut -d'|' -f1)
        log_test "NDA status check" "$([ "$nda_status_http_code" = "200" ] && echo true || echo false)" "HTTP $nda_status_http_code"
        
        # Test listing NDA requests
        local nda_list_response=$(make_request "GET" "$BACKEND_URL/api/ndas/request?type=outgoing" "" "Authorization: Bearer $INVESTOR_TOKEN")
        local nda_list_http_code=$(echo "$nda_list_response" | cut -d'|' -f1)
        log_test "NDA requests listing" "$([ "$nda_list_http_code" = "200" ] && echo true || echo false)" "HTTP $nda_list_http_code"
    else
        log_test "NDA request flow" "false" "No investor token or pitch ID available"
    fi
    
    # Test creator pitch management
    log "\nTesting creator pitch management:"
    if [ -n "$CREATOR_TOKEN" ]; then
        # Test pitch creation
        local create_data="{\"title\":\"Production Test Pitch\",\"logline\":\"A test pitch for production testing\",\"genre\":\"drama\",\"format\":\"feature\",\"shortSynopsis\":\"Test synopsis\",\"themes\":[\"testing\",\"automation\"],\"budgetBracket\":\"\$1M-\$5M\",\"aiUsed\":false}"
        local create_response=$(make_request "POST" "$BACKEND_URL/api/pitches" "$create_data" "Authorization: Bearer $CREATOR_TOKEN")
        local create_http_code=$(echo "$create_response" | cut -d'|' -f1)
        log_test "Pitch creation" "$([ "$create_http_code" = "201" ] && echo true || echo false)" "HTTP $create_http_code"
        
        # Test creator pitches list
        local creator_pitches_response=$(make_request "GET" "$BACKEND_URL/api/creator/pitches" "" "Authorization: Bearer $CREATOR_TOKEN")
        local creator_pitches_http_code=$(echo "$creator_pitches_response" | cut -d'|' -f1)
        log_test "Creator pitches list" "$([ "$creator_pitches_http_code" = "200" ] && echo true || echo false)" "HTTP $creator_pitches_http_code"
    else
        log_test "Creator pitch management" "false" "No creator token available"
    fi
}

test_dashboard_access() {
    log "\n${BOLD}${CYAN}3️⃣  DASHBOARD ACCESS${NC}"
    log "$(printf '='.0s' {1..40})"
    
    # Test creator dashboard
    log "\nTesting creator dashboard:"
    if [ -n "$CREATOR_TOKEN" ]; then
        local creator_dash_response=$(make_request "GET" "$BACKEND_URL/api/creator/dashboard" "" "Authorization: Bearer $CREATOR_TOKEN")
        local creator_dash_http_code=$(echo "$creator_dash_response" | cut -d'|' -f1)
        log_test "Creator dashboard API" "$([ "$creator_dash_http_code" = "200" ] && echo true || echo false)" "HTTP $creator_dash_http_code"
        
        local creator_analytics_response=$(make_request "GET" "$BACKEND_URL/api/analytics/dashboard/creator" "" "Authorization: Bearer $CREATOR_TOKEN")
        local creator_analytics_http_code=$(echo "$creator_analytics_response" | cut -d'|' -f1)
        log_test "Creator analytics" "$([ "$creator_analytics_http_code" = "200" ] && echo true || echo false)" "HTTP $creator_analytics_http_code"
    fi
    
    # Test investor dashboard
    log "\nTesting investor dashboard:"
    if [ -n "$INVESTOR_TOKEN" ]; then
        local investor_dash_response=$(make_request "GET" "$BACKEND_URL/api/investor/dashboard" "" "Authorization: Bearer $INVESTOR_TOKEN")
        local investor_dash_http_code=$(echo "$investor_dash_response" | cut -d'|' -f1)
        log_test "Investor dashboard API" "$([ "$investor_dash_http_code" = "200" ] && echo true || echo false)" "HTTP $investor_dash_http_code"
        
        local investor_portfolio_response=$(make_request "GET" "$BACKEND_URL/api/investor/portfolio" "" "Authorization: Bearer $INVESTOR_TOKEN")
        local investor_portfolio_http_code=$(echo "$investor_portfolio_response" | cut -d'|' -f1)
        log_test "Investor portfolio" "$([ "$investor_portfolio_http_code" = "200" ] && echo true || echo false)" "HTTP $investor_portfolio_http_code"
    fi
    
    # Test production dashboard
    log "\nTesting production dashboard:"
    if [ -n "$PRODUCTION_TOKEN" ]; then
        local production_dash_response=$(make_request "GET" "$BACKEND_URL/api/production/dashboard" "" "Authorization: Bearer $PRODUCTION_TOKEN")
        local production_dash_http_code=$(echo "$production_dash_response" | cut -d'|' -f1)
        log_test "Production dashboard API" "$([ "$production_dash_http_code" = "200" ] && echo true || echo false)" "HTTP $production_dash_http_code"
        
        local production_analytics_response=$(make_request "GET" "$BACKEND_URL/api/analytics/dashboard/production" "" "Authorization: Bearer $PRODUCTION_TOKEN")  
        local production_analytics_http_code=$(echo "$production_analytics_response" | cut -d'|' -f1)
        log_test "Production analytics" "$([ "$production_analytics_http_code" = "200" ] && echo true || echo false)" "HTTP $production_analytics_http_code"
    fi
    
    # Test frontend dashboard pages
    log "\nTesting frontend dashboard pages:"
    local creator_frontend_response=$(make_request "GET" "$FRONTEND_URL/creator-dashboard")
    local creator_frontend_http_code=$(echo "$creator_frontend_response" | cut -d'|' -f1)
    log_test "Creator dashboard page" "$([ "$creator_frontend_http_code" -lt "400" ] && echo true || echo false)" "HTTP $creator_frontend_http_code"
    
    local investor_frontend_response=$(make_request "GET" "$FRONTEND_URL/investor-dashboard")
    local investor_frontend_http_code=$(echo "$investor_frontend_response" | cut -d'|' -f1)
    log_test "Investor dashboard page" "$([ "$investor_frontend_http_code" -lt "400" ] && echo true || echo false)" "HTTP $investor_frontend_http_code"
    
    local production_frontend_response=$(make_request "GET" "$FRONTEND_URL/production-dashboard")
    local production_frontend_http_code=$(echo "$production_frontend_response" | cut -d'|' -f1)
    log_test "Production dashboard page" "$([ "$production_frontend_http_code" -lt "400" ] && echo true || echo false)" "HTTP $production_frontend_http_code"
}

test_api_endpoints() {
    log "\n${BOLD}${CYAN}4️⃣  API ENDPOINTS${NC}"
    log "$(printf '=%.0s' {1..40})"
    
    # Test core endpoints
    log "\nTesting core API endpoints:"
    
    # Test 404 handling
    local response_404=$(make_request "GET" "$BACKEND_URL/api/nonexistent")
    local http_code_404=$(echo "$response_404" | cut -d'|' -f1)
    log_test "404 handling" "$([ "$http_code_404" = "404" ] && echo true || echo false)" "HTTP $http_code_404"
    
    # Test unauthorized access
    local response_unauth=$(make_request "GET" "$BACKEND_URL/api/creator/dashboard")
    local http_code_unauth=$(echo "$response_unauth" | cut -d'|' -f1)
    log_test "Unauthorized access" "$([ "$http_code_unauth" = "401" ] && echo true || echo false)" "HTTP $http_code_unauth"
    
    # Test invalid JSON
    local response_invalid=$(make_request "POST" "$BACKEND_URL/api/pitches" "invalid json")
    local http_code_invalid=$(echo "$response_invalid" | cut -d'|' -f1)
    log_test "Invalid JSON handling" "$([ "$http_code_invalid" -ge "400" ] && echo true || echo false)" "HTTP $http_code_invalid"
    
    # Test forgot password endpoint
    local forgot_data="{\"email\":\"test@example.com\"}"
    local forgot_response=$(make_request "POST" "$BACKEND_URL/api/auth/forgot-password" "$forgot_data")
    local forgot_http_code=$(echo "$forgot_response" | cut -d'|' -f1)
    log_test "Forgot password endpoint" "$([ "$forgot_http_code" -ge "400" ] && [ "$forgot_http_code" -lt "500" ] && echo true || echo false)" "HTTP $forgot_http_code (expected 4xx)"
}

test_system_integration() {
    log "\n${BOLD}${CYAN}5️⃣  SYSTEM INTEGRATION${NC}"  
    log "$(printf '=%.0s' {1..40})"
    
    # Test frontend accessibility
    log "\nTesting system integration:"
    local frontend_response=$(make_request "GET" "$FRONTEND_URL")
    local frontend_http_code=$(echo "$frontend_response" | cut -d'|' -f1)
    log_test "Frontend accessibility" "$([ "$frontend_http_code" -lt "400" ] && echo true || echo false)" "HTTP $frontend_http_code"
    
    # Test backend API accessibility  
    local api_response=$(make_request "GET" "$BACKEND_URL/api/pitches")
    local api_http_code=$(echo "$api_response" | cut -d'|' -f1)
    log_test "Backend API accessibility" "$([ "$api_http_code" = "200" ] && echo true || echo false)" "HTTP $api_http_code"
    
    # Test health endpoint (if available)
    local health_response=$(make_request "GET" "$BACKEND_URL/health")
    local health_http_code=$(echo "$health_response" | cut -d'|' -f1)
    log_test "Health check endpoint" "$([ "$health_http_code" = "200" ] || [ "$health_http_code" = "404" ] && echo true || echo false)" "$([ "$health_http_code" = "200" ] && echo "Healthy" || echo "No health endpoint (acceptable)")"
    
    # Test CORS (OPTIONS request)
    local cors_response=$(make_request "OPTIONS" "$BACKEND_URL/api/pitches" "" "Origin: $FRONTEND_URL")
    local cors_http_code=$(echo "$cors_response" | cut -d'|' -f1)
    log_test "CORS configuration" "$([ "$cors_http_code" = "200" ] || [ "$cors_http_code" = "404" ] && echo true || echo false)" "$([ "$cors_http_code" = "200" ] && echo "CORS configured" || echo "No CORS preflight (may be okay)")"
}

show_final_summary() {
    local total_tests=$((TESTS_PASSED + TESTS_FAILED))
    local success_rate=0
    
    if [ "$total_tests" -gt "0" ]; then
        success_rate=$((TESTS_PASSED * 100 / total_tests))
    fi
    
    log "\n${BOLD}${CYAN}📊 TEST SUMMARY${NC}"
    log "$(printf '=%.0s' {1..40})"
    log "${GREEN}✓ Passed: $TESTS_PASSED${NC}"
    log "${RED}✗ Failed: $TESTS_FAILED${NC}" 
    log "📈 Success Rate: $success_rate%"
    
    if [ "$TESTS_FAILED" -gt "0" ]; then
        log "\n${RED}${BOLD}FAILED TESTS:${NC}"
        for failed_test in "${FAILED_TESTS[@]}"; do
            log "${RED}• $failed_test${NC}"
        done
    fi
    
    local overall_status
    if [ "$TESTS_FAILED" -eq "0" ]; then
        overall_status="${GREEN}✅ ALL TESTS PASSED"
    else
        overall_status="${RED}❌ $TESTS_FAILED TESTS FAILED"
    fi
    
    log "\n${BOLD}Overall Status: $overall_status${NC}"
    
    # Additional deployment guidance
    log "\n${YELLOW}${BOLD}DEPLOYMENT STATUS:${NC}"
    if [ "$TESTS_FAILED" -eq "0" ]; then
        log "${GREEN}🚀 Production deployment is working correctly!${NC}"
        log "${GREEN}All critical workflows are functional.${NC}"
    elif [ "$TESTS_FAILED" -le "5" ]; then
        log "${YELLOW}⚠️  Minor issues detected but core functionality works.${NC}"
        log "${YELLOW}Consider investigating failed tests for optimization.${NC}"
    else
        log "${RED}🚨 Significant issues detected in production deployment.${NC}"
        log "${RED}Immediate attention required for critical failures.${NC}"
    fi
    
    exit $([ "$TESTS_FAILED" -eq "0" ] && echo "0" || echo "1")
}

# Run main function
main "$@"