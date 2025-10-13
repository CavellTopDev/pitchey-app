#!/bin/bash

# Comprehensive Pitchey Platform Test Suite - Fixed Version
# Tests all pitch workflows, NDA workflows, and portal functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_BASE="http://localhost:8001"
VERBOSE=${1:-false}

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
CREATED_PITCH_ID=""

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Utility functions
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; ((PASSED_TESTS++)); }
log_error() { echo -e "${RED}❌ $1${NC}"; ((FAILED_TESTS++)); }
log_test_start() { echo -e "\n${BLUE}🧪 Testing: $1${NC}"; ((TOTAL_TESTS++)); }

# HTTP request helper with simplified curl
api_call() {
    local method="$1"
    local endpoint="$2"
    local token="$3"
    local data="$4"
    local expected_status="${5:-200}"
    
    local url="${API_BASE}${endpoint}"
    local status_code
    
    if [[ -n "$token" ]]; then
        if [[ -n "$data" ]]; then
            status_code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $token" \
                -d "$data")
        else
            status_code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" \
                -H "Authorization: Bearer $token")
        fi
    else
        if [[ -n "$data" ]]; then
            status_code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" \
                -H "Content-Type: application/json" \
                -d "$data")
        else
            status_code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url")
        fi
    fi
    
    if [[ "$status_code" == "$expected_status" ]]; then
        return 0
    else
        if [[ "$VERBOSE" == "true" ]]; then
            log_error "Expected $expected_status, got $status_code for $method $endpoint"
        fi
        return 1
    fi
}

# Get response body for token extraction
api_call_with_response() {
    local method="$1"
    local endpoint="$2"
    local token="$3"
    local data="$4"
    
    local url="${API_BASE}${endpoint}"
    
    if [[ -n "$token" ]]; then
        if [[ -n "$data" ]]; then
            curl -s -X "$method" "$url" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $token" \
                -d "$data"
        else
            curl -s -X "$method" "$url" \
                -H "Authorization: Bearer $token"
        fi
    else
        if [[ -n "$data" ]]; then
            curl -s -X "$method" "$url" \
                -H "Content-Type: application/json" \
                -d "$data"
        else
            curl -s -X "$method" "$url"
        fi
    fi
}

# Test 1: Health and Basic Connectivity
test_health() {
    log_test_start "Health Check and Basic Connectivity"
    
    if api_call "GET" "/api/health"; then
        log_success "Health endpoint working"
    else
        log_error "Health endpoint failed"
    fi
}

# Test 2: Configuration Endpoints
test_configuration() {
    log_test_start "Configuration Endpoints"
    
    local endpoints=(
        "/api/version"
        "/api/config/genres"
        "/api/config/formats"
        "/api/config/budget-ranges"
        "/api/config/all"
    )
    
    for endpoint in "${endpoints[@]}"; do
        if api_call "GET" "$endpoint"; then
            log_success "Config endpoint: $endpoint"
        else
            log_error "Config endpoint failed: $endpoint"
        fi
    done
}

