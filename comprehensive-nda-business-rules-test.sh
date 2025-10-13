#!/bin/bash

# Comprehensive NDA Business Rules Validation Test Suite
# Tests proper business logic for all portal types and workflow scenarios
# Server: localhost:8001

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test configuration
API_BASE="http://localhost:8001"
VERBOSE=${VERBOSE:-false}

# Demo user accounts for different portal types
CREATOR_EMAIL="alex.creator@demo.com"
CREATOR_PASSWORD="Demo123"
INVESTOR_EMAIL="sarah.investor@demo.com"
INVESTOR_PASSWORD="Demo123"
PRODUCTION_EMAIL="stellar.production@demo.com"
PRODUCTION_PASSWORD="Demo123"

# Global variables for tokens and test data
CREATOR_TOKEN=""
INVESTOR_TOKEN=""
PRODUCTION_TOKEN=""
CREATOR_USER_ID=""
INVESTOR_USER_ID=""
PRODUCTION_USER_ID=""
CREATOR_PITCH_ID=""
PRODUCTION_PITCH_ID=""
INVESTOR_PITCH_ID=""

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
BUSINESS_RULES_VIOLATIONS=()
SUCCESSFUL_RULES=()

# Utility functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED_TESTS++))
    SUCCESSFUL_RULES+=("$1")
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED_TESTS++))
    BUSINESS_RULES_VIOLATIONS+=("$1")
}

log_test_start() {
    echo -e "\n${PURPLE}🧪 Testing Business Rule: $1${NC}"
    ((TOTAL_TESTS++))
}

log_section() {
    echo -e "\n${CYAN}📋 $1${NC}"
    echo -e "${CYAN}$(printf '=%.0s' {1..60})${NC}"
}

# HTTP request helper with improved error handling
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
    
    if [[ "$VERBOSE" == "true" ]]; then
        log_info "Request: $curl_cmd"
    fi
    
    local response
    response=$(eval "$curl_cmd")
    
    local body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]+$//')
    local status=$(echo "$response" | grep -o 'HTTPSTATUS:[0-9]*$' | cut -d: -f2)
    
    if [[ "$status" == "$expected_status" ]]; then
        if [[ "$VERBOSE" == "true" ]]; then
            log_info "Response ($status): $body"
        fi
        echo "$body"
        return 0
    else
        if [[ "$VERBOSE" == "true" ]]; then
            log_error "Expected status $expected_status, got $status for $method $endpoint"
            log_error "Response body: $body"
        fi
        return 1
    fi
}

# Extract JSON field from response
extract_json_field() {
    local json="$1"
    local field="$2"
    echo "$json" | grep -o "\"$field\":[^,}]*" | cut -d: -f2 | tr -d '"' | tr -d ' ' | tr -d ','
}

# Authentication setup for all portal types
setup_authentication() {
    log_section "Setting up Authentication for All Portal Types"
    
    # Authenticate Creator
    log_info "Authenticating Creator portal user..."
    local creator_data="{\"email\":\"$CREATOR_EMAIL\",\"password\":\"$CREATOR_PASSWORD\"}"
    if response=$(api_request "POST" "/api/auth/creator/login" "" "$creator_data" "200"); then
        CREATOR_TOKEN=$(extract_json_field "$response" "token")
        CREATOR_USER_ID=$(extract_json_field "$response" "id")
        if [[ -n "$CREATOR_TOKEN" ]]; then
            log_success "Creator authentication successful (ID: $CREATOR_USER_ID)"
        else
            log_error "Creator token not found in response"
            return 1
        fi
    else
        log_error "Creator authentication failed"
        return 1
    fi
    
    # Authenticate Investor
    log_info "Authenticating Investor portal user..."
    local investor_data="{\"email\":\"$INVESTOR_EMAIL\",\"password\":\"$INVESTOR_PASSWORD\"}"
    if response=$(api_request "POST" "/api/auth/investor/login" "" "$investor_data" "200"); then
        INVESTOR_TOKEN=$(extract_json_field "$response" "token")
        INVESTOR_USER_ID=$(extract_json_field "$response" "id")
        if [[ -n "$INVESTOR_TOKEN" ]]; then
            log_success "Investor authentication successful (ID: $INVESTOR_USER_ID)"
        else
            log_error "Investor token not found in response"
            return 1
        fi
    else
        log_error "Investor authentication failed"
        return 1
    fi
    
    # Authenticate Production Company
    log_info "Authenticating Production portal user..."
    local production_data="{\"email\":\"$PRODUCTION_EMAIL\",\"password\":\"$PRODUCTION_PASSWORD\"}"
    if response=$(api_request "POST" "/api/auth/production/login" "" "$production_data" "200"); then
        PRODUCTION_TOKEN=$(extract_json_field "$response" "token")
        PRODUCTION_USER_ID=$(extract_json_field "$response" "id")
        if [[ -n "$PRODUCTION_TOKEN" ]]; then
            log_success "Production authentication successful (ID: $PRODUCTION_USER_ID)"
        else
            log_error "Production token not found in response"
            return 1
        fi
    else
        log_error "Production authentication failed"
        return 1
    fi
}

