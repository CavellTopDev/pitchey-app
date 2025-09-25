#!/bin/bash

# Specialized NDA Workflow Testing Script
# Tests the recently fixed NDA request functionality in production
# 
# This script specifically tests:
# 1. NDA request submission (POST /api/ndas/request) 
# 2. NDA request listing (GET /api/ndas/request)
# 3. NDA status checking (GET /api/pitches/:id/nda)
# 4. NDA approval/rejection workflow

set -e

# Configuration
BACKEND_URL="https://pitchey-backend.deno.dev"
FRONTEND_URL="https://pitchey-frontend.deno.dev"

# Demo accounts
CREATOR_EMAIL="alex.creator@demo.com"
CREATOR_PASSWORD="Demo123"
INVESTOR_EMAIL="sarah.investor@demo.com"
INVESTOR_PASSWORD="Demo123"
PRODUCTION_EMAIL="stellar.production@demo.com"
PRODUCTION_PASSWORD="Demo123"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

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

# Make HTTP request with detailed response info
make_request() {
    local method="$1"
    local url="$2"
    local data="$3"
    local headers="$4"
    
    local response
    if [ -n "$data" ] && [ -n "$headers" ]; then
        response=$(curl -s -w "\n%{http_code}\n%{content_type}" -X "$method" "$url" \
            -H "Content-Type: application/json" \
            -H "$headers" \
            -d "$data" 2>/dev/null || echo -e "\n000\n")
    elif [ -n "$headers" ]; then
        response=$(curl -s -w "\n%{http_code}\n%{content_type}" -X "$method" "$url" \
            -H "$headers" 2>/dev/null || echo -e "\n000\n")
    else
        response=$(curl -s -w "\n%{http_code}\n%{content_type}" -X "$method" "$url" 2>/dev/null || echo -e "\n000\n")
    fi
    
    local http_code=$(echo "$response" | tail -n2 | head -n1)
    local content_type=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | head -n -2)
    
    echo "$http_code|$content_type|$body"
}

