#!/bin/bash

# Comprehensive Test Suite for Fix Validation
# This script tests all implemented fixes and validates core functionality

set -e

BASE_URL="http://localhost:8001"
LOG_FILE="comprehensive-fix-validation-results.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "==================================="
echo "COMPREHENSIVE FIX VALIDATION TEST"
echo "Started: $TIMESTAMP"
echo "Server: $BASE_URL"
echo "==================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

test_success() {
    log "${GREEN}✅ $1${NC}"
}

test_failure() {
    log "${RED}❌ $1${NC}"
}

test_warning() {
    log "${YELLOW}⚠️  $1${NC}"
}

test_info() {
    log "${BLUE}ℹ️  $1${NC}"
}

# Initialize log file
echo "Comprehensive Fix Validation Test - $TIMESTAMP" > "$LOG_FILE"
echo "=========================================" >> "$LOG_FILE"

# Demo account credentials
CREATOR_EMAIL="alex.creator@demo.com"
CREATOR_PASSWORD="Demo123"
INVESTOR_EMAIL="sarah.investor@demo.com" 
INVESTOR_PASSWORD="Demo123"
PRODUCTION_EMAIL="stellar.production@demo.com"
PRODUCTION_PASSWORD="Demo123"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNING_TESTS=0

increment_test() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

increment_pass() {
    PASSED_TESTS=$((PASSED_TESTS + 1))
}

increment_fail() {
    FAILED_TESTS=$((FAILED_TESTS + 1))
}

increment_warning() {
    WARNING_TESTS=$((WARNING_TESTS + 1))
}

# Helper function to get JWT token
get_jwt_token() {
    local email="$1"
    local password="$2"
    local portal="$3"
    
    local response=$(curl -s -X POST "$BASE_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"$password\",\"portal\":\"$portal\"}")
    
    if echo "$response" | grep -q "token"; then
        echo "$response" | grep -o '"token":"[^"]*' | cut -d'"' -f4
    else
        echo "ERROR"
    fi
}

# Test 1: Core Authentication Functionality
test_authentication() {
    log "\n${BLUE}=== TESTING CORE AUTHENTICATION ===${NC}"
    
    # Test Creator Login
    increment_test
    test_info "Testing Creator authentication..."
    CREATOR_TOKEN=$(get_jwt_token "$CREATOR_EMAIL" "$CREATOR_PASSWORD" "creator")
    if [ "$CREATOR_TOKEN" != "ERROR" ] && [ ! -z "$CREATOR_TOKEN" ]; then
        test_success "Creator authentication successful"
        increment_pass
    else
        test_failure "Creator authentication failed"
        increment_fail
    fi
    
    # Test Investor Login
    increment_test
    test_info "Testing Investor authentication..."
    INVESTOR_TOKEN=$(get_jwt_token "$INVESTOR_EMAIL" "$INVESTOR_PASSWORD" "investor")
    if [ "$INVESTOR_TOKEN" != "ERROR" ] && [ ! -z "$INVESTOR_TOKEN" ]; then
        test_success "Investor authentication successful"
        increment_pass
    else
        test_failure "Investor authentication failed"
        increment_fail
    fi
    
    # Test Production Login
    increment_test
    test_info "Testing Production authentication..."
    PRODUCTION_TOKEN=$(get_jwt_token "$PRODUCTION_EMAIL" "$PRODUCTION_PASSWORD" "production")
    if [ "$PRODUCTION_TOKEN" != "ERROR" ] && [ ! -z "$PRODUCTION_TOKEN" ]; then
        test_success "Production authentication successful"
        increment_pass
    else
        test_failure "Production authentication failed"
        increment_fail
    fi
}

