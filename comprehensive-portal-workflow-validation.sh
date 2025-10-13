#!/bin/bash

# Comprehensive Portal Workflow Validation Test Suite
# Tests specific workflows for Creator, Investor, and Production portals
# Validates proper NDA business logic and user journey flows
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

# Test user accounts
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
TEST_PITCH_ID=""
TEST_NDA_REQUEST_ID=""

# Test tracking
TOTAL_WORKFLOWS=0
PASSED_WORKFLOWS=0
FAILED_WORKFLOWS=0
WORKFLOW_RESULTS=()

# Utility functions
log_workflow_start() {
    echo -e "\n${PURPLE}🔄 Testing Workflow: $1${NC}"
    ((TOTAL_WORKFLOWS++))
}

log_workflow_success() {
    echo -e "${GREEN}✅ Workflow Passed: $1${NC}"
    ((PASSED_WORKFLOWS++))
    WORKFLOW_RESULTS+=("PASS: $1")
}

log_workflow_fail() {
    echo -e "${RED}❌ Workflow Failed: $1${NC}"
    ((FAILED_WORKFLOWS++))
    WORKFLOW_RESULTS+=("FAIL: $1")
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

# Setup authentication
setup_auth() {
    log_info "Setting up authentication for all portals..."
    
    # Creator auth
    local creator_data="{\"email\":\"$CREATOR_EMAIL\",\"password\":\"$CREATOR_PASSWORD\"}"
    if response=$(api_request "POST" "/api/auth/creator/login" "" "$creator_data" "200"); then
        CREATOR_TOKEN=$(echo "$response" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
        log_step "Creator authenticated"
    else
        echo "Failed to authenticate creator" >&2
        return 1
    fi
    
    # Investor auth
    local investor_data="{\"email\":\"$INVESTOR_EMAIL\",\"password\":\"$INVESTOR_PASSWORD\"}"
    if response=$(api_request "POST" "/api/auth/investor/login" "" "$investor_data" "200"); then
        INVESTOR_TOKEN=$(echo "$response" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
        log_step "Investor authenticated"
    else
        echo "Failed to authenticate investor" >&2
        return 1
    fi
    
    # Production auth
    local production_data="{\"email\":\"$PRODUCTION_EMAIL\",\"password\":\"$PRODUCTION_PASSWORD\"}"
    if response=$(api_request "POST" "/api/auth/production/login" "" "$production_data" "200"); then
        PRODUCTION_TOKEN=$(echo "$response" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
        log_step "Production company authenticated"
    else
        echo "Failed to authenticate production company" >&2
        return 1
    fi
}

# Creator Portal Workflow Tests
test_creator_portal_workflow() {
    log_workflow_start "Creator Portal - Complete Pitch Management Workflow"
    
    local workflow_success=true
    
    # Step 1: Creator creates a new pitch
    log_step "Step 1: Creating new pitch"
    local pitch_data='{
        "title": "Creator Workflow Test Pitch",
        "logline": "Test pitch for creator workflow validation",
        "genre": "drama",
        "format": "feature",
        "shortSynopsis": "A test pitch to validate creator workflows",
        "targetAudience": "General audience",
        "estimatedBudget": 2000000,
        "requireNda": true
    }'
    
    if response=$(api_request "POST" "/api/creator/pitches" "$CREATOR_TOKEN" "$pitch_data" "201"); then
        TEST_PITCH_ID=$(echo "$response" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
        log_step "✓ Pitch created successfully (ID: $TEST_PITCH_ID)"
    else
        workflow_success=false
        log_step "✗ Failed to create pitch"
    fi
    
    # Step 2: Creator accesses their dashboard
    log_step "Step 2: Accessing creator dashboard"
    if api_request "GET" "/api/creator/dashboard" "$CREATOR_TOKEN" "" "200" >/dev/null; then
        log_step "✓ Dashboard accessible"
    else
        workflow_success=false
        log_step "✗ Dashboard not accessible"
    fi
    
    # Step 3: Creator views their pitch list
    log_step "Step 3: Viewing creator's pitch list"
    if response=$(api_request "GET" "/api/creator/pitches" "$CREATOR_TOKEN" "" "200"); then
        if echo "$response" | grep -q "$TEST_PITCH_ID"; then
            log_step "✓ New pitch appears in creator's list"
        else
            workflow_success=false
            log_step "✗ New pitch not found in creator's list"
        fi
    else
        workflow_success=false
        log_step "✗ Failed to access pitch list"
    fi
    
    # Step 4: Creator can access their own pitch without NDA
    log_step "Step 4: Accessing own pitch without NDA requirement"
    if [[ -n "$TEST_PITCH_ID" ]]; then
        if api_request "GET" "/api/pitches/$TEST_PITCH_ID" "$CREATOR_TOKEN" "" "200" >/dev/null; then
            log_step "✓ Creator can access own pitch"
        else
            workflow_success=false
            log_step "✗ Creator cannot access own pitch"
        fi
    fi
    
    # Step 5: Creator views pending NDA requests (should be empty initially)
    log_step "Step 5: Checking pending NDA requests"
    if api_request "GET" "/api/nda/pending" "$CREATOR_TOKEN" "" "200" >/dev/null; then
        log_step "✓ Pending NDA requests accessible"
    else
        workflow_success=false
        log_step "✗ Cannot access pending NDA requests"
    fi
    
    if $workflow_success; then
        log_workflow_success "Creator Portal - Complete Pitch Management"
    else
        log_workflow_fail "Creator Portal - Pitch Management has issues"
    fi
}

# Investor Portal Workflow Tests
test_investor_portal_workflow() {
    log_workflow_start "Investor Portal - NDA Request and Access Workflow"
    
    local workflow_success=true
    
    # Step 1: Investor accesses dashboard
    log_step "Step 1: Accessing investor dashboard"
    if api_request "GET" "/api/investor/dashboard" "$INVESTOR_TOKEN" "" "200" >/dev/null; then
        log_step "✓ Investor dashboard accessible"
    else
        workflow_success=false
        log_step "✗ Investor dashboard not accessible"
    fi
    
    # Step 2: Investor browses public pitches
    log_step "Step 2: Browsing public pitches"
    if response=$(api_request "GET" "/api/pitches/public" "$INVESTOR_TOKEN" "" "200"); then
        log_step "✓ Public pitches accessible"
    else
        workflow_success=false
        log_step "✗ Cannot access public pitches"
    fi
    
    # Step 3: Investor checks NDA status for creator's pitch (should require NDA)
    if [[ -n "$TEST_PITCH_ID" ]]; then
        log_step "Step 3: Checking NDA status for creator pitch"
        if response=$(api_request "GET" "/api/ndas/pitch/$TEST_PITCH_ID/status" "$INVESTOR_TOKEN" "" "200"); then
            local has_nda=$(echo "$response" | grep -o '"hasNDA":[^,}]*' | cut -d: -f2 | tr -d ' ')
            local can_access=$(echo "$response" | grep -o '"canAccess":[^,}]*' | cut -d: -f2 | tr -d ' ')
            
            if [[ "$has_nda" == "false" && "$can_access" == "false" ]]; then
                log_step "✓ System correctly requires NDA for investor access"
            else
                workflow_success=false
                log_step "✗ NDA requirement not enforced properly"
            fi
        else
            workflow_success=false
            log_step "✗ Cannot check NDA status"
        fi
        
        # Step 4: Investor requests NDA access
        log_step "Step 4: Requesting NDA access"
        local nda_request_data="{\"pitchId\":$TEST_PITCH_ID,\"message\":\"Investment evaluation request\",\"requestType\":\"basic\"}"
        if response=$(api_request "POST" "/api/ndas/request" "$INVESTOR_TOKEN" "$nda_request_data" "201"); then
            TEST_NDA_REQUEST_ID=$(echo "$response" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
            log_step "✓ NDA request submitted successfully"
        elif api_request "POST" "/api/ndas/request" "$INVESTOR_TOKEN" "$nda_request_data" "200" >/dev/null; then
            log_step "✓ NDA request handled (may already exist)"
        elif api_request "POST" "/api/ndas/request" "$INVESTOR_TOKEN" "$nda_request_data" "409" >/dev/null; then
            log_step "✓ NDA request already exists (expected behavior)"
        else
            workflow_success=false
            log_step "✗ Failed to submit NDA request"
        fi
    fi
    
    # Step 5: Investor views their signed NDAs
    log_step "Step 5: Viewing signed NDAs"
    if api_request "GET" "/api/ndas/signed" "$INVESTOR_TOKEN" "" "200" >/dev/null; then
        log_step "✓ Signed NDAs list accessible"
    else
        workflow_success=false
        log_step "✗ Cannot access signed NDAs list"
    fi
    
    # Step 6: Investor accesses portfolio
    log_step "Step 6: Accessing investment portfolio"
    if api_request "GET" "/api/investor/portfolio" "$INVESTOR_TOKEN" "" "200" >/dev/null; then
        log_step "✓ Investment portfolio accessible"
    else
        workflow_success=false
        log_step "✗ Investment portfolio not accessible"
    fi
    
    if $workflow_success; then
        log_workflow_success "Investor Portal - NDA Request and Access"
    else
        log_workflow_fail "Investor Portal - NDA workflow has issues"
    fi
}

# Production Portal Workflow Tests
test_production_portal_workflow() {
    log_workflow_start "Production Portal - Content Discovery and Access Workflow"
    
    local workflow_success=true
    
    # Step 1: Production company accesses dashboard
    log_step "Step 1: Accessing production dashboard"
    if api_request "GET" "/api/production/dashboard" "$PRODUCTION_TOKEN" "" "200" >/dev/null; then
        log_step "✓ Production dashboard accessible"
    else
        workflow_success=false
        log_step "✗ Production dashboard not accessible"
    fi
    
    # Step 2: Production browses public pitches
    log_step "Step 2: Browsing public pitches for acquisition"
    if api_request "GET" "/api/pitches/public" "$PRODUCTION_TOKEN" "" "200" >/dev/null; then
        log_step "✓ Public pitches accessible"
    else
        workflow_success=false
        log_step "✗ Cannot browse public pitches"
    fi
    
    # Step 3: Production uses search functionality
    log_step "Step 3: Using advanced search features"
    if api_request "GET" "/api/search/advanced?genre=drama&budget_min=1000000" "$PRODUCTION_TOKEN" "" "200" >/dev/null; then
        log_step "✓ Advanced search accessible"
    else
        workflow_success=false
        log_step "✗ Advanced search not working"
    fi
    
    # Step 4: Production requests NDA for creator pitch (if available)
    if [[ -n "$TEST_PITCH_ID" ]]; then
        log_step "Step 4: Requesting NDA access for creator content"
        local nda_request_data="{\"pitchId\":$TEST_PITCH_ID,\"message\":\"Production evaluation request\",\"requestType\":\"basic\"}"
        if response=$(api_request "POST" "/api/ndas/request" "$PRODUCTION_TOKEN" "$nda_request_data" "201"); then
            log_step "✓ NDA request submitted by production company"
        elif api_request "POST" "/api/ndas/request" "$PRODUCTION_TOKEN" "$nda_request_data" "200" >/dev/null ||
             api_request "POST" "/api/ndas/request" "$PRODUCTION_TOKEN" "$nda_request_data" "409" >/dev/null; then
            log_step "✓ NDA request handled appropriately"
        else
            workflow_success=false
            log_step "✗ Production company cannot request NDA"
        fi
    fi
    
    # Step 5: Production accesses messaging for approved NDAs
    log_step "Step 5: Accessing messaging system"
    if api_request "GET" "/api/messages" "$PRODUCTION_TOKEN" "" "200" >/dev/null; then
        log_step "✓ Messaging system accessible"
    else
        workflow_success=false
        log_step "✗ Messaging system not accessible"
    fi
    
    if $workflow_success; then
        log_workflow_success "Production Portal - Content Discovery and Access"
    else
        log_workflow_fail "Production Portal - workflow has issues"
    fi
}

# NDA Approval Workflow Test
test_nda_approval_workflow() {
    log_workflow_start "NDA Approval - Creator Approves Investor Request"
    
    local workflow_success=true
    
    if [[ -z "$TEST_NDA_REQUEST_ID" ]]; then
        log_step "No NDA request ID available for approval testing"
        log_workflow_fail "NDA Approval - No request to test"
        return
    fi
    
    # Step 1: Creator views pending NDA requests
    log_step "Step 1: Creator checking pending NDA requests"
    if response=$(api_request "GET" "/api/nda/pending" "$CREATOR_TOKEN" "" "200"); then
        if echo "$response" | grep -q "pending"; then
            log_step "✓ Pending requests visible to creator"
        else
            log_step "! No pending requests found (may be already processed)"
        fi
    else
        workflow_success=false
        log_step "✗ Creator cannot view pending requests"
    fi
    
    # Step 2: Creator approves NDA request
    log_step "Step 2: Approving NDA request"
    if api_request "POST" "/api/ndas/$TEST_NDA_REQUEST_ID/approve" "$CREATOR_TOKEN" "" "200" >/dev/null ||
       api_request "POST" "/api/ndas/$TEST_NDA_REQUEST_ID/approve" "$CREATOR_TOKEN" "" "201" >/dev/null; then
        log_step "✓ NDA request approved successfully"
        
        # Step 3: Verify investor now has access
        log_step "Step 3: Verifying investor gained access"
        if [[ -n "$TEST_PITCH_ID" ]]; then
            if response=$(api_request "GET" "/api/ndas/pitch/$TEST_PITCH_ID/status" "$INVESTOR_TOKEN" "" "200"); then
                local can_access=$(echo "$response" | grep -o '"canAccess":[^,}]*' | cut -d: -f2 | tr -d ' ')
                if [[ "$can_access" == "true" ]]; then
                    log_step "✓ Investor now has access after approval"
                else
                    workflow_success=false
                    log_step "✗ Investor still cannot access after approval"
                fi
            fi
        fi
    else
        workflow_success=false
        log_step "✗ Failed to approve NDA request"
    fi
    
    if $workflow_success; then
        log_workflow_success "NDA Approval - Creator Approves Request"
    else
        log_workflow_fail "NDA Approval - workflow has issues"
    fi
}

# Cross-Portal Security Test
test_cross_portal_security() {
    log_workflow_start "Cross-Portal Security - Unauthorized Access Prevention"
    
    local workflow_success=true
    
    # Test 1: Creator cannot access investor-specific endpoints
    log_step "Test 1: Creator accessing investor endpoints (should fail)"
    if api_request "GET" "/api/investor/portfolio" "$CREATOR_TOKEN" "" "403" >/dev/null ||
       api_request "GET" "/api/investor/portfolio" "$CREATOR_TOKEN" "" "401" >/dev/null; then
        log_step "✓ Creator correctly blocked from investor portfolio"
    else
        workflow_success=false
        log_step "✗ SECURITY ISSUE: Creator can access investor portfolio"
    fi
    
    # Test 2: Investor cannot access creator-specific endpoints
    log_step "Test 2: Investor accessing creator endpoints (should fail)"
    if api_request "POST" "/api/creator/pitches" "$INVESTOR_TOKEN" '{"title":"test"}' "403" >/dev/null ||
       api_request "POST" "/api/creator/pitches" "$INVESTOR_TOKEN" '{"title":"test"}' "401" >/dev/null; then
        log_step "✓ Investor correctly blocked from creating pitches"
    else
        workflow_success=false
        log_step "✗ SECURITY ISSUE: Investor can create pitches"
    fi
    
    # Test 3: Production cannot access investor watchlist
    log_step "Test 3: Production accessing investor watchlist (should fail)"
    if api_request "GET" "/api/investor/watchlist" "$PRODUCTION_TOKEN" "" "403" >/dev/null ||
       api_request "GET" "/api/investor/watchlist" "$PRODUCTION_TOKEN" "" "401" >/dev/null; then
        log_step "✓ Production correctly blocked from investor watchlist"
    else
        workflow_success=false
        log_step "✗ SECURITY ISSUE: Production can access investor watchlist"
    fi
    
    # Test 4: Anonymous access is properly blocked
    log_step "Test 4: Anonymous access to protected endpoints (should fail)"
    if api_request "GET" "/api/creator/dashboard" "" "" "401" >/dev/null; then
        log_step "✓ Anonymous users correctly blocked from dashboards"
    else
        workflow_success=false
        log_step "✗ SECURITY ISSUE: Anonymous users can access dashboards"
    fi
    
    if $workflow_success; then
        log_workflow_success "Cross-Portal Security - Unauthorized Access Prevention"
    else
        log_workflow_fail "Cross-Portal Security - has vulnerabilities"
    fi
}

# Frontend Integration Test
test_frontend_integration() {
    log_workflow_start "Frontend Integration - API Endpoints for UI Components"
    
    local workflow_success=true
    
    # Test configuration endpoints that frontend needs
    log_step "Testing configuration endpoints"
    local config_endpoints=(
        "/api/config/genres"
        "/api/config/formats"
        "/api/config/budget-ranges"
        "/api/config/stages"
    )
    
    for endpoint in "${config_endpoints[@]}"; do
        if api_request "GET" "$endpoint" "" "" "200" >/dev/null; then
            log_step "✓ $endpoint working"
        else
            workflow_success=false
            log_step "✗ $endpoint failed"
        fi
    done
    
    # Test user profile endpoints
    log_step "Testing profile endpoints"
    if response=$(api_request "GET" "/api/profile" "$CREATOR_TOKEN" "" "200"); then
        if echo "$response" | grep -q '"userType"'; then
            log_step "✓ Profile endpoint provides user type"
        else
            workflow_success=false
            log_step "✗ Profile missing user type"
        fi
    else
        workflow_success=false
        log_step "✗ Profile endpoint failed"
    fi
    
    # Test search functionality for frontend
    log_step "Testing search endpoints"
    if api_request "GET" "/api/pitches/search?q=test" "" "" "200" >/dev/null; then
        log_step "✓ Search endpoint working"
    else
        workflow_success=false
        log_step "✗ Search endpoint failed"
    fi
    
    if $workflow_success; then
        log_workflow_success "Frontend Integration - API Endpoints"
    else
        log_workflow_fail "Frontend Integration - has issues"
    fi
}

# Generate final workflow report
generate_workflow_report() {
    echo ""
    echo "=================================================================="
    echo "🎯 COMPREHENSIVE PORTAL WORKFLOW VALIDATION REPORT"
    echo "=================================================================="
    echo "Test Environment: $API_BASE"
    echo "Total Workflows Tested: $TOTAL_WORKFLOWS"
    echo -e "${GREEN}✅ Workflows Passing: $PASSED_WORKFLOWS${NC}"
    echo -e "${RED}❌ Workflows Failing: $FAILED_WORKFLOWS${NC}"
    
    if [[ $FAILED_WORKFLOWS -eq 0 ]]; then
        echo -e "${GREEN}🎉 WORKFLOW STATUS: ALL WORKFLOWS FUNCTIONAL${NC}"
    else
        echo -e "${RED}⚠️ WORKFLOW STATUS: SOME WORKFLOWS NEED ATTENTION${NC}"
    fi
    
    echo ""
    echo "=================================================================="
    echo "📊 DETAILED WORKFLOW RESULTS"
    echo "=================================================================="
    
    for result in "${WORKFLOW_RESULTS[@]}"; do
        if [[ $result == PASS:* ]]; then
            echo -e "${GREEN}✅ ${result#PASS: }${NC}"
        else
            echo -e "${RED}❌ ${result#FAIL: }${NC}"
        fi
    done
    
    echo ""
    echo "=================================================================="
    echo "📈 WORKFLOW SUCCESS RATE: $(( PASSED_WORKFLOWS * 100 / TOTAL_WORKFLOWS ))%"
    echo "=================================================================="
}

# Main execution
main() {
    echo "=================================================================="
    echo "🚀 Comprehensive Portal Workflow Validation Suite"
    echo "=================================================================="
    echo "Testing server: $API_BASE"
    echo "=================================================================="
    
    if ! setup_auth; then
        echo "Authentication failed - cannot run workflow tests"
        exit 1
    fi
    
    # Run all workflow tests
    test_creator_portal_workflow
    test_investor_portal_workflow
    test_production_portal_workflow
    test_nda_approval_workflow
    test_cross_portal_security
    test_frontend_integration
    
    # Generate report
    generate_workflow_report
    
    # Exit appropriately
    if [[ $FAILED_WORKFLOWS -eq 0 ]]; then
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
            echo "Comprehensive Portal Workflow Validation Test Suite"
            echo ""
            echo "Options:"
            echo "  -v, --verbose    Enable verbose output"
            echo "  -h, --help       Show help"
            echo ""
            echo "Tests complete user workflows across all portal types"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run the test suite
main "$@"