#!/bin/bash

# Comprehensive Pitchey Platform Test Suite
# Tests all pitch workflows, NDA workflows, and portal functionality
# Server: localhost:8001

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
API_BASE="http://localhost:8001"
VERBOSE=${VERBOSE:-false}

# Test accounts
CREATOR_EMAIL="alex.creator@demo.com"
CREATOR_PASSWORD="Demo123"
INVESTOR_EMAIL="sarah.investor@demo.com"
INVESTOR_PASSWORD="Demo123"
PRODUCTION_EMAIL="stellar.production@demo.com"
PRODUCTION_PASSWORD="Demo123"

# Global variables for tokens and IDs
CREATOR_TOKEN=""
INVESTOR_TOKEN=""
PRODUCTION_TOKEN=""
CREATED_PITCH_ID=""
CREATED_MESSAGE_ID=""

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
ENDPOINTS_TESTED=()
FAILED_ENDPOINTS=()

# Utility functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED_TESTS++))
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED_TESTS++))
}

log_test_start() {
    echo -e "\n${BLUE}🧪 Testing: $1${NC}"
    ((TOTAL_TESTS++))
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
    
    if [[ "$VERBOSE" == "true" ]]; then
        log_info "Request: $curl_cmd"
    fi
    
    local response
    response=$(eval "$curl_cmd")
    
    local body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]+$//')
    local status=$(echo "$response" | grep -o 'HTTPSTATUS:[0-9]*$' | cut -d: -f2)
    
    ENDPOINTS_TESTED+=("$method $endpoint")
    
    if [[ "$status" == "$expected_status" ]]; then
        if [[ "$VERBOSE" == "true" ]]; then
            log_info "Response ($status): $body"
        fi
        echo "$body"
        return 0
    else
        log_error "Expected status $expected_status, got $status for $method $endpoint"
        if [[ "$VERBOSE" == "true" ]]; then
            log_error "Response body: $body"
        fi
        FAILED_ENDPOINTS+=("$method $endpoint (expected $expected_status, got $status)")
        return 1
    fi
}

# Extract JSON field from response
extract_json_field() {
    local json="$1"
    local field="$2"
    echo "$json" | grep -o "\"$field\":[^,}]*" | cut -d: -f2 | tr -d '"' | tr -d ' '
}

# Test health and basic connectivity
test_health() {
    log_test_start "Health Check and Basic Connectivity"
    
    if response=$(api_request "GET" "/api/health" "" "" "200"); then
        log_success "Health check endpoint working"
        if echo "$response" | grep -q '"status":"healthy"'; then
            log_success "Server reports healthy status"
        else
            log_warning "Server responded but status not confirmed as healthy"
        fi
    else
        log_error "Health check failed"
        return 1
    fi
}

# Test configuration endpoints
test_configuration() {
    log_test_start "Configuration Endpoints"
    
    local config_endpoints=(
        "/api/version"
        "/api/config/genres"
        "/api/config/formats"
        "/api/config/budget-ranges"
        "/api/config/stages"
        "/api/config/all"
    )
    
    for endpoint in "${config_endpoints[@]}"; do
        if api_request "GET" "$endpoint" "" "" "200" >/dev/null; then
            log_success "Configuration endpoint: $endpoint"
        else
            log_error "Configuration endpoint failed: $endpoint"
        fi
    done
}

# Test content endpoints
test_content() {
    log_test_start "Content Endpoints"
    
    local content_endpoints=(
        "/api/content/how-it-works"
        "/api/content/about"
        "/api/content/team"
        "/api/content/stats"
    )
    
    for endpoint in "${content_endpoints[@]}"; do
        if api_request "GET" "$endpoint" "" "" "200" >/dev/null; then
            log_success "Content endpoint: $endpoint"
        else
            log_error "Content endpoint failed: $endpoint"
        fi
    done
}