# Setup test pitches for different scenarios
setup_test_pitches() {
    log_section "Setting up Test Pitches for Business Rule Validation"
    
    # Create a Creator pitch
    log_info "Creating Creator pitch for testing..."
    local creator_pitch_data='{
        "title": "Creator Test Pitch - NDA Rules Validation",
        "logline": "A test pitch created by creator for NDA business rules validation",
        "genre": "drama",
        "format": "feature",
        "shortSynopsis": "Test synopsis for business rules validation",
        "targetAudience": "General audience",
        "estimatedBudget": 5000000,
        "requireNda": true
    }'
    
    if response=$(api_request "POST" "/api/creator/pitches" "$CREATOR_TOKEN" "$creator_pitch_data" "201"); then
        CREATOR_PITCH_ID=$(extract_json_field "$response" "id")
        if [[ -n "$CREATOR_PITCH_ID" ]]; then
            log_success "Creator pitch created successfully (ID: $CREATOR_PITCH_ID)"
        else
            log_error "Creator pitch ID not found in response"
        fi
    else
        log_error "Failed to create Creator pitch"
    fi
    
    # Get existing production pitch for testing
    log_info "Finding Production company pitch for testing..."
    if response=$(api_request "GET" "/api/pitches/public" "" "" "200"); then
        # Try to extract a production pitch ID from the response
        PRODUCTION_PITCH_ID=$(echo "$response" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
        if [[ -n "$PRODUCTION_PITCH_ID" ]]; then
            log_success "Found Production pitch for testing (ID: $PRODUCTION_PITCH_ID)"
        else
            log_warning "No production pitches found, will use creator pitch as fallback"
            PRODUCTION_PITCH_ID=$CREATOR_PITCH_ID
        fi
    fi
}

# Test Rule 1: Creators should NOT require NDA for their own pitches
test_creator_own_pitch_access() {
    log_test_start "Rule 1: Creators can access their own pitches without NDA"
    
    if [[ -z "$CREATOR_TOKEN" || -z "$CREATOR_PITCH_ID" ]]; then
        log_error "Creator credentials or pitch not available for testing"
        return
    fi
    
    # Creator should be able to access their own pitch without NDA
    if api_request "GET" "/api/pitches/$CREATOR_PITCH_ID" "$CREATOR_TOKEN" "" "200" >/dev/null; then
        log_success "Creator can access their own pitch without NDA requirement"
    else
        log_error "BUSINESS RULE VIOLATION: Creator cannot access their own pitch"
    fi
    
    # Creator should NOT be able to request NDA for their own pitch
    local nda_request_data="{\"pitchId\":$CREATOR_PITCH_ID,\"message\":\"Trying to request NDA for own pitch\",\"requestType\":\"basic\"}"
    if api_request "POST" "/api/ndas/request" "$CREATOR_TOKEN" "$nda_request_data" "400" >/dev/null; then
        log_success "System correctly prevents Creator from requesting NDA for own pitch"
    elif api_request "POST" "/api/ndas/request" "$CREATOR_TOKEN" "$nda_request_data" "403" >/dev/null; then
        log_success "System correctly prevents Creator from requesting NDA for own pitch (403)"
    else
        log_error "BUSINESS RULE VIOLATION: System allows Creator to request NDA for own pitch"
    fi
}