# Test 2: WebSocket Stats Authentication Fix
test_websocket_stats() {
    log "\n${BLUE}=== TESTING WEBSOCKET STATS AUTHENTICATION FIX ===${NC}"
    
    if [ "$CREATOR_TOKEN" != "ERROR" ] && [ ! -z "$CREATOR_TOKEN" ]; then
        increment_test
        test_info "Testing WebSocket stats endpoint with Creator token..."
        
        response=$(curl -s -w "HTTP_STATUS:%{http_code}" \
            -H "Authorization: Bearer $CREATOR_TOKEN" \
            "$BASE_URL/api/ws/stats")
        
        status_code=$(echo "$response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
        body=$(echo "$response" | sed 's/HTTP_STATUS:[0-9]*$//')
        
        if [ "$status_code" = "200" ]; then
            test_success "WebSocket stats endpoint accessible with demo user token"
            increment_pass
        else
            test_failure "WebSocket stats endpoint failed (Status: $status_code)"
            increment_fail
        fi
    else
        test_warning "Skipping WebSocket stats test - no valid Creator token"
        increment_warning
    fi
}

# Test 3: Message Contact Lookup Fix
test_message_contacts() {
    log "\n${BLUE}=== TESTING MESSAGE CONTACT LOOKUP FIX ===${NC}"
    
    if [ "$CREATOR_TOKEN" != "ERROR" ] && [ ! -z "$CREATOR_TOKEN" ]; then
        increment_test
        test_info "Testing message contacts endpoint..."
        
        response=$(curl -s -w "HTTP_STATUS:%{http_code}" \
            -H "Authorization: Bearer $CREATOR_TOKEN" \
            "$BASE_URL/api/messages/available-contacts")
        
        status_code=$(echo "$response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
        body=$(echo "$response" | sed 's/HTTP_STATUS:[0-9]*$//')
        
        if [ "$status_code" = "200" ] && ! echo "$body" | grep -q "error"; then
            test_success "Message contacts endpoint working without server errors"
            increment_pass
        else
            test_failure "Message contacts endpoint failed (Status: $status_code)"
            test_info "Response body: $body"
            increment_fail
        fi
    else
        test_warning "Skipping message contacts test - no valid Creator token"
        increment_warning
    fi
}

# Test 4: New View Tracking Endpoints
test_view_tracking() {
    log "\n${BLUE}=== TESTING NEW VIEW TRACKING ENDPOINTS ===${NC}"
    
    # First get a pitch ID to test with
    if [ "$CREATOR_TOKEN" != "ERROR" ] && [ ! -z "$CREATOR_TOKEN" ]; then
        test_info "Getting pitch ID for view tracking test..."
        pitches_response=$(curl -s -H "Authorization: Bearer $CREATOR_TOKEN" "$BASE_URL/api/pitches")
        
        if echo "$pitches_response" | grep -q '"id"'; then
            PITCH_ID=$(echo "$pitches_response" | jq -r '.data.pitches[0].id // empty' 2>/dev/null || echo "")
            test_info "Using pitch ID: $PITCH_ID"
            
            # Test POST /api/pitches/:id/view
            increment_test
            test_info "Testing POST view tracking endpoint..."
            
            view_response=$(curl -s -w "HTTP_STATUS:%{http_code}" -X POST \
                -H "Authorization: Bearer $INVESTOR_TOKEN" \
                -H "Content-Type: application/json" \
                "$BASE_URL/api/pitches/$PITCH_ID/view")
            
            view_status=$(echo "$view_response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
            
            if [ "$view_status" = "201" ] || [ "$view_status" = "200" ]; then
                test_success "POST view tracking endpoint working (Status: $view_status)"
                increment_pass
            else
                test_failure "POST view tracking endpoint failed (Status: $view_status)"
                increment_fail
            fi
            
            # Test GET /api/pitches/:id/analytics
            increment_test
            test_info "Testing GET analytics endpoint..."
            
            analytics_response=$(curl -s -w "HTTP_STATUS:%{http_code}" \
                -H "Authorization: Bearer $CREATOR_TOKEN" \
                "$BASE_URL/api/pitches/$PITCH_ID/analytics")
            
            analytics_status=$(echo "$analytics_response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
            
            if [ "$analytics_status" = "200" ]; then
                test_success "GET analytics endpoint working"
                increment_pass
            else
                test_failure "GET analytics endpoint failed (Status: $analytics_status)"
                increment_fail
            fi
        else
            test_warning "No pitches found for view tracking test"
            increment_warning
        fi
    else
        test_warning "Skipping view tracking test - no valid tokens"
        increment_warning
    fi
}

# Test 5: HTTP Status Codes for POST Endpoints
test_post_status_codes() {
    log "\n${BLUE}=== TESTING POST ENDPOINT STATUS CODES ===${NC}"
    
    if [ "$CREATOR_TOKEN" != "ERROR" ] && [ ! -z "$CREATOR_TOKEN" ]; then
        # Test pitch creation returns 201
        increment_test
        test_info "Testing pitch creation status code..."
        
        pitch_data='{
            "title": "Test Pitch Status Code",
            "shortDescription": "Testing 201 status code",
            "fullDescription": "This is a test pitch to validate status codes",
            "genre": "Drama",
            "duration": 90,
            "budget": 100000,
            "targetAudience": "General"
        }'
        
        create_response=$(curl -s -w "HTTP_STATUS:%{http_code}" -X POST \
            -H "Authorization: Bearer $CREATOR_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$pitch_data" \
            "$BASE_URL/api/pitches")
        
        create_status=$(echo "$create_response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
        
        if [ "$create_status" = "201" ]; then
            test_success "Pitch creation returns 201 status code"
            increment_pass
        elif [ "$create_status" = "200" ]; then
            test_warning "Pitch creation returns 200 instead of 201"
            increment_warning
        else
            test_failure "Pitch creation failed (Status: $create_status)"
            increment_fail
        fi
        
        # Test message creation returns 201 (if applicable)
        increment_test
        test_info "Testing message creation status code..."
        
        message_data='{
            "recipientId": "user_investor_demo",
            "content": "Test message for status code validation"
        }'
        
        message_response=$(curl -s -w "HTTP_STATUS:%{http_code}" -X POST \
            -H "Authorization: Bearer $CREATOR_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$message_data" \
            "$BASE_URL/api/messages")
        
        message_status=$(echo "$message_response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
        
        if [ "$message_status" = "201" ]; then
            test_success "Message creation returns 201 status code"
            increment_pass
        elif [ "$message_status" = "200" ]; then
            test_warning "Message creation returns 200 instead of 201"
            increment_warning
        else
            test_failure "Message creation failed (Status: $message_status)"
            increment_fail
        fi
    else
        test_warning "Skipping POST status code tests - no valid Creator token"
        increment_warning
    fi
}

# Test 6: Error Handling Improvements
test_error_handling() {
    log "\n${BLUE}=== TESTING ERROR HANDLING IMPROVEMENTS ===${NC}"
    
    # Test invalid authentication
    increment_test
    test_info "Testing invalid authentication error handling..."
    
    invalid_response=$(curl -s -w "HTTP_STATUS:%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d '{"email":"invalid@example.com","password":"wrongpassword","portal":"creator"}' \
        "$BASE_URL/api/auth/login")
    
    invalid_status=$(echo "$invalid_response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
    invalid_body=$(echo "$invalid_response" | sed 's/HTTP_STATUS:[0-9]*$//')
    
    if [ "$invalid_status" = "401" ] && echo "$invalid_body" | grep -q "error"; then
        test_success "Invalid authentication returns proper error response"
        increment_pass
    else
        test_failure "Invalid authentication error handling needs improvement"
        increment_fail
    fi
    
    # Test malformed request data
    increment_test
    test_info "Testing malformed request error handling..."
    
    malformed_response=$(curl -s -w "HTTP_STATUS:%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d '{"invalid":"json","structure":}' \
        "$BASE_URL/api/auth/login")
    
    malformed_status=$(echo "$malformed_response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
    
    if [ "$malformed_status" = "400" ]; then
        test_success "Malformed request returns 400 status code"
        increment_pass
    else
        test_failure "Malformed request error handling could be improved (Status: $malformed_status)"
        increment_fail
    fi
}

# Test 7: Core Workflow Regression Tests
test_core_workflows() {
    log "\n${BLUE}=== TESTING CORE WORKFLOW REGRESSIONS ===${NC}"
    
    # Test dashboard access
    for portal in "creator" "investor" "production"; do
        increment_test
        test_info "Testing $portal dashboard access..."
        
        case $portal in
            "creator")
                token="$CREATOR_TOKEN"
                ;;
            "investor")
                token="$INVESTOR_TOKEN"
                ;;
            "production")
                token="$PRODUCTION_TOKEN"
                ;;
        esac
        
        if [ "$token" != "ERROR" ] && [ ! -z "$token" ]; then
            dashboard_endpoint="/api/${portal}/dashboard"
            dashboard_response=$(curl -s -w "HTTP_STATUS:%{http_code}" \
                -H "Authorization: Bearer $token" \
                "$BASE_URL$dashboard_endpoint")
            
            dashboard_status=$(echo "$dashboard_response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
            
            if [ "$dashboard_status" = "200" ]; then
                test_success "$portal dashboard accessible"
                increment_pass
            else
                test_failure "$portal dashboard failed (Status: $dashboard_status)"
                increment_fail
            fi
        else
            test_warning "Skipping $portal dashboard test - no valid token"
            increment_warning
        fi
    done
    
    # Test pitch retrieval
    increment_test
    test_info "Testing pitch retrieval functionality..."
    
    if [ "$CREATOR_TOKEN" != "ERROR" ] && [ ! -z "$CREATOR_TOKEN" ]; then
        pitches_response=$(curl -s -w "HTTP_STATUS:%{http_code}" \
            -H "Authorization: Bearer $CREATOR_TOKEN" \
            "$BASE_URL/api/pitches")
        
        pitches_status=$(echo "$pitches_response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
        pitches_body=$(echo "$pitches_response" | sed 's/HTTP_STATUS:[0-9]*$//')
        
        if [ "$pitches_status" = "200" ] && echo "$pitches_body" | grep -q "\""; then
            test_success "Pitch retrieval working"
            increment_pass
        else
            test_failure "Pitch retrieval failed (Status: $pitches_status)"
            increment_fail
        fi
    else
        test_warning "Skipping pitch retrieval test - no valid Creator token"
        increment_warning
    fi
    
    # Test search functionality
    increment_test
    test_info "Testing search functionality..."
    
    search_response=$(curl -s -w "HTTP_STATUS:%{http_code}" \
        "$BASE_URL/api/pitches/search?query=test")
    
    search_status=$(echo "$search_response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
    
    if [ "$search_status" = "200" ]; then
        test_success "Search functionality working"
        increment_pass
    else
        test_failure "Search functionality failed (Status: $search_status)"
        increment_fail
    fi
}

# Test 8: Real-time Features Test
test_realtime_features() {
    log "\n${BLUE}=== TESTING REAL-TIME FEATURES ===${NC}"
    
    # Test WebSocket connection endpoint
    increment_test
    test_info "Testing WebSocket connection health..."
    
    ws_response=$(curl -s -w "HTTP_STATUS:%{http_code}" "$BASE_URL/api/ws/health")
    ws_status=$(echo "$ws_response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
    
    if [ "$ws_status" = "200" ]; then
        test_success "WebSocket health endpoint responding"
        increment_pass
    else
        test_failure "WebSocket health endpoint failed (Status: $ws_status)"
        increment_fail
    fi
    
    # Test notifications endpoint
    increment_test
    test_info "Testing notifications endpoint..."
    
    if [ "$CREATOR_TOKEN" != "ERROR" ] && [ ! -z "$CREATOR_TOKEN" ]; then
        notifications_response=$(curl -s -w "HTTP_STATUS:%{http_code}" \
            -H "Authorization: Bearer $CREATOR_TOKEN" \
            "$BASE_URL/api/notifications")
        
        notifications_status=$(echo "$notifications_response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
        
        if [ "$notifications_status" = "200" ]; then
            test_success "Notifications endpoint working"
            increment_pass
        else
            test_failure "Notifications endpoint failed (Status: $notifications_status)"
            increment_fail
        fi
    else
        test_warning "Skipping notifications test - no valid Creator token"
        increment_warning
    fi
}

# Run all tests
main() {
    log "Starting comprehensive fix validation tests...\n"
    
    test_authentication
    test_websocket_stats
    test_message_contacts
    test_view_tracking
    test_post_status_codes
    test_error_handling
    test_core_workflows
    test_realtime_features
    
    # Generate summary
    log "\n${BLUE}=== TEST SUMMARY ===${NC}"
    log "Total Tests: $TOTAL_TESTS"
    log "${GREEN}Passed: $PASSED_TESTS${NC}"
    log "${RED}Failed: $FAILED_TESTS${NC}"
    log "${YELLOW}Warnings: $WARNING_TESTS${NC}"
    
    PASS_RATE=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
    log "Pass Rate: ${PASS_RATE}%"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        log "\n${GREEN}🎉 ALL CRITICAL TESTS PASSED! Fixes are working correctly.${NC}"
    elif [ $FAILED_TESTS -lt 3 ]; then
        log "\n${YELLOW}⚠️  Most tests passed with minor issues. Review failed tests.${NC}"
    else
        log "\n${RED}❌ Multiple test failures detected. Fixes may need review.${NC}"
    fi
    
    log "\nDetailed results saved to: $LOG_FILE"
    log "Test completed: $(date '+%Y-%m-%d %H:%M:%S')"
}

# Execute main function
main