# Test authentication for all portal types
test_authentication() {
    log_test_start "Authentication Workflows"
    
    # Test Creator Login
    log_info "Testing Creator authentication..."
    local creator_data="{\"email\":\"$CREATOR_EMAIL\",\"password\":\"$CREATOR_PASSWORD\"}"
    if response=$(api_request "POST" "/api/auth/creator/login" "" "$creator_data" "200"); then
        CREATOR_TOKEN=$(extract_json_field "$response" "token")
        if [[ -n "$CREATOR_TOKEN" ]]; then
            log_success "Creator authentication successful"
        else
            log_error "Creator token not found in response"
        fi
    else
        log_error "Creator authentication failed"
    fi
    
    # Test Investor Login
    log_info "Testing Investor authentication..."
    local investor_data="{\"email\":\"$INVESTOR_EMAIL\",\"password\":\"$INVESTOR_PASSWORD\"}"
    if response=$(api_request "POST" "/api/auth/investor/login" "" "$investor_data" "200"); then
        INVESTOR_TOKEN=$(extract_json_field "$response" "token")
        if [[ -n "$INVESTOR_TOKEN" ]]; then
            log_success "Investor authentication successful"
        else
            log_error "Investor token not found in response"
        fi
    else
        log_error "Investor authentication failed"
    fi
    
    # Test Production Login
    log_info "Testing Production authentication..."
    local production_data="{\"email\":\"$PRODUCTION_EMAIL\",\"password\":\"$PRODUCTION_PASSWORD\"}"
    if response=$(api_request "POST" "/api/auth/production/login" "" "$production_data" "200"); then
        PRODUCTION_TOKEN=$(extract_json_field "$response" "token")
        if [[ -n "$PRODUCTION_TOKEN" ]]; then
            log_success "Production authentication successful"
        else
            log_error "Production token not found in response"
        fi
    else
        log_error "Production authentication failed"
    fi
    
    # Test generic login endpoint
    if api_request "POST" "/api/auth/login" "" "$creator_data" "200" >/dev/null; then
        log_success "Generic login endpoint working"
    else
        log_error "Generic login endpoint failed"
    fi
    
    # Test invalid credentials
    local invalid_data="{\"email\":\"invalid@test.com\",\"password\":\"wrong\"}"
    if api_request "POST" "/api/auth/login" "" "$invalid_data" "401" >/dev/null; then
        log_success "Invalid credentials properly rejected"
    else
        log_error "Invalid credentials not properly handled"
    fi
}

# Test profile management
test_profiles() {
    log_test_start "Profile Management"
    
    if [[ -z "$CREATOR_TOKEN" ]]; then
        log_error "Creator token not available for profile tests"
        return 1
    fi
    
    # Test profile retrieval
    if api_request "GET" "/api/profile" "$CREATOR_TOKEN" "" "200" >/dev/null; then
        log_success "Profile retrieval working"
    else
        log_error "Profile retrieval failed"
    fi
    
    # Test profile update
    local profile_data='{"firstName":"Test","lastName":"Creator","bio":"Updated bio"}'
    if api_request "PUT" "/api/profile" "$CREATOR_TOKEN" "$profile_data" "200" >/dev/null; then
        log_success "Profile update working"
    else
        log_error "Profile update failed"
    fi
    
    # Test user preferences
    if api_request "GET" "/api/user/preferences" "$CREATOR_TOKEN" "" "200" >/dev/null; then
        log_success "User preferences retrieval working"
    else
        log_error "User preferences retrieval failed"
    fi
}

