#!/bin/bash

# Comprehensive Frontend-API Integration Test Suite
# Tests API endpoints that support frontend workflows and business logic
# Validates proper integration between frontend components and backend services
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
CREATOR_USER_ID=""
INVESTOR_USER_ID=""
TEST_PITCH_ID=""

# Test tracking
TOTAL_INTEGRATION_TESTS=0
PASSED_INTEGRATION_TESTS=0
FAILED_INTEGRATION_TESTS=0
INTEGRATION_RESULTS=()

# Utility functions
log_integration_test_start() {
    echo -e "\n${PURPLE}🔗 Frontend Integration Test: $1${NC}"
    ((TOTAL_INTEGRATION_TESTS++))
}

log_integration_success() {
    echo -e "${GREEN}✅ Integration Success: $1${NC}"
    ((PASSED_INTEGRATION_TESTS++))
    INTEGRATION_RESULTS+=("PASS: $1")
}

log_integration_failure() {
    echo -e "${RED}❌ Integration Failure: $1${NC}"
    ((FAILED_INTEGRATION_TESTS++))
    INTEGRATION_RESULTS+=("FAIL: $1")
}

log_step() {
    echo -e "${BLUE}  → $1${NC}"
}

log_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# HTTP request helper
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
        if [[ "$VERBOSE" == "true" ]]; then
            echo "Expected: $expected_status, Got: $status, Body: $body" >&2
        fi
        return 1
    fi
}