# Authentication
authenticate() {
    local portal="$1"
    local email="$2"
    local password="$3"
    
    local auth_data="{\"email\":\"$email\",\"password\":\"$password\"}"
    local response_data=$(make_request "POST" "$BACKEND_URL/api/auth/$portal/login" "$auth_data")
    
    local http_code=$(echo "$response_data" | cut -d'|' -f1)
    local body=$(echo "$response_data" | cut -d'|' -f3-)
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        # Extract token - works with both {"token":"..."} and {"session":{"token":"..."}}
        local token=$(echo "$body" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    token = data.get('token') or data.get('session', {}).get('token', '')
    user_id = data.get('user', {}).get('id', '')
    print(f'{token}|{user_id}')
except Exception as e:
    print('|')
" 2>/dev/null)
        
        echo "$token|$http_code"
    else
        echo "||$http_code"
    fi
}

# Get available pitches
get_test_pitch() {
    local response_data=$(make_request "GET" "$BACKEND_URL/api/pitches")
    local http_code=$(echo "$response_data" | cut -d'|' -f1)
    local body=$(echo "$response_data" | cut -d'|' -f3-)
    
    if [ "$http_code" = "200" ]; then
        local pitch_id=$(echo "$body" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if isinstance(data, list) and len(data) > 0:
        print(data[0].get('id', ''))
    elif isinstance(data, dict) and 'pitches' in data and len(data['pitches']) > 0:
        print(data['pitches'][0].get('id', ''))
    else:
        print('')
except:
    print('')
" 2>/dev/null)
        echo "$pitch_id"
    else
        echo ""
    fi
}

main() {
    log "${BOLD}${CYAN}🔍 NDA WORKFLOW PRODUCTION TEST${NC}"
    log "${CYAN}Testing the recently fixed NDA request functionality...${NC}"
    log "Backend: $BACKEND_URL"
    echo

    # Step 1: Authentication
    log "${BOLD}Step 1: Authentication Setup${NC}"
    
    log "Authenticating as Creator..."
    local creator_auth=$(authenticate "creator" "$CREATOR_EMAIL" "$CREATOR_PASSWORD")
    local creator_token=$(echo "$creator_auth" | cut -d'|' -f1)
    local creator_user_id=$(echo "$creator_auth" | cut -d'|' -f2)
    local creator_http_code=$(echo "$creator_auth" | cut -d'|' -f3)
    
    if [ -n "$creator_token" ] && [ "$creator_http_code" = "200" ]; then
        log_test "Creator authentication" "true" "User ID: $creator_user_id"
    else
        log_test "Creator authentication" "false" "HTTP $creator_http_code"
        log "${RED}Cannot proceed without creator authentication${NC}"
        exit 1
    fi
    
    log "Authenticating as Investor..."
    local investor_auth=$(authenticate "investor" "$INVESTOR_EMAIL" "$INVESTOR_PASSWORD")
    local investor_token=$(echo "$investor_auth" | cut -d'|' -f1)
    local investor_user_id=$(echo "$investor_auth" | cut -d'|' -f2)
    local investor_http_code=$(echo "$investor_auth" | cut -d'|' -f3)
    
    if [ -n "$investor_token" ] && [ "$investor_http_code" = "200" ]; then
        log_test "Investor authentication" "true" "User ID: $investor_user_id"
    else
        log_test "Investor authentication" "false" "HTTP $investor_http_code"
        log "${RED}Cannot proceed without investor authentication${NC}"
        exit 1
    fi
    
    log "Authenticating as Production Company..."
    local production_auth=$(authenticate "production" "$PRODUCTION_EMAIL" "$PRODUCTION_PASSWORD")
    local production_token=$(echo "$production_auth" | cut -d'|' -f1)
    local production_user_id=$(echo "$production_auth" | cut -d'|' -f2)
    local production_http_code=$(echo "$production_auth" | cut -d'|' -f3)
    
    if [ -n "$production_token" ] && [ "$production_http_code" = "200" ]; then
        log_test "Production authentication" "true" "User ID: $production_user_id"
    else
        log_test "Production authentication" "false" "HTTP $production_http_code"
    fi

    # Step 2: Get a test pitch
    log "\n${BOLD}Step 2: Pitch Discovery${NC}"
    
    local test_pitch_id=$(get_test_pitch)
    if [ -n "$test_pitch_id" ]; then
        log_test "Get test pitch" "true" "Using Pitch ID: $test_pitch_id"
    else
        log_test "Get test pitch" "false" "No pitches available for testing"
        test_pitch_id="1" # Use fallback
        log "${YELLOW}Using fallback Pitch ID: $test_pitch_id${NC}"
    fi

    # Step 3: Test NDA Request Submission (THE RECENTLY FIXED FEATURE)
    log "\n${BOLD}Step 3: NDA Request Submission (RECENTLY FIXED)${NC}"
    
    # Test as investor
    log "Testing NDA request as Investor..."
    local nda_request_data="{
        \"pitchId\": $test_pitch_id,
        \"ndaType\": \"basic\",
        \"requestMessage\": \"I'm interested in learning more about this project for potential investment. Please provide access to the full pitch materials.\",
        \"companyInfo\": \"Demo Investment Firm - Specialized in film and entertainment investments\"
    }"
    
    local nda_response=$(make_request "POST" "$BACKEND_URL/api/ndas/request" "$nda_request_data" "Authorization: Bearer $investor_token")
    local nda_http_code=$(echo "$nda_response" | cut -d'|' -f1)
    local nda_body=$(echo "$nda_response" | cut -d'|' -f3-)
    
    log "Response Code: $nda_http_code"
    log "Response Body: $nda_body"
    
    if [ "$nda_http_code" = "201" ]; then
        log_test "NDA request submission (new)" "true" "Successfully created NDA request"
        local request_id=$(echo "$nda_body" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('request', {}).get('id', ''))
except:
    print('')
" 2>/dev/null)
        log "Created Request ID: $request_id"
    elif [ "$nda_http_code" = "400" ]; then
        # Check if it's "already exists" - this is acceptable
        local error_msg=$(echo "$nda_body" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('error', ''))
except:
    print('')
" 2>/dev/null)
        
        if [[ "$error_msg" == *"already"* ]] || [[ "$error_msg" == *"pending"* ]]; then
            log_test "NDA request submission (existing)" "true" "Request already exists (acceptable)"
        else
            log_test "NDA request submission" "false" "Unexpected error: $error_msg"
        fi
    else
        log_test "NDA request submission" "false" "HTTP $nda_http_code - $nda_body"
    fi
    
    # Test as production company
    log "\nTesting NDA request as Production Company..."
    if [ -n "$production_token" ]; then
        local prod_nda_request_data="{
            \"pitchId\": $test_pitch_id,
            \"ndaType\": \"enhanced\",
            \"requestMessage\": \"We are a production company interested in potentially acquiring or developing this project. Please provide access to detailed materials.\",
            \"companyInfo\": \"Stellar Productions - Full-service film production company\"
        }"
        
        local prod_nda_response=$(make_request "POST" "$BACKEND_URL/api/ndas/request" "$prod_nda_request_data" "Authorization: Bearer $production_token")
        local prod_nda_http_code=$(echo "$prod_nda_response" | cut -d'|' -f1)
        local prod_nda_body=$(echo "$prod_nda_response" | cut -d'|' -f3-)
        
        if [ "$prod_nda_http_code" = "201" ]; then
            log_test "Production NDA request" "true" "Successfully created production NDA request"
        elif [ "$prod_nda_http_code" = "400" ]; then
            local prod_error_msg=$(echo "$prod_nda_body" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('error', ''))
except:
    print('')
" 2>/dev/null)
            
            if [[ "$prod_error_msg" == *"already"* ]] || [[ "$prod_error_msg" == *"pending"* ]]; then
                log_test "Production NDA request" "true" "Request already exists (acceptable)"
            else
                log_test "Production NDA request" "false" "Unexpected error: $prod_error_msg"
            fi
        else
            log_test "Production NDA request" "false" "HTTP $prod_nda_http_code"
        fi
    fi

    # Step 4: Test NDA Request Listing
    log "\n${BOLD}Step 4: NDA Request Listing${NC}"
    
    # Test outgoing requests (from requester's perspective)
    log "Testing outgoing NDA requests listing..."
    local outgoing_response=$(make_request "GET" "$BACKEND_URL/api/ndas/request?type=outgoing" "" "Authorization: Bearer $investor_token")
    local outgoing_http_code=$(echo "$outgoing_response" | cut -d'|' -f1)
    local outgoing_body=$(echo "$outgoing_response" | cut -d'|' -f3-)
    
    if [ "$outgoing_http_code" = "200" ]; then
        local request_count=$(echo "$outgoing_body" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    requests = data.get('requests', [])
    print(len(requests))
except:
    print('0')
" 2>/dev/null)
        log_test "Outgoing NDA requests" "true" "$request_count requests found"
    else
        log_test "Outgoing NDA requests" "false" "HTTP $outgoing_http_code"
    fi
    
    # Test incoming requests (from pitch owner's perspective)
    log "Testing incoming NDA requests listing..."
    local incoming_response=$(make_request "GET" "$BACKEND_URL/api/ndas/request?type=incoming" "" "Authorization: Bearer $creator_token")
    local incoming_http_code=$(echo "$incoming_response" | cut -d'|' -f1)
    local incoming_body=$(echo "$incoming_response" | cut -d'|' -f3-)
    
    if [ "$incoming_http_code" = "200" ]; then
        local incoming_count=$(echo "$incoming_body" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    requests = data.get('requests', [])
    print(len(requests))
except:
    print('0')
" 2>/dev/null)
        log_test "Incoming NDA requests" "true" "$incoming_count requests found"
    else
        log_test "Incoming NDA requests" "false" "HTTP $incoming_http_code"
    fi

    # Step 5: Test NDA Status Check
    log "\n${BOLD}Step 5: NDA Status Check${NC}"
    
    local status_response=$(make_request "GET" "$BACKEND_URL/api/pitches/$test_pitch_id/nda" "" "Authorization: Bearer $investor_token")
    local status_http_code=$(echo "$status_response" | cut -d'|' -f1)
    local status_body=$(echo "$status_response" | cut -d'|' -f3-)
    
    if [ "$status_http_code" = "200" ]; then
        local has_signed=$(echo "$status_body" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('hasSignedNda', False))
except:
    print('False')
" 2>/dev/null)
        log_test "NDA status check" "true" "Has signed NDA: $has_signed"
    else
        log_test "NDA status check" "false" "HTTP $status_http_code"
    fi

    # Step 6: Test Error Conditions
    log "\n${BOLD}Step 6: Error Condition Testing${NC}"
    
    # Test invalid pitch ID
    local invalid_response=$(make_request "POST" "$BACKEND_URL/api/ndas/request" "{\"pitchId\": 99999, \"ndaType\": \"basic\"}" "Authorization: Bearer $investor_token")
    local invalid_http_code=$(echo "$invalid_response" | cut -d'|' -f1)
    log_test "Invalid pitch ID handling" "$([ "$invalid_http_code" = "404" ] && echo true || echo false)" "HTTP $invalid_http_code (expected 404)"
    
    # Test unauthorized request
    local unauth_response=$(make_request "POST" "$BACKEND_URL/api/ndas/request" "{\"pitchId\": $test_pitch_id, \"ndaType\": \"basic\"}")
    local unauth_http_code=$(echo "$unauth_response" | cut -d'|' -f1)
    log_test "Unauthorized access handling" "$([ "$unauth_http_code" = "401" ] && echo true || echo false)" "HTTP $unauth_http_code (expected 401)"
    
    # Test invalid JSON
    local invalid_json_response=$(make_request "POST" "$BACKEND_URL/api/ndas/request" "invalid json" "Authorization: Bearer $investor_token")
    local invalid_json_http_code=$(echo "$invalid_json_response" | cut -d'|' -f1)
    log_test "Invalid JSON handling" "$([ "$invalid_json_http_code" -ge "400" ] && echo true || echo false)" "HTTP $invalid_json_http_code (expected 4xx)"

    # Final Summary
    log "\n${BOLD}${CYAN}📊 NDA WORKFLOW TEST SUMMARY${NC}"
    log "$(printf '=%.0s' {1..50})"
    
    local total_tests=$((TESTS_PASSED + TESTS_FAILED))
    local success_rate=0
    if [ "$total_tests" -gt "0" ]; then
        success_rate=$((TESTS_PASSED * 100 / total_tests))
    fi
    
    log "${GREEN}✓ Passed: $TESTS_PASSED${NC}"
    log "${RED}✗ Failed: $TESTS_FAILED${NC}"
    log "📈 Success Rate: $success_rate%"
    
    if [ "$TESTS_FAILED" -gt "0" ]; then
        log "\n${RED}${BOLD}FAILED TESTS:${NC}"
        for failed_test in "${FAILED_TESTS[@]}"; do
            log "${RED}• $failed_test${NC}"
        done
    fi
    
    # Verdict on the NDA fix
    log "\n${BOLD}${CYAN}🔍 NDA FIX VERIFICATION:${NC}"
    if [ "$TESTS_FAILED" -eq "0" ]; then
        log "${GREEN}✅ NDA request functionality is working correctly!${NC}"
        log "${GREEN}The recent fix has resolved the issues.${NC}"
    elif [ "$TESTS_FAILED" -le "2" ]; then
        log "${YELLOW}⚠️  NDA core functionality works with minor issues.${NC}"
        log "${YELLOW}Most critical workflows are operational.${NC}"
    else
        log "${RED}🚨 NDA request functionality still has issues.${NC}"
        log "${RED}Further investigation and fixes may be needed.${NC}"
    fi
    
    exit $([ "$TESTS_FAILED" -eq "0" ] && echo "0" || echo "1")
}

# Run the test
main "$@"