# Test pitch lifecycle
test_pitch_lifecycle() {
    log_test_start "Pitch Lifecycle (Create, Read, Update, Delete)"
    
    if [[ -z "$CREATOR_TOKEN" ]]; then
        log_error "Creator token not available for pitch tests"
        return 1
    fi
    
    # Test pitch creation
    log_info "Testing pitch creation..."
    local pitch_data='{
        "title": "Test Pitch from Comprehensive Suite",
        "logline": "A test pitch for validating the platform functionality",
        "genre": "drama",
        "format": "feature",
        "shortSynopsis": "This is a comprehensive test synopsis for our test pitch",
        "targetAudience": "General audience",
        "estimatedBudget": 1000000
    }'
    
    if response=$(api_request "POST" "/api/creator/pitches" "$CREATOR_TOKEN" "$pitch_data" "201"); then
        CREATED_PITCH_ID=$(extract_json_field "$response" "id")
        if [[ -n "$CREATED_PITCH_ID" ]]; then
            log_success "Pitch creation successful (ID: $CREATED_PITCH_ID)"
        else
            log_error "Pitch ID not found in creation response"
        fi
    else
        log_error "Pitch creation failed"
    fi
    
    # Test pitch retrieval
    if [[ -n "$CREATED_PITCH_ID" ]]; then
        if api_request "GET" "/api/pitches/$CREATED_PITCH_ID" "$CREATOR_TOKEN" "" "200" >/dev/null; then
            log_success "Pitch retrieval by ID working"
        else
            log_error "Pitch retrieval by ID failed"
        fi
    fi
    
    # Test pitch listing
    if api_request "GET" "/api/pitches" "$CREATOR_TOKEN" "" "200" >/dev/null; then
        log_success "Pitch listing working"
    else
        log_error "Pitch listing failed"
    fi
    
    # Test creator's pitch listing
    if api_request "GET" "/api/creator/pitches" "$CREATOR_TOKEN" "" "200" >/dev/null; then
        log_success "Creator pitch listing working"
    else
        log_error "Creator pitch listing failed"
    fi
    
    # Test public pitch listing
    if api_request "GET" "/api/pitches/public" "" "" "200" >/dev/null; then
        log_success "Public pitch listing working"
    else
        log_error "Public pitch listing failed"
    fi
}

# Test search functionality
test_search() {
    log_test_start "Search and Discovery"
    
    # Test basic search
    if api_request "GET" "/api/pitches/search?q=test" "" "" "200" >/dev/null; then
        log_success "Basic search working"
    else
        log_error "Basic search failed"
    fi
    
    # Test advanced search
    if api_request "GET" "/api/search/advanced?genre=drama&budget_min=100000" "" "" "200" >/dev/null; then
        log_success "Advanced search working"
    else
        log_error "Advanced search failed"
    fi
    
    # Test search suggestions
    if api_request "GET" "/api/search/suggestions?q=test" "" "" "200" >/dev/null; then
        log_success "Search suggestions working"
    else
        log_error "Search suggestions failed"
    fi
    
    # Test trending pitches
    if api_request "GET" "/api/pitches/trending" "" "" "200" >/dev/null; then
        log_success "Trending pitches working"
    else
        log_error "Trending pitches failed"
    fi
    
    # Test new pitches
    if api_request "GET" "/api/pitches/new" "" "" "200" >/dev/null; then
        log_success "New pitches listing working"
    else
        log_error "New pitches listing failed"
    fi
}

# Test NDA workflow
test_nda_workflow() {
    log_test_start "NDA Workflow"
    
    if [[ -z "$INVESTOR_TOKEN" || -z "$CREATED_PITCH_ID" ]]; then
        log_warning "Investor token or pitch ID not available for NDA tests"
        return 0
    fi
    
    # Test NDA request
    log_info "Testing NDA request workflow..."
    local nda_data='{"ndaType":"basic","message":"Requesting NDA access for investment evaluation"}'
    if api_request "POST" "/api/pitches/$CREATED_PITCH_ID/nda" "$INVESTOR_TOKEN" "$nda_data" "201" >/dev/null; then
        log_success "NDA request working"
    else
        # Try different status codes that might be valid
        if api_request "POST" "/api/pitches/$CREATED_PITCH_ID/nda" "$INVESTOR_TOKEN" "$nda_data" "200" >/dev/null || 
           api_request "POST" "/api/pitches/$CREATED_PITCH_ID/nda" "$INVESTOR_TOKEN" "$nda_data" "409" >/dev/null; then
            log_success "NDA request working (already exists or different status)"
        else
            log_error "NDA request failed"
        fi
    fi
    
    # Test NDA listings
    if api_request "GET" "/api/nda/pending" "$CREATOR_TOKEN" "" "200" >/dev/null; then
        log_success "Pending NDA listing working"
    else
        log_error "Pending NDA listing failed"
    fi
    
    if api_request "GET" "/api/nda/active" "$CREATOR_TOKEN" "" "200" >/dev/null; then
        log_success "Active NDA listing working"
    else
        log_error "Active NDA listing failed"
    fi
    
    if api_request "GET" "/api/ndas/signed" "$INVESTOR_TOKEN" "" "200" >/dev/null; then
        log_success "Signed NDA listing working"
    else
        log_error "Signed NDA listing failed"
    fi
}