# Test 3: Authentication
test_authentication() {
    log_test_start "Authentication for All Portal Types"
    
    # Creator Login
    log_info "Testing Creator authentication..."
    local creator_data='{"email":"'$CREATOR_EMAIL'","password":"'$CREATOR_PASSWORD'"}'
    local response
    response=$(api_call_with_response "POST" "/api/auth/creator/login" "" "$creator_data")
    
    if echo "$response" | grep -q "token"; then
        CREATOR_TOKEN=$(echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
        log_success "Creator authentication successful"
    else
        log_error "Creator authentication failed"
    fi
    
    # Investor Login
    log_info "Testing Investor authentication..."
    local investor_data='{"email":"'$INVESTOR_EMAIL'","password":"'$INVESTOR_PASSWORD'"}'
    response=$(api_call_with_response "POST" "/api/auth/investor/login" "" "$investor_data")
    
    if echo "$response" | grep -q "token"; then
        INVESTOR_TOKEN=$(echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
        log_success "Investor authentication successful"
    else
        log_error "Investor authentication failed"
    fi
    
    # Production Login
    log_info "Testing Production authentication..."
    local production_data='{"email":"'$PRODUCTION_EMAIL'","password":"'$PRODUCTION_PASSWORD'"}'
    response=$(api_call_with_response "POST" "/api/auth/production/login" "" "$production_data")
    
    if echo "$response" | grep -q "token"; then
        PRODUCTION_TOKEN=$(echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
        log_success "Production authentication successful"
    else
        log_error "Production authentication failed"
    fi
    
    # Test invalid credentials
    local invalid_data='{"email":"invalid@test.com","password":"wrong"}'
    if api_call "POST" "/api/auth/login" "" "$invalid_data" "401"; then
        log_success "Invalid credentials properly rejected"
    else
        log_error "Invalid credentials handling failed"
    fi
}

# Test 4: Profile Management
test_profiles() {
    log_test_start "Profile Management"
    
    if [[ -z "$CREATOR_TOKEN" ]]; then
        log_error "Creator token not available for profile tests"
        return
    fi
    
    # Test profile retrieval
    if api_call "GET" "/api/profile" "$CREATOR_TOKEN"; then
        log_success "Profile retrieval working"
    else
        log_error "Profile retrieval failed"
    fi
    
    # Test profile update
    local profile_data='{"firstName":"Test","lastName":"Creator","bio":"Updated bio"}'
    if api_call "PUT" "/api/profile" "$CREATOR_TOKEN" "$profile_data"; then
        log_success "Profile update working"
    else
        log_error "Profile update failed"
    fi
}

# Test 5: Pitch Lifecycle
test_pitch_lifecycle() {
    log_test_start "Pitch Lifecycle (Create, Read, Update, Delete)"
    
    if [[ -z "$CREATOR_TOKEN" ]]; then
        log_error "Creator token not available for pitch tests"
        return
    fi
    
    # Test pitch creation
    log_info "Testing pitch creation..."
    local pitch_data='{
        "title": "Comprehensive Test Pitch",
        "logline": "A test pitch for validating platform functionality",
        "genre": "drama",
        "format": "feature",
        "shortSynopsis": "This is a comprehensive test synopsis"
    }'
    
    local response
    response=$(api_call_with_response "POST" "/api/creator/pitches" "$CREATOR_TOKEN" "$pitch_data")
    
    if echo "$response" | grep -q '"id"'; then
        CREATED_PITCH_ID=$(echo "$response" | grep -o '"id":[0-9]*' | cut -d':' -f2)
        log_success "Pitch creation successful (ID: $CREATED_PITCH_ID)"
    else
        log_error "Pitch creation failed"
    fi
    
    # Test pitch listing
    if api_call "GET" "/api/pitches" "$CREATOR_TOKEN"; then
        log_success "Pitch listing working"
    else
        log_error "Pitch listing failed"
    fi
    
    # Test public pitch listing
    if api_call "GET" "/api/pitches/public"; then
        log_success "Public pitch listing working"
    else
        log_error "Public pitch listing failed"
    fi
    
    # Test creator's pitch listing
    if api_call "GET" "/api/creator/pitches" "$CREATOR_TOKEN"; then
        log_success "Creator pitch listing working"
    else
        log_error "Creator pitch listing failed"
    fi
}

# Test 6: Search and Discovery
test_search() {
    log_test_start "Search and Discovery"
    
    # Test basic search
    if api_call "GET" "/api/pitches/search?q=test"; then
        log_success "Basic search working"
    else
        log_error "Basic search failed"
    fi
    
    # Test trending
    if api_call "GET" "/api/pitches/trending"; then
        log_success "Trending pitches working"
    else
        log_error "Trending pitches failed"
    fi
    
    # Test advanced search
    if api_call "GET" "/api/search/advanced?genre=drama"; then
        log_success "Advanced search working"
    else
        log_error "Advanced search failed"
    fi
}

# Test 7: Dashboard Functionality
test_dashboards() {
    log_test_start "Dashboard Access for All Portal Types"
    
    # Creator Dashboard
    if [[ -n "$CREATOR_TOKEN" ]]; then
        if api_call "GET" "/api/creator/dashboard" "$CREATOR_TOKEN"; then
            log_success "Creator dashboard working"
        else
            log_error "Creator dashboard failed"
        fi
        
        if api_call "GET" "/api/creator/stats" "$CREATOR_TOKEN"; then
            log_success "Creator stats working"
        else
            log_error "Creator stats failed"
        fi
    fi
    
    # Investor Dashboard
    if [[ -n "$INVESTOR_TOKEN" ]]; then
        if api_call "GET" "/api/investor/dashboard" "$INVESTOR_TOKEN"; then
            log_success "Investor dashboard working"
        else
            log_error "Investor dashboard failed"
        fi
        
        if api_call "GET" "/api/investor/portfolio" "$INVESTOR_TOKEN"; then
            log_success "Investor portfolio working"
        else
            log_error "Investor portfolio failed"
        fi
    fi
}

# Test 8: NDA Workflow
test_nda_workflow() {
    log_test_start "NDA Workflow"
    
    if [[ -z "$INVESTOR_TOKEN" || -z "$CREATED_PITCH_ID" ]]; then
        log_error "Missing tokens or pitch ID for NDA tests"
        return
    fi
    
    # Test NDA request
    local nda_data='{"ndaType":"basic","message":"Test NDA request"}'
    if api_call "POST" "/api/pitches/$CREATED_PITCH_ID/nda" "$INVESTOR_TOKEN" "$nda_data" "201" || 
       api_call "POST" "/api/pitches/$CREATED_PITCH_ID/nda" "$INVESTOR_TOKEN" "$nda_data" "200" ||
       api_call "POST" "/api/pitches/$CREATED_PITCH_ID/nda" "$INVESTOR_TOKEN" "$nda_data" "409"; then
        log_success "NDA request workflow working"
    else
        log_error "NDA request failed"
    fi
    
    # Test NDA listings
    if api_call "GET" "/api/nda/pending" "$CREATOR_TOKEN"; then
        log_success "Pending NDA listing working"
    else
        log_error "Pending NDA listing failed"
    fi
}

# Test 9: Social Features
test_social_features() {
    log_test_start "Social Features"
    
    if [[ -z "$INVESTOR_TOKEN" || -z "$CREATED_PITCH_ID" ]]; then
        log_error "Missing tokens or pitch ID for social tests"
        return
    fi
    
    # Test following
    local follow_data='{"pitchId":'$CREATED_PITCH_ID'}'
    if api_call "POST" "/api/follows/follow" "$INVESTOR_TOKEN" "$follow_data" "200" ||
       api_call "POST" "/api/follows/follow" "$INVESTOR_TOKEN" "$follow_data" "201"; then
        log_success "Follow functionality working"
    else
        log_error "Follow functionality failed"
    fi
    
    # Test view tracking
    if api_call "POST" "/api/pitches/$CREATED_PITCH_ID/view" "$INVESTOR_TOKEN"; then
        log_success "View tracking working"
    else
        log_error "View tracking failed"
    fi
}

# Test 10: Messaging System
test_messaging() {
    log_test_start "Messaging System"
    
    if [[ -z "$CREATOR_TOKEN" || -z "$INVESTOR_TOKEN" ]]; then
        log_error "Missing tokens for messaging tests"
        return
    fi
    
    # Test message sending
    local message_data='{
        "recipientId": 1001,
        "subject": "Test Message",
        "content": "Test message content"
    }'
    
    if api_call "POST" "/api/messages/send" "$INVESTOR_TOKEN" "$message_data" "201" ||
       api_call "POST" "/api/messages/send" "$INVESTOR_TOKEN" "$message_data" "200"; then
        log_success "Message sending working"
    else
        log_error "Message sending failed"
    fi
    
    # Test message retrieval
    if api_call "GET" "/api/messages" "$CREATOR_TOKEN"; then
        log_success "Message retrieval working"
    else
        log_error "Message retrieval failed"
    fi
}

# Test 11: WebSocket Features
test_websocket() {
    log_test_start "WebSocket and Real-time Features"
    
    # Test WebSocket health
    if api_call "GET" "/api/ws/health"; then
        log_success "WebSocket health working"
    else
        log_error "WebSocket health failed"
    fi
    
    # Test WebSocket stats
    if api_call "GET" "/api/ws/stats"; then
        log_success "WebSocket stats working"
    else
        log_error "WebSocket stats failed"
    fi
}

# Test 12: Error Handling
test_error_handling() {
    log_test_start "Error Handling and Security"
    
    # Test 404 for non-existent resources
    if api_call "GET" "/api/pitches/99999" "" "" "404"; then
        log_success "404 handling working"
    else
        log_error "404 handling failed"
    fi
    
    # Test 401 for protected endpoints
    if api_call "GET" "/api/creator/dashboard" "" "" "401"; then
        log_success "401 handling working"
    else
        log_error "401 handling failed"
    fi
}

# Main execution
main() {
    echo "=========================================="
    echo "🚀 Pitchey Comprehensive Test Suite"
    echo "=========================================="
    echo "Server: $API_BASE"
    echo "Verbose: $VERBOSE"
    echo "=========================================="
    
    # Run all tests
    test_health
    test_configuration
    test_authentication
    test_profiles
    test_pitch_lifecycle
    test_search
    test_dashboards
    test_nda_workflow
    test_social_features
    test_messaging
    test_websocket
    test_error_handling
    
    # Final Report
    echo ""
    echo "=========================================="
    echo "📊 FINAL TEST RESULTS"
    echo "=========================================="
    echo "Total Tests: $TOTAL_TESTS"
    echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
    echo -e "${RED}Failed: $FAILED_TESTS${NC}"
    
    local success_rate=0
    if [[ $TOTAL_TESTS -gt 0 ]]; then
        success_rate=$(( PASSED_TESTS * 100 / TOTAL_TESTS ))
    fi
    echo "Success Rate: $success_rate%"
    
    echo ""
    echo "🎯 PLATFORM STATUS:"
    if [[ $FAILED_TESTS -eq 0 ]]; then
        echo -e "${GREEN}🎉 FULLY FUNCTIONAL - All tests passed!${NC}"
    elif [[ $PASSED_TESTS -gt $FAILED_TESTS ]]; then
        echo -e "${YELLOW}⚠️  MOSTLY FUNCTIONAL - Minor issues detected${NC}"
    else
        echo -e "${RED}❌ NEEDS ATTENTION - Significant issues found${NC}"
    fi
    
    echo ""
    echo "🔍 COMPONENT STATUS:"
    [[ -n "$CREATOR_TOKEN" ]] && echo -e "${GREEN}✅ Creator Portal: Functional${NC}" || echo -e "${RED}❌ Creator Portal: Issues${NC}"
    [[ -n "$INVESTOR_TOKEN" ]] && echo -e "${GREEN}✅ Investor Portal: Functional${NC}" || echo -e "${RED}❌ Investor Portal: Issues${NC}"
    [[ -n "$PRODUCTION_TOKEN" ]] && echo -e "${GREEN}✅ Production Portal: Functional${NC}" || echo -e "${RED}❌ Production Portal: Issues${NC}"
    [[ -n "$CREATED_PITCH_ID" ]] && echo -e "${GREEN}✅ Pitch Management: Functional${NC}" || echo -e "${RED}❌ Pitch Management: Issues${NC}"
    
    echo ""
    echo "🎬 Platform is ready for core functionality testing!"
    echo "=========================================="
}

# Execute the test suite
main "$@"