# Test Rule 2: Investors should require NDA for accessing creator pitches  
test_investor_nda_requirement() {
    log_test_start "Rule 2: Investors require NDA to access protected creator content"
    
    if [[ -z "$INVESTOR_TOKEN" || -z "$CREATOR_PITCH_ID" ]]; then
        log_error "Investor credentials or creator pitch not available for testing"
        return
    fi
    
    # Check NDA status first
    if response=$(api_request "GET" "/api/ndas/pitch/$CREATOR_PITCH_ID/status" "$INVESTOR_TOKEN" "" "200"); then
        local has_nda=$(extract_json_field "$response" "hasNDA")
        local can_access=$(extract_json_field "$response" "canAccess")
        
        if [[ "$has_nda" == "false" && "$can_access" == "false" ]]; then
            log_success "System correctly requires NDA for investor to access creator pitch"
            
            # Investor should be able to request NDA
            local nda_request_data="{\"pitchId\":$CREATOR_PITCH_ID,\"message\":\"Requesting access for investment evaluation\",\"requestType\":\"basic\"}"
            if api_request "POST" "/api/ndas/request" "$INVESTOR_TOKEN" "$nda_request_data" "201" >/dev/null || 
               api_request "POST" "/api/ndas/request" "$INVESTOR_TOKEN" "$nda_request_data" "200" >/dev/null; then
                log_success "Investor can successfully request NDA for creator pitch"
            else
                log_error "BUSINESS RULE VIOLATION: Investor cannot request NDA for creator pitch"
            fi
        else
            log_warning "Investor already has NDA access to creator pitch - cannot test requirement"
        fi
    else
        log_error "Failed to check NDA status for investor"
    fi
}

# Test Rule 3: Production companies have specific access rules
test_production_portal_access() {
    log_test_start "Rule 3: Production companies have portal-specific access rules"
    
    if [[ -z "$PRODUCTION_TOKEN" ]]; then
        log_error "Production credentials not available for testing"
        return
    fi
    
    # Production companies should be able to access public pitches
    if api_request "GET" "/api/pitches/public" "$PRODUCTION_TOKEN" "" "200" >/dev/null; then
        log_success "Production company can access public pitches"
    else
        log_error "BUSINESS RULE VIOLATION: Production company cannot access public pitches"
    fi
    
    # Production companies should have access to production-specific endpoints
    if api_request "GET" "/api/production/dashboard" "$PRODUCTION_TOKEN" "" "200" >/dev/null; then
        log_success "Production company has access to production dashboard"
    else
        log_error "BUSINESS RULE VIOLATION: Production company cannot access production dashboard"
    fi
    
    # Test production-specific pitch access
    if [[ -n "$CREATOR_PITCH_ID" ]]; then
        if response=$(api_request "GET" "/api/ndas/pitch/$CREATOR_PITCH_ID/status" "$PRODUCTION_TOKEN" "" "200"); then
            local can_access=$(extract_json_field "$response" "canAccess")
            if [[ "$can_access" == "false" ]]; then
                # Production company should be able to request NDA
                local nda_request_data="{\"pitchId\":$CREATOR_PITCH_ID,\"message\":\"Production company requesting access\",\"requestType\":\"basic\"}"
                if api_request "POST" "/api/ndas/request" "$PRODUCTION_TOKEN" "$nda_request_data" "201" >/dev/null ||
                   api_request "POST" "/api/ndas/request" "$PRODUCTION_TOKEN" "$nda_request_data" "200" >/dev/null; then
                    log_success "Production company can request NDA access"
                else
                    log_error "BUSINESS RULE VIOLATION: Production company cannot request NDA"
                fi
            else
                log_warning "Production company already has access to test pitch"
            fi
        fi
    fi
}

# Test Rule 4: Anonymous users have limited access
test_anonymous_user_access() {
    log_test_start "Rule 4: Anonymous users have limited access to public content only"
    
    # Anonymous users should be able to access public pitches list
    if api_request "GET" "/api/pitches/public" "" "" "200" >/dev/null; then
        log_success "Anonymous users can access public pitches list"
    else
        log_error "BUSINESS RULE VIOLATION: Anonymous users cannot access public pitches"
    fi
    
    # Anonymous users should NOT be able to access protected endpoints
    if api_request "GET" "/api/creator/dashboard" "" "" "401" >/dev/null; then
        log_success "System correctly blocks anonymous access to creator dashboard"
    else
        log_error "SECURITY VIOLATION: Anonymous users can access creator dashboard"
    fi
    
    if api_request "GET" "/api/investor/dashboard" "" "" "401" >/dev/null; then
        log_success "System correctly blocks anonymous access to investor dashboard"
    else
        log_error "SECURITY VIOLATION: Anonymous users can access investor dashboard"
    fi
    
    if api_request "GET" "/api/production/dashboard" "" "" "401" >/dev/null; then
        log_success "System correctly blocks anonymous access to production dashboard"
    else
        log_error "SECURITY VIOLATION: Anonymous users can access production dashboard"
    fi
    
    # Anonymous users should NOT be able to request NDAs
    if [[ -n "$CREATOR_PITCH_ID" ]]; then
        local nda_request_data="{\"pitchId\":$CREATOR_PITCH_ID,\"message\":\"Anonymous NDA request\",\"requestType\":\"basic\"}"
        if api_request "POST" "/api/ndas/request" "" "$nda_request_data" "401" >/dev/null; then
            log_success "System correctly blocks anonymous NDA requests"
        else
            log_error "SECURITY VIOLATION: Anonymous users can request NDAs"
        fi
    fi
}