# Test dashboard functionality
test_dashboards() {
    log_test_start "Dashboard Access for All Portal Types"
    
    # Test Creator Dashboard
    if [[ -n "$CREATOR_TOKEN" ]]; then
        if api_request "GET" "/api/creator/dashboard" "$CREATOR_TOKEN" "" "200" >/dev/null; then
            log_success "Creator dashboard working"
        else
            log_error "Creator dashboard failed"
        fi
        
        # Test creator stats
        if api_request "GET" "/api/creator/stats" "$CREATOR_TOKEN" "" "200" >/dev/null; then
            log_success "Creator stats working"
        else
            log_error "Creator stats failed"
        fi
        
        # Test creator analytics
        if api_request "GET" "/api/creator/analytics" "$CREATOR_TOKEN" "" "200" >/dev/null; then
            log_success "Creator analytics working"
        else
            log_error "Creator analytics failed"
        fi
    fi
    
    # Test Investor Dashboard
    if [[ -n "$INVESTOR_TOKEN" ]]; then
        if api_request "GET" "/api/investor/dashboard" "$INVESTOR_TOKEN" "" "200" >/dev/null; then
            log_success "Investor dashboard working"
        else
            log_error "Investor dashboard failed"
        fi
        
        # Test investor portfolio
        if api_request "GET" "/api/investor/portfolio" "$INVESTOR_TOKEN" "" "200" >/dev/null; then
            log_success "Investor portfolio working"
        else
            log_error "Investor portfolio failed"
        fi
        
        # Test investor watchlist
        if api_request "GET" "/api/investor/watchlist" "$INVESTOR_TOKEN" "" "200" >/dev/null; then
            log_success "Investor watchlist working"
        else
            log_error "Investor watchlist failed"
        fi
    fi
}

# Test social features
test_social_features() {
    log_test_start "Social Features (Following, Likes, Comments)"
    
    if [[ -z "$INVESTOR_TOKEN" || -z "$CREATED_PITCH_ID" ]]; then
        log_warning "Tokens not available for social feature tests"
        return 0
    fi
    
    # Test following functionality
    local follow_data='{"pitchId":'$CREATED_PITCH_ID'}'
    if api_request "POST" "/api/follows/follow" "$INVESTOR_TOKEN" "$follow_data" "200" >/dev/null || 
       api_request "POST" "/api/follows/follow" "$INVESTOR_TOKEN" "$follow_data" "201" >/dev/null; then
        log_success "Follow functionality working"
    else
        log_error "Follow functionality failed"
    fi
    
    # Test view tracking
    if [[ -n "$CREATED_PITCH_ID" ]]; then
        if api_request "POST" "/api/pitches/$CREATED_PITCH_ID/view" "$INVESTOR_TOKEN" "" "200" >/dev/null; then
            log_success "View tracking working"
        else
            log_error "View tracking failed"
        fi
    fi
    
    # Test analytics tracking
    local analytics_data='{"eventType":"pitch_view","category":"engagement","pitchId":'$CREATED_PITCH_ID'}'
    if api_request "POST" "/api/analytics/event" "$INVESTOR_TOKEN" "$analytics_data" "200" >/dev/null; then
        log_success "Analytics tracking working"
    else
        log_error "Analytics tracking failed"
    fi
}

# Test messaging system
test_messaging() {
    log_test_start "Messaging System"
    
    if [[ -z "$CREATOR_TOKEN" || -z "$INVESTOR_TOKEN" ]]; then
        log_warning "Tokens not available for messaging tests"
        return 0
    fi
    
    # Test message sending
    local message_data='{
        "recipientId": 1001,
        "subject": "Test Message from Comprehensive Suite",
        "content": "This is a test message to validate messaging functionality"
    }'
    
    if response=$(api_request "POST" "/api/messages/send" "$INVESTOR_TOKEN" "$message_data" "201"); then
        CREATED_MESSAGE_ID=$(extract_json_field "$response" "id")
        log_success "Message sending working"
    else
        if api_request "POST" "/api/messages/send" "$INVESTOR_TOKEN" "$message_data" "200" >/dev/null; then
            log_success "Message sending working (200 status)"
        else
            log_error "Message sending failed"
        fi
    fi
    
    # Test message retrieval
    if api_request "GET" "/api/messages" "$CREATOR_TOKEN" "" "200" >/dev/null; then
        log_success "Message retrieval working"
    else
        log_error "Message retrieval failed"
    fi
    
    # Test conversations
    if api_request "GET" "/api/messages/conversations" "$CREATOR_TOKEN" "" "200" >/dev/null; then
        log_success "Conversations listing working"
    else
        log_error "Conversations listing failed"
    fi
}