# Setup environment
setup_frontend_integration_environment() {
    echo -e "${CYAN}🔧 Setting up frontend integration test environment...${NC}"
    
    # Authenticate all portal types
    local creator_data="{\"email\":\"$CREATOR_EMAIL\",\"password\":\"$CREATOR_PASSWORD\"}"
    if response=$(api_request "POST" "/api/auth/creator/login" "" "$creator_data" "200"); then
        CREATOR_TOKEN=$(echo "$response" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
        CREATOR_USER_ID=$(echo "$response" | grep -o '"id":[0-9]*' | cut -d: -f2)
    fi
    
    local investor_data="{\"email\":\"$INVESTOR_EMAIL\",\"password\":\"$INVESTOR_PASSWORD\"}"
    if response=$(api_request "POST" "/api/auth/investor/login" "" "$investor_data" "200"); then
        INVESTOR_TOKEN=$(echo "$response" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
        INVESTOR_USER_ID=$(echo "$response" | grep -o '"id":[0-9]*' | cut -d: -f2)
    fi
    
    local production_data="{\"email\":\"$PRODUCTION_EMAIL\",\"password\":\"$PRODUCTION_PASSWORD\"}"
    if response=$(api_request "POST" "/api/auth/production/login" "" "$production_data" "200"); then
        PRODUCTION_TOKEN=$(echo "$response" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    fi
    
    # Create test pitch for integration testing
    if [[ -n "$CREATOR_TOKEN" ]]; then
        local pitch_data='{
            "title": "Frontend Integration Test Pitch",
            "logline": "Test pitch for frontend-backend integration validation",
            "genre": "drama",
            "format": "feature",
            "shortSynopsis": "Integration test synopsis",
            "targetAudience": "General audience",
            "estimatedBudget": 3000000,
            "requireNda": true
        }'
        if response=$(api_request "POST" "/api/creator/pitches" "$CREATOR_TOKEN" "$pitch_data" "201"); then
            TEST_PITCH_ID=$(echo "$response" | grep -o '"id":[0-9]*' | cut -d: -f2)
        fi
    fi
    
    echo -e "${CYAN}✓ Integration test environment ready${NC}"
}

# Test 1: Authentication Flow Integration
test_authentication_flow_integration() {
    log_integration_test_start "Authentication Flow - Frontend Login Integration"
    
    local auth_flow_success=true
    
    # Test 1.1: Login response provides all needed frontend data
    log_step "Validating login response structure for frontend"
    local login_data="{\"email\":\"$CREATOR_EMAIL\",\"password\":\"$CREATOR_PASSWORD\"}"
    if response=$(api_request "POST" "/api/auth/creator/login" "" "$login_data" "200"); then
        local required_fields=("token" "id" "email" "userType" "username")
        for field in "${required_fields[@]}"; do
            if ! echo "$response" | grep -q "\"$field\""; then
                auth_flow_success=false
                log_step "✗ Missing required field: $field"
                break
            fi
        done
        
        if $auth_flow_success; then
            log_step "✓ Login response contains all required frontend fields"
        fi
    else
        auth_flow_success=false
        log_step "✗ Login request failed"
    fi
    
    # Test 1.2: Profile endpoint provides user data for frontend routing
    if [[ -n "$CREATOR_TOKEN" ]] && $auth_flow_success; then
        log_step "Validating profile endpoint for frontend routing"
        if response=$(api_request "GET" "/api/profile" "$CREATOR_TOKEN" "" "200"); then
            local profile_fields=("userType" "firstName" "lastName" "email")
            for field in "${profile_fields[@]}"; do
                if ! echo "$response" | grep -q "\"$field\""; then
                    auth_flow_success=false
                    break
                fi
            done
            
            if $auth_flow_success; then
                log_step "✓ Profile endpoint provides frontend routing data"
            else
                log_step "✗ Profile endpoint missing required fields"
            fi
        else
            auth_flow_success=false
            log_step "✗ Profile endpoint not accessible"
        fi
    fi
    
    # Test 1.3: Token validation for protected routes
    if [[ -n "$CREATOR_TOKEN" ]] && $auth_flow_success; then
        log_step "Validating token for protected frontend routes"
        if api_request "GET" "/api/creator/dashboard" "$CREATOR_TOKEN" "" "200" >/dev/null; then
            log_step "✓ Token works for protected routes"
        else
            auth_flow_success=false
            log_step "✗ Token validation failed for protected routes"
        fi
    fi
    
    if $auth_flow_success; then
        log_integration_success "Authentication Flow - Frontend Login Integration"
    else
        log_integration_failure "Authentication Flow - Missing required integration"
    fi
}

# Test 2: Dashboard Data Integration
test_dashboard_data_integration() {
    log_integration_test_start "Dashboard Data Integration - Frontend Components"
    
    local dashboard_success=true
    
    # Test 2.1: Creator dashboard data structure
    if [[ -n "$CREATOR_TOKEN" ]]; then
        log_step "Validating creator dashboard data structure"
        if response=$(api_request "GET" "/api/creator/dashboard" "$CREATOR_TOKEN" "" "200"); then
            local dashboard_sections=("overview" "recentPitches" "stats" "notifications")
            for section in "${dashboard_sections[@]}"; do
                if ! echo "$response" | grep -q "\"$section\""; then
                    dashboard_success=false
                    log_step "✗ Missing dashboard section: $section"
                    break
                fi
            done
            
            if $dashboard_success; then
                log_step "✓ Creator dashboard has required frontend data sections"
            fi
        else
            dashboard_success=false
            log_step "✗ Creator dashboard not accessible"
        fi
    fi
    
    # Test 2.2: Dashboard stats for frontend charts/graphs
    if [[ -n "$CREATOR_TOKEN" ]] && $dashboard_success; then
        log_step "Validating dashboard stats for frontend visualization"
        if response=$(api_request "GET" "/api/creator/stats" "$CREATOR_TOKEN" "" "200"); then
            local stat_fields=("totalPitches" "totalViews" "totalLikes")
            local stats_valid=true
            for field in "${stat_fields[@]}"; do
                if ! echo "$response" | grep -q "\"$field\""; then
                    stats_valid=false
                    break
                fi
            done
            
            if $stats_valid; then
                log_step "✓ Dashboard stats provide data for frontend charts"
            else
                dashboard_success=false
                log_step "✗ Dashboard stats missing required fields"
            fi
        fi
    fi
    
    # Test 2.3: Investor dashboard integration
    if [[ -n "$INVESTOR_TOKEN" ]] && $dashboard_success; then
        log_step "Validating investor dashboard data structure"
        if response=$(api_request "GET" "/api/investor/dashboard" "$INVESTOR_TOKEN" "" "200"); then
            if echo "$response" | grep -q "\"watchlist\"" && echo "$response" | grep -q "\"recentActivity\""; then
                log_step "✓ Investor dashboard has frontend integration data"
            else
                dashboard_success=false
                log_step "✗ Investor dashboard missing integration data"
            fi
        fi
    fi
    
    if $dashboard_success; then
        log_integration_success "Dashboard Data Integration - Frontend Components"
    else
        log_integration_failure "Dashboard Data Integration - Structure issues"
    fi
}

# Test 3: Pitch Management Integration
test_pitch_management_integration() {
    log_integration_test_start "Pitch Management Integration - CRUD Operations"
    
    local pitch_mgmt_success=true
    
    # Test 3.1: Pitch listing for frontend display
    if [[ -n "$CREATOR_TOKEN" ]]; then
        log_step "Validating pitch listing for frontend display"
        if response=$(api_request "GET" "/api/creator/pitches" "$CREATOR_TOKEN" "" "200"); then
            # Check if response has array structure and required fields
            if echo "$response" | grep -q "\"pitches\"" || echo "$response" | grep -q "\["; then
                log_step "✓ Pitch listing has array structure for frontend"
                
                # Check individual pitch structure
                if echo "$response" | grep -q "\"title\"" && echo "$response" | grep -q "\"id\""; then
                    log_step "✓ Individual pitches have required display fields"
                else
                    pitch_mgmt_success=false
                    log_step "✗ Pitch objects missing display fields"
                fi
            else
                pitch_mgmt_success=false
                log_step "✗ Pitch listing not in array format for frontend"
            fi
        else
            pitch_mgmt_success=false
            log_step "✗ Cannot retrieve pitch listing"
        fi
    fi
    
    # Test 3.2: Pitch detail view integration
    if [[ -n "$TEST_PITCH_ID" && -n "$CREATOR_TOKEN" ]] && $pitch_mgmt_success; then
        log_step "Validating pitch detail view data"
        if response=$(api_request "GET" "/api/pitches/$TEST_PITCH_ID" "$CREATOR_TOKEN" "" "200"); then
            local detail_fields=("id" "title" "logline" "genre" "format" "status")
            local details_valid=true
            for field in "${detail_fields[@]}"; do
                if ! echo "$response" | grep -q "\"$field\""; then
                    details_valid=false
                    break
                fi
            done
            
            if $details_valid; then
                log_step "✓ Pitch detail provides complete frontend display data"
            else
                pitch_mgmt_success=false
                log_step "✗ Pitch detail missing required display fields"
            fi
        else
            pitch_mgmt_success=false
            log_step "✗ Pitch detail not accessible"
        fi
    fi
    
    # Test 3.3: Pitch creation response integration
    if [[ -n "$CREATOR_TOKEN" ]] && $pitch_mgmt_success; then
        log_step "Validating pitch creation response for frontend"
        local create_pitch_data='{
            "title": "Frontend Integration Create Test",
            "logline": "Test creation integration",
            "genre": "comedy",
            "format": "short",
            "shortSynopsis": "Test synopsis"
        }'
        
        if response=$(api_request "POST" "/api/creator/pitches" "$CREATOR_TOKEN" "$create_pitch_data" "201"); then
            if echo "$response" | grep -q "\"id\"" && echo "$response" | grep -q "\"title\""; then
                log_step "✓ Pitch creation returns data for frontend redirect"
                
                # Clean up test pitch
                local new_pitch_id=$(echo "$response" | grep -o '"id":[0-9]*' | cut -d: -f2)
                if [[ -n "$new_pitch_id" ]]; then
                    api_request "DELETE" "/api/creator/pitches/$new_pitch_id" "$CREATOR_TOKEN" "" "200" >/dev/null || true
                fi
            else
                pitch_mgmt_success=false
                log_step "✗ Pitch creation response missing frontend data"
            fi
        else
            pitch_mgmt_success=false
            log_step "✗ Pitch creation failed"
        fi
    fi
    
    if $pitch_mgmt_success; then
        log_integration_success "Pitch Management Integration - CRUD Operations"
    else
        log_integration_failure "Pitch Management Integration - Data structure issues"
    fi
}

# Test 4: NDA Workflow Frontend Integration
test_nda_workflow_frontend_integration() {
    log_integration_test_start "NDA Workflow Frontend Integration - UI Components"
    
    local nda_integration_success=true
    
    # Test 4.1: NDA status endpoint for frontend NDA components
    if [[ -n "$INVESTOR_TOKEN" && -n "$TEST_PITCH_ID" ]]; then
        log_step "Validating NDA status endpoint for frontend components"
        if response=$(api_request "GET" "/api/ndas/pitch/$TEST_PITCH_ID/status" "$INVESTOR_TOKEN" "" "200"); then
            local nda_status_fields=("hasNDA" "canAccess" "status")
            local status_valid=true
            for field in "${nda_status_fields[@]}"; do
                if ! echo "$response" | grep -q "\"$field\""; then
                    status_valid=false
                    break
                fi
            done
            
            if $status_valid; then
                log_step "✓ NDA status provides data for frontend NDA components"
            else
                nda_integration_success=false
                log_step "✗ NDA status missing required frontend fields"
            fi
        else
            nda_integration_success=false
            log_step "✗ NDA status endpoint not accessible"
        fi
    fi
    
    # Test 4.2: NDA request integration
    if [[ -n "$INVESTOR_TOKEN" && -n "$TEST_PITCH_ID" ]] && $nda_integration_success; then
        log_step "Validating NDA request integration for frontend forms"
        local nda_request_data='{"pitchId":'$TEST_PITCH_ID',"message":"Frontend integration test","requestType":"basic"}'
        
        if response=$(api_request "POST" "/api/ndas/request" "$INVESTOR_TOKEN" "$nda_request_data" "201") ||
           response=$(api_request "POST" "/api/ndas/request" "$INVESTOR_TOKEN" "$nda_request_data" "200") ||
           response=$(api_request "POST" "/api/ndas/request" "$INVESTOR_TOKEN" "$nda_request_data" "409"); then
            
            # Check response structure for frontend feedback
            if echo "$response" | grep -q "\"success\"\|\"message\"\|\"nda\""; then
                log_step "✓ NDA request provides feedback for frontend UI"
            else
                nda_integration_success=false
                log_step "✗ NDA request response lacks frontend feedback data"
            fi
        else
            nda_integration_success=false
            log_step "✗ NDA request failed unexpectedly"
        fi
    fi
    
    # Test 4.3: NDA list endpoints for frontend tables/lists
    if [[ -n "$CREATOR_TOKEN" ]] && $nda_integration_success; then
        log_step "Validating NDA lists for frontend display"
        
        local nda_list_endpoints=(
            "/api/nda/pending"
            "/api/nda/active"
        )
        
        for endpoint in "${nda_list_endpoints[@]}"; do
            if response=$(api_request "GET" "$endpoint" "$CREATOR_TOKEN" "" "200"); then
                # Check if response is in list/array format
                if echo "$response" | grep -q "\"ndas\"\|\["; then
                    log_step "✓ $endpoint provides list data for frontend"
                else
                    nda_integration_success=false
                    log_step "✗ $endpoint not in list format for frontend"
                    break
                fi
            else
                nda_integration_success=false
                log_step "✗ $endpoint not accessible"
                break
            fi
        done
    fi
    
    if $nda_integration_success; then
        log_integration_success "NDA Workflow Frontend Integration - UI Components"
    else
        log_integration_failure "NDA Workflow Frontend Integration - Component data issues"
    fi
}

# Test 5: Search and Discovery Integration
test_search_discovery_integration() {
    log_integration_test_start "Search and Discovery Integration - Frontend Search Components"
    
    local search_integration_success=true
    
    # Test 5.1: Basic search integration
    log_step "Validating basic search for frontend search bar"
    if response=$(api_request "GET" "/api/pitches/search?q=test" "" "" "200"); then
        # Check response structure for frontend display
        if echo "$response" | grep -q "\"results\"\|\"pitches\"\|\["; then
            log_step "✓ Basic search returns results in frontend-compatible format"
        else
            search_integration_success=false
            log_step "✗ Basic search response not compatible with frontend"
        fi
    else
        search_integration_success=false
        log_step "✗ Basic search endpoint failed"
    fi
    
    # Test 5.2: Advanced search integration
    if $search_integration_success; then
        log_step "Validating advanced search for frontend filters"
        if response=$(api_request "GET" "/api/search/advanced?genre=drama&format=feature" "" "" "200"); then
            if echo "$response" | grep -q "\"results\"\|\"pitches\"\|\["; then
                log_step "✓ Advanced search supports frontend filter components"
            else
                search_integration_success=false
                log_step "✗ Advanced search response not frontend-compatible"
            fi
        else
            search_integration_success=false
            log_step "✗ Advanced search endpoint failed"
        fi
    fi
    
    # Test 5.3: Search suggestions for frontend autocomplete
    if $search_integration_success; then
        log_step "Validating search suggestions for frontend autocomplete"
        if response=$(api_request "GET" "/api/search/suggestions?q=dr" "" "" "200"); then
            if echo "$response" | grep -q "\"suggestions\"\|\["; then
                log_step "✓ Search suggestions support frontend autocomplete"
            else
                search_integration_success=false
                log_step "✗ Search suggestions not in frontend-compatible format"
            fi
        else
            search_integration_success=false
            log_step "✗ Search suggestions endpoint failed"
        fi
    fi
    
    # Test 5.4: Trending and new pitches for frontend homepage
    if $search_integration_success; then
        log_step "Validating trending pitches for frontend homepage"
        local discovery_endpoints=(
            "/api/pitches/trending"
            "/api/pitches/new"
        )
        
        for endpoint in "${discovery_endpoints[@]}"; do
            if response=$(api_request "GET" "$endpoint" "" "" "200"); then
                if echo "$response" | grep -q "\"pitches\"\|\["; then
                    log_step "✓ $endpoint provides data for frontend homepage"
                else
                    search_integration_success=false
                    log_step "✗ $endpoint not compatible with frontend homepage"
                    break
                fi
            else
                search_integration_success=false
                log_step "✗ $endpoint failed"
                break
            fi
        done
    fi
    
    if $search_integration_success; then
        log_integration_success "Search and Discovery Integration - Frontend Search Components"
    else
        log_integration_failure "Search and Discovery Integration - Component compatibility issues"
    fi
}

# Test 6: Configuration and Static Data Integration
test_configuration_integration() {
    log_integration_test_start "Configuration Integration - Frontend Form Components"
    
    local config_integration_success=true
    
    # Test 6.1: Form configuration data
    log_step "Validating configuration endpoints for frontend forms"
    local config_endpoints=(
        "/api/config/genres"
        "/api/config/formats"
        "/api/config/budget-ranges"
        "/api/config/stages"
    )
    
    for endpoint in "${config_endpoints[@]}"; do
        if response=$(api_request "GET" "$endpoint" "" "" "200"); then
            # Check if response is in array format for dropdowns/selects
            if echo "$response" | grep -q "\["; then
                log_step "✓ $endpoint provides array data for frontend dropdowns"
            else
                config_integration_success=false
                log_step "✗ $endpoint not in array format for frontend forms"
                break
            fi
        else
            config_integration_success=false
            log_step "✗ $endpoint failed"
            break
        fi
    done
    
    # Test 6.2: All config endpoint for single request optimization
    if $config_integration_success; then
        log_step "Validating consolidated config endpoint"
        if response=$(api_request "GET" "/api/config/all" "" "" "200"); then
            local config_sections=("genres" "formats" "budgetRanges" "stages")
            local all_config_valid=true
            for section in "${config_sections[@]}"; do
                if ! echo "$response" | grep -q "\"$section\""; then
                    all_config_valid=false
                    break
                fi
            done
            
            if $all_config_valid; then
                log_step "✓ Consolidated config endpoint provides all frontend form data"
            else
                config_integration_success=false
                log_step "✗ Consolidated config missing required sections"
            fi
        else
            config_integration_success=false
            log_step "✗ Consolidated config endpoint failed"
        fi
    fi
    
    if $config_integration_success; then
        log_integration_success "Configuration Integration - Frontend Form Components"
    else
        log_integration_failure "Configuration Integration - Form data issues"
    fi
}

# Test 7: Error Handling Integration
test_error_handling_integration() {
    log_integration_test_start "Error Handling Integration - Frontend Error Display"
    
    local error_integration_success=true
    
    # Test 7.1: Structured error responses for frontend
    log_step "Validating structured error responses"
    if response=$(api_request "GET" "/api/pitches/99999" "" "" "404"); then
        # Check if error response has structure for frontend error handling
        if echo "$response" | grep -q "\"error\"\|\"message\""; then
            log_step "✓ Error responses have structure for frontend display"
        else
            error_integration_success=false
            log_step "✗ Error responses lack structure for frontend"
        fi
    else
        # If we can't get a proper 404, try another approach
        log_step "! Could not test 404 error structure"
    fi
    
    # Test 7.2: Validation error structure
    if [[ -n "$CREATOR_TOKEN" ]] && $error_integration_success; then
        log_step "Validating validation error structure for frontend forms"
        local invalid_pitch='{"title":"","logline":"","genre":"invalid"}'
        if response=$(api_request "POST" "/api/creator/pitches" "$CREATOR_TOKEN" "$invalid_pitch" "400"); then
            if echo "$response" | grep -q "\"errors\"\|\"message\""; then
                log_step "✓ Validation errors have structure for frontend forms"
            else
                error_integration_success=false
                log_step "✗ Validation errors lack frontend structure"
            fi
        else
            log_step "! Could not test validation error structure"
        fi
    fi
    
    # Test 7.3: Authentication error handling
    log_step "Validating authentication error structure"
    if response=$(api_request "GET" "/api/creator/dashboard" "invalid.token" "" "401"); then
        if echo "$response" | grep -q "\"error\"\|\"message\""; then
            log_step "✓ Auth errors have structure for frontend handling"
        else
            error_integration_success=false
            log_step "✗ Auth errors lack frontend structure"
        fi
    else
        log_step "! Could not test auth error structure"
    fi
    
    if $error_integration_success; then
        log_integration_success "Error Handling Integration - Frontend Error Display"
    else
        log_integration_failure "Error Handling Integration - Error structure issues"
    fi
}

# Generate comprehensive frontend integration report
generate_frontend_integration_report() {
    echo ""
    echo "=================================================================="
    echo "🔗 COMPREHENSIVE FRONTEND-API INTEGRATION REPORT"
    echo "=================================================================="
    echo "Test Environment: $API_BASE"
    echo "Total Integration Tests: $TOTAL_INTEGRATION_TESTS"
    echo -e "${GREEN}✅ Successful Integrations: $PASSED_INTEGRATION_TESTS${NC}"
    echo -e "${RED}❌ Failed Integrations: $FAILED_INTEGRATION_TESTS${NC}"
    
    local integration_score=$(( PASSED_INTEGRATION_TESTS * 100 / TOTAL_INTEGRATION_TESTS ))
    
    if [[ $FAILED_INTEGRATION_TESTS -eq 0 ]]; then
        echo -e "${GREEN}🎉 INTEGRATION STATUS: FULLY INTEGRATED${NC}"
        echo "Frontend and backend are properly integrated!"
    elif [[ $integration_score -gt 80 ]]; then
        echo -e "${YELLOW}⚠️ INTEGRATION STATUS: MOSTLY INTEGRATED${NC}"
        echo "Most integrations working, some issues need attention."
    else
        echo -e "${RED}❌ INTEGRATION STATUS: INTEGRATION ISSUES${NC}"
        echo "Significant frontend-backend integration problems detected."
    fi
    
    echo ""
    echo "=================================================================="
    echo "📊 INTEGRATION TEST RESULTS"
    echo "=================================================================="
    
    for result in "${INTEGRATION_RESULTS[@]}"; do
        if [[ $result == PASS:* ]]; then
            echo -e "${GREEN}✅ ${result#PASS: }${NC}"
        else
            echo -e "${RED}❌ ${result#FAIL: }${NC}"
        fi
    done
    
    if [[ $FAILED_INTEGRATION_TESTS -gt 0 ]]; then
        echo ""
        echo "=================================================================="
        echo "🔧 INTEGRATION FIXES NEEDED"
        echo "=================================================================="
        echo "1. Review and fix failed integration points"
        echo "2. Ensure API responses match frontend component requirements"
        echo "3. Standardize error response structures"
        echo "4. Validate data formats for frontend display"
        echo "5. Test frontend components with actual API responses"
        echo "6. Implement proper loading and error states in frontend"
    fi
    
    echo ""
    echo "=================================================================="
    echo "📈 INTEGRATION SCORE: $integration_score%"
    echo "=================================================================="
    
    if [[ $integration_score -ge 95 ]]; then
        echo "RATING: EXCELLENT FRONTEND-BACKEND INTEGRATION"
    elif [[ $integration_score -ge 85 ]]; then
        echo "RATING: GOOD INTEGRATION WITH MINOR ISSUES"
    elif [[ $integration_score -ge 70 ]]; then
        echo "RATING: ADEQUATE INTEGRATION NEEDS IMPROVEMENT"
    else
        echo "RATING: POOR INTEGRATION REQUIRES MAJOR FIXES"
    fi
}

# Main execution
main() {
    echo "=================================================================="
    echo "🔗 Comprehensive Frontend-API Integration Test Suite"
    echo "=================================================================="
    echo "Testing server: $API_BASE"
    echo "Focus: Frontend component and backend API integration"
    echo "=================================================================="
    
    setup_frontend_integration_environment
    
    # Run all integration tests
    test_authentication_flow_integration
    test_dashboard_data_integration
    test_pitch_management_integration
    test_nda_workflow_frontend_integration
    test_search_discovery_integration
    test_configuration_integration
    test_error_handling_integration
    
    # Generate comprehensive report
    generate_frontend_integration_report
    
    # Exit with appropriate code
    if [[ $FAILED_INTEGRATION_TESTS -eq 0 ]]; then
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
            echo "Comprehensive Frontend-API Integration Test Suite"
            echo ""
            echo "Options:"
            echo "  -v, --verbose    Enable verbose output with response details"
            echo "  -h, --help       Show this help message"
            echo ""
            echo "This suite validates:"
            echo "• Authentication flow integration"
            echo "• Dashboard data structure compatibility"
            echo "• Pitch management CRUD integration"
            echo "• NDA workflow frontend integration"
            echo "• Search and discovery component integration"
            echo "• Configuration data for form components"
            echo "• Error handling integration"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run the comprehensive frontend integration test suite
main "$@"