# Test Rule 5: Cross-portal access restrictions
test_cross_portal_restrictions() {
    log_test_start "Rule 5: Cross-portal access is properly restricted"
    
    # Creator trying to access investor-only endpoints
    if [[ -n "$CREATOR_TOKEN" ]]; then
        if api_request "GET" "/api/investor/portfolio" "$CREATOR_TOKEN" "" "403" >/dev/null ||
           api_request "GET" "/api/investor/portfolio" "$CREATOR_TOKEN" "" "401" >/dev/null; then
            log_success "System blocks creator access to investor portfolio"
        else
            log_error "SECURITY VIOLATION: Creator can access investor portfolio"
        fi
    fi
    
    # Investor trying to access creator-only endpoints
    if [[ -n "$INVESTOR_TOKEN" ]]; then
        if api_request "GET" "/api/creator/pitches" "$INVESTOR_TOKEN" "" "403" >/dev/null ||
           api_request "GET" "/api/creator/pitches" "$INVESTOR_TOKEN" "" "401" >/dev/null; then
            log_success "System blocks investor access to creator pitches endpoint"
        else
            log_error "SECURITY VIOLATION: Investor can access creator pitches endpoint"
        fi
    fi
    
    # Production trying to access investor-specific endpoints
    if [[ -n "$PRODUCTION_TOKEN" ]]; then
        if api_request "GET" "/api/investor/watchlist" "$PRODUCTION_TOKEN" "" "403" >/dev/null ||
           api_request "GET" "/api/investor/watchlist" "$PRODUCTION_TOKEN" "" "401" >/dev/null; then
            log_success "System blocks production access to investor watchlist"
        else
            log_error "SECURITY VIOLATION: Production can access investor watchlist"
        fi
    fi
}

# Test Rule 6: NDA workflow state management
test_nda_workflow_states() {
    log_test_start "Rule 6: NDA workflow states are properly managed"
    
    if [[ -z "$INVESTOR_TOKEN" || -z "$CREATOR_PITCH_ID" ]]; then
        log_error "Required tokens not available for NDA workflow testing"
        return
    fi
    
    # Test NDA status endpoint
    if response=$(api_request "GET" "/api/ndas/pitch/$CREATOR_PITCH_ID/status" "$INVESTOR_TOKEN" "" "200"); then
        log_success "NDA status endpoint is accessible"
        
        # Verify response structure
        if echo "$response" | grep -q '"hasNDA"' && echo "$response" | grep -q '"canAccess"'; then
            log_success "NDA status response has correct structure"
        else
            log_error "NDA status response missing required fields"
        fi
    else
        log_error "NDA status endpoint is not working"
    fi
    
    # Test pending NDAs list
    if [[ -n "$CREATOR_TOKEN" ]]; then
        if api_request "GET" "/api/nda/pending" "$CREATOR_TOKEN" "" "200" >/dev/null; then
            log_success "Creator can access pending NDAs list"
        else
            log_error "Creator cannot access pending NDAs list"
        fi
    fi
    
    # Test signed NDAs list
    if [[ -n "$INVESTOR_TOKEN" ]]; then
        if api_request "GET" "/api/ndas/signed" "$INVESTOR_TOKEN" "" "200" >/dev/null; then
            log_success "Investor can access signed NDAs list"
        else
            log_error "Investor cannot access signed NDAs list"
        fi
    fi
}