# Test notifications
test_notifications() {
    log_test_start "Notification System"
    
    if [[ -z "$CREATOR_TOKEN" ]]; then
        log_warning "Creator token not available for notification tests"
        return 0
    fi
    
    # Test notifications retrieval
    if api_request "GET" "/api/notifications" "$CREATOR_TOKEN" "" "200" >/dev/null; then
        log_success "Notifications retrieval working"
    else
        log_error "Notifications retrieval failed"
    fi
    
    # Test marking notifications as read
    local read_data='{"notificationIds":[1,2,3]}'
    if api_request "POST" "/api/notifications/read" "$CREATOR_TOKEN" "$read_data" "200" >/dev/null; then
        log_success "Mark notifications as read working"
    else
        log_error "Mark notifications as read failed"
    fi
}

# Test WebSocket functionality
test_websocket() {
    log_test_start "WebSocket and Real-time Features"
    
    # Test WebSocket health endpoints
    if api_request "GET" "/api/ws/health" "" "" "200" >/dev/null; then
        log_success "WebSocket health endpoint working"
    else
        log_error "WebSocket health endpoint failed"
    fi
    
    if api_request "GET" "/api/ws/stats" "" "" "200" >/dev/null; then
        log_success "WebSocket stats endpoint working"
    else
        log_error "WebSocket stats endpoint failed"
    fi
    
    # Test WebSocket notification endpoint
    if [[ -n "$CREATOR_TOKEN" ]]; then
        local notify_data='{"type":"test","message":"Test notification"}'
        if api_request "POST" "/api/ws/notify" "$CREATOR_TOKEN" "$notify_data" "200" >/dev/null; then
            log_success "WebSocket notification working"
        else
            log_error "WebSocket notification failed"
        fi
    fi
}

# Test payment endpoints
test_payments() {
    log_test_start "Payment System"
    
    if [[ -z "$CREATOR_TOKEN" ]]; then
        log_warning "Creator token not available for payment tests"
        return 0
    fi
    
    # Test subscription status
    if api_request "GET" "/api/payments/subscription-status" "$CREATOR_TOKEN" "" "200" >/dev/null; then
        log_success "Subscription status endpoint working"
    else
        log_error "Subscription status endpoint failed"
    fi
    
    # Test credits balance
    if api_request "GET" "/api/payments/credits/balance" "$CREATOR_TOKEN" "" "200" >/dev/null; then
        log_success "Credits balance endpoint working"
    else
        log_error "Credits balance endpoint failed"
    fi
    
    # Test billing information
    if api_request "GET" "/api/payments/billing" "$CREATOR_TOKEN" "" "200" >/dev/null; then
        log_success "Billing information endpoint working"
    else
        log_error "Billing information endpoint failed"
    fi
}

# Test error handling
test_error_handling() {
    log_test_start "Error Handling and Security"
    
    # Test 404 for non-existent resources
    if api_request "GET" "/api/pitches/99999" "" "" "404" >/dev/null; then
        log_success "404 handling for non-existent pitches working"
    else
        log_error "404 handling for non-existent pitches failed"
    fi
    
    # Test 401 for protected endpoints without auth
    if api_request "GET" "/api/creator/dashboard" "" "" "401" >/dev/null; then
        log_success "401 handling for protected endpoints working"
    else
        log_error "401 handling for protected endpoints failed"
    fi
    
    # Test invalid JSON handling
    if api_request "POST" "/api/auth/login" "" "invalid-json" "400" >/dev/null; then
        log_success "Invalid JSON handling working"
    else
        log_error "Invalid JSON handling failed"
    fi
}