# Test Rule 7: Error handling and validation
test_error_handling() {
    log_test_start "Rule 7: Error handling and input validation work correctly"
    
    # Test invalid pitch ID in NDA request
    if [[ -n "$INVESTOR_TOKEN" ]]; then
        local invalid_nda_data='{"pitchId":99999,"message":"Invalid pitch ID test","requestType":"basic"}'
        if api_request "POST" "/api/ndas/request" "$INVESTOR_TOKEN" "$invalid_nda_data" "404" >/dev/null ||
           api_request "POST" "/api/ndas/request" "$INVESTOR_TOKEN" "$invalid_nda_data" "400" >/dev/null; then
            log_success "System correctly handles invalid pitch ID in NDA request"
        else
            log_error "System does not handle invalid pitch ID properly"
        fi
    fi
    
    # Test malformed NDA request data
    if [[ -n "$INVESTOR_TOKEN" ]]; then
        local malformed_data='{"invalid":"data"}'
        if api_request "POST" "/api/ndas/request" "$INVESTOR_TOKEN" "$malformed_data" "400" >/dev/null ||
           api_request "POST" "/api/ndas/request" "$INVESTOR_TOKEN" "$malformed_data" "422" >/dev/null; then
            log_success "System correctly rejects malformed NDA request data"
        else
            log_error "System does not validate NDA request data properly"
        fi
    fi
    
    # Test accessing non-existent NDA status
    if [[ -n "$INVESTOR_TOKEN" ]]; then
        if api_request "GET" "/api/ndas/pitch/99999/status" "$INVESTOR_TOKEN" "" "404" >/dev/null; then
            log_success "System correctly handles non-existent pitch in NDA status"
        else
            log_error "System does not handle non-existent pitch properly"
        fi
    fi
}

# Test Rule 8: Frontend workflow integration
test_frontend_workflow_integration() {
    log_test_start "Rule 8: Frontend workflow endpoints support proper business logic"
    
    # Test pitch detail endpoint that frontend uses
    if [[ -n "$CREATOR_PITCH_ID" && -n "$INVESTOR_TOKEN" ]]; then
        if api_request "GET" "/api/pitches/$CREATOR_PITCH_ID" "$INVESTOR_TOKEN" "" "200" >/dev/null; then
            log_success "Pitch detail endpoint accessible to authorized users"
        else
            log_error "Pitch detail endpoint not working for authorized users"
        fi
    fi
    
    # Test that frontend can check user permissions properly
    if [[ -n "$CREATOR_TOKEN" ]]; then
        if response=$(api_request "GET" "/api/profile" "$CREATOR_TOKEN" "" "200"); then
            if echo "$response" | grep -q '"userType"'; then
                log_success "Profile endpoint provides user type for frontend routing"
            else
                log_error "Profile endpoint missing user type information"
            fi
        else
            log_error "Profile endpoint not accessible"
        fi
    fi
    
    # Test configuration endpoints that frontend needs
    local config_endpoints=(
        "/api/config/genres"
        "/api/config/formats"
        "/api/config/budget-ranges"
    )
    
    local config_success=true
    for endpoint in "${config_endpoints[@]}"; do
        if ! api_request "GET" "$endpoint" "" "" "200" >/dev/null; then
            config_success=false
            break
        fi
    done
    
    if $config_success; then
        log_success "Configuration endpoints support frontend properly"
    else
        log_error "Configuration endpoints have issues"
    fi
}

# Generate comprehensive report
generate_final_report() {
    echo ""
    echo "=================================================================="
    echo "🎯 COMPREHENSIVE NDA BUSINESS RULES VALIDATION REPORT"
    echo "=================================================================="
    echo "Test Environment: $API_BASE"
    echo "Total Business Rules Tested: $TOTAL_TESTS"
    echo -e "${GREEN}✅ Rules Validated Successfully: $PASSED_TESTS${NC}"
    echo -e "${RED}❌ Rules Failing/Violated: $FAILED_TESTS${NC}"
    
    if [[ $FAILED_TESTS -eq 0 ]]; then
        echo -e "${GREEN}🎉 BUSINESS LOGIC STATUS: FULLY COMPLIANT${NC}"
        echo "All NDA business rules are properly implemented!"
    else
        echo -e "${RED}⚠️ BUSINESS LOGIC STATUS: VIOLATIONS DETECTED${NC}"
        echo "Some business rules need attention for proper compliance."
    fi
    
    echo ""
    echo "=================================================================="
    echo "📊 DETAILED ANALYSIS"
    echo "=================================================================="
    
    echo ""
    echo -e "${GREEN}✅ SUCCESSFULLY VALIDATED RULES:${NC}"
    if [[ ${#SUCCESSFUL_RULES[@]} -gt 0 ]]; then
        printf '   • %s\n' "${SUCCESSFUL_RULES[@]}"
    else
        echo "   (None - all rules failed)"
    fi
    
    if [[ ${#BUSINESS_RULES_VIOLATIONS[@]} -gt 0 ]]; then
        echo ""
        echo -e "${RED}❌ BUSINESS RULE VIOLATIONS:${NC}"
        printf '   • %s\n' "${BUSINESS_RULES_VIOLATIONS[@]}"
        
        echo ""
        echo "=================================================================="
        echo "🔧 RECOMMENDED ACTIONS"
        echo "=================================================================="
        echo "1. Review and fix business logic violations listed above"
        echo "2. Ensure proper portal-specific access controls"
        echo "3. Validate NDA workflow state management"
        echo "4. Test frontend integration with corrected backend logic"
        echo "5. Add proper error handling for edge cases"
        echo "6. Implement missing authorization checks"
    fi
    
    echo ""
    echo "=================================================================="
    echo "🧪 BUSINESS RULES SUMMARY"
    echo "=================================================================="
    echo "Rule 1: Creator Own Pitch Access - $([[ $(echo "${SUCCESSFUL_RULES[@]}" | grep -c "Creator can access their own pitch") -gt 0 ]] && echo "✅ PASSED" || echo "❌ FAILED")"
    echo "Rule 2: Investor NDA Requirement - $([[ $(echo "${SUCCESSFUL_RULES[@]}" | grep -c "System correctly requires NDA") -gt 0 ]] && echo "✅ PASSED" || echo "❌ FAILED")"
    echo "Rule 3: Production Portal Access - $([[ $(echo "${SUCCESSFUL_RULES[@]}" | grep -c "Production company") -gt 0 ]] && echo "✅ PASSED" || echo "❌ FAILED")"
    echo "Rule 4: Anonymous User Limits - $([[ $(echo "${SUCCESSFUL_RULES[@]}" | grep -c "Anonymous users can access public") -gt 0 ]] && echo "✅ PASSED" || echo "❌ FAILED")"
    echo "Rule 5: Cross-Portal Security - $([[ $(echo "${SUCCESSFUL_RULES[@]}" | grep -c "System blocks") -gt 0 ]] && echo "✅ PASSED" || echo "❌ FAILED")"
    echo "Rule 6: NDA Workflow States - $([[ $(echo "${SUCCESSFUL_RULES[@]}" | grep -c "NDA status") -gt 0 ]] && echo "✅ PASSED" || echo "❌ FAILED")"
    echo "Rule 7: Error Handling - $([[ $(echo "${SUCCESSFUL_RULES[@]}" | grep -c "correctly handles") -gt 0 ]] && echo "✅ PASSED" || echo "❌ FAILED")"
    echo "Rule 8: Frontend Integration - $([[ $(echo "${SUCCESSFUL_RULES[@]}" | grep -c "frontend") -gt 0 ]] && echo "✅ PASSED" || echo "❌ FAILED")"
    
    echo ""
    echo "=================================================================="
    echo "📈 SUCCESS RATE: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"
    echo "=================================================================="
}

# Main test execution
main() {
    echo "=================================================================="
    echo "🚀 Comprehensive NDA Business Rules Validation Suite"
    echo "=================================================================="
    echo "Testing server: $API_BASE"
    echo "Verbose mode: $VERBOSE"
    echo "=================================================================="
    
    # Setup phase
    if ! setup_authentication; then
        echo "Authentication setup failed - cannot proceed with business rule testing"
        exit 1
    fi
    
    setup_test_pitches
    
    # Core business rule tests
    test_creator_own_pitch_access
    test_investor_nda_requirement
    test_production_portal_access
    test_anonymous_user_access
    test_cross_portal_restrictions
    test_nda_workflow_states
    test_error_handling
    test_frontend_workflow_integration
    
    # Generate comprehensive report
    generate_final_report
    
    # Exit with appropriate code
    if [[ $FAILED_TESTS -eq 0 ]]; then
        exit 0
    else
        exit 1
    fi
}

# Handle script arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Comprehensive NDA Business Rules Validation Test Suite"
            echo ""
            echo "Options:"
            echo "  -v, --verbose    Enable verbose output with request/response details"
            echo "  -h, --help       Show this help message"
            echo ""
            echo "This test suite validates:"
            echo "• Portal-specific access controls"
            echo "• NDA workflow business logic"
            echo "• Cross-portal security restrictions"
            echo "• Error handling and validation"
            echo "• Frontend integration requirements"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run the comprehensive test suite
main "$@"