# Performance tests
test_performance() {
    log_test_start "Performance and Load Testing"
    
    log_info "Testing response times..."
    
    # Test health endpoint response time
    local start_time=$(date +%s%N)
    api_request "GET" "/api/health" "" "" "200" >/dev/null
    local end_time=$(date +%s%N)
    local duration_ms=$(( (end_time - start_time) / 1000000 ))
    
    if [[ $duration_ms -lt 500 ]]; then
        log_success "Health endpoint response time acceptable: ${duration_ms}ms"
    else
        log_warning "Health endpoint response time slow: ${duration_ms}ms"
    fi
    
    # Test concurrent requests
    log_info "Testing concurrent request handling..."
    for i in {1..5}; do
        api_request "GET" "/api/pitches/public" "" "" "200" >/dev/null &
    done
    wait
    log_success "Concurrent request handling completed"
}

# Main test execution
main() {
    echo "=================================================="
    echo "🚀 Pitchey Platform Comprehensive Test Suite"
    echo "=================================================="
    echo "Testing server: $API_BASE"
    echo "Verbose mode: $VERBOSE"
    echo "=================================================="
    
    # Core functionality tests
    test_health
    test_configuration
    test_content
    test_authentication
    test_profiles
    test_pitch_lifecycle
    test_search
    test_nda_workflow
    test_dashboards
    test_social_features
    test_messaging
    test_notifications
    test_websocket
    test_payments
    test_error_handling
    test_performance
    
    # Generate final report
    echo ""
    echo "=================================================="
    echo "📊 TEST RESULTS SUMMARY"
    echo "=================================================="
    echo -e "Total Tests: $TOTAL_TESTS"
    echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
    echo -e "${RED}Failed: $FAILED_TESTS${NC}"
    echo -e "Success Rate: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"
    
    echo ""
    echo "📋 ENDPOINTS TESTED:"
    printf '%s\n' "${ENDPOINTS_TESTED[@]}" | sort | uniq
    
    if [[ ${#FAILED_ENDPOINTS[@]} -gt 0 ]]; then
        echo ""
        echo -e "${RED}❌ FAILED ENDPOINTS:${NC}"
        printf '%s\n' "${FAILED_ENDPOINTS[@]}"
    fi
    
    echo ""
    echo "=================================================="
    echo "🎯 PLATFORM STATUS ASSESSMENT"
    echo "=================================================="
    
    # Calculate component health
    local auth_health=$((PASSED_TESTS > 0 ? 1 : 0))
    local core_health=$((PASSED_TESTS > FAILED_TESTS ? 1 : 0))
    
    if [[ $FAILED_TESTS -eq 0 ]]; then
        echo -e "${GREEN}🎉 PLATFORM STATUS: FULLY FUNCTIONAL${NC}"
        echo "All core workflows are working correctly!"
    elif [[ $PASSED_TESTS -gt $FAILED_TESTS ]]; then
        echo -e "${YELLOW}⚠️  PLATFORM STATUS: MOSTLY FUNCTIONAL${NC}"
        echo "Core functionality working, some features need attention."
    else
        echo -e "${RED}❌ PLATFORM STATUS: NEEDS ATTENTION${NC}"
        echo "Significant issues detected, platform needs fixes."
    fi
    
    echo ""
    echo "🔍 COMPONENT HEALTH:"
    [[ -n "$CREATOR_TOKEN" ]] && echo -e "${GREEN}✅ Creator Portal: Functional${NC}" || echo -e "${RED}❌ Creator Portal: Issues${NC}"
    [[ -n "$INVESTOR_TOKEN" ]] && echo -e "${GREEN}✅ Investor Portal: Functional${NC}" || echo -e "${RED}❌ Investor Portal: Issues${NC}"
    [[ -n "$PRODUCTION_TOKEN" ]] && echo -e "${GREEN}✅ Production Portal: Functional${NC}" || echo -e "${RED}❌ Production Portal: Issues${NC}"
    [[ -n "$CREATED_PITCH_ID" ]] && echo -e "${GREEN}✅ Pitch Management: Functional${NC}" || echo -e "${RED}❌ Pitch Management: Issues${NC}"
    
    echo ""
    echo "=================================================="
    
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
            echo "Options:"
            echo "  -v, --verbose    Enable verbose output"
            echo "  -h, --help       Show this help message"
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