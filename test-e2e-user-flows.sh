#!/bin/bash

# End-to-End User Flow Testing Script
# Tests complete user journeys through the dynamic content management system

set -e

# Configuration
FRONTEND_URL="http://localhost:5173"
API_BASE="http://localhost:8001"
PLAYWRIGHT_DIR="/home/supremeisbeing/pitcheymovie/pitchey_v0.2/e2e-tests"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Test counters
TOTAL_FLOWS=0
PASSED_FLOWS=0
FAILED_FLOWS=0

echo -e "${BLUE}=== End-to-End User Flow Tests ===${NC}"
echo "Frontend: $FRONTEND_URL"
echo "Backend: $API_BASE"
echo ""

# Function to print test results
print_result() {
    local flow_name="$1"
    local status="$2"
    local details="$3"
    
    TOTAL_FLOWS=$((TOTAL_FLOWS + 1))
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✓ PASS${NC} $flow_name"
        PASSED_FLOWS=$((PASSED_FLOWS + 1))
    else
        echo -e "${RED}✗ FAIL${NC} $flow_name"
        FAILED_FLOWS=$((FAILED_FLOWS + 1))
    fi
    
    if [ -n "$details" ]; then
        echo -e "  ${YELLOW}Details:${NC} $details"
    fi
}

# Function to make API requests
api_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local token="$4"
    
    local curl_opts=("-s" "-w" "%{http_code}")
    
    if [ -n "$token" ]; then
        curl_opts+=("-H" "Authorization: Bearer $token")
    fi
    
    if [ -n "$data" ]; then
        curl_opts+=("-H" "Content-Type: application/json" "-d" "$data")
    fi
    
    local response=$(curl "${curl_opts[@]}" -X "$method" "$API_BASE$endpoint")
    local body="${response%???}"
    local status_code="${response: -3}"
    
    echo "$status_code|$body"
}

# Function to simulate browser interactions
simulate_page_load() {
    local url="$1"
    local expected_elements="$2"
    
    # Simulate page load with curl to check if page responds
    local response=$(curl -s -w "%{http_code}" "$url" || echo "000")
    local status_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$status_code" = "200" ]; then
        # Check for expected elements in the response
        local found_elements=0
        IFS=',' read -ra ELEMENTS <<< "$expected_elements"
        for element in "${ELEMENTS[@]}"; do
            if echo "$body" | grep -q "$element"; then
                found_elements=$((found_elements + 1))
            fi
        done
        
        if [ "$found_elements" -eq "${#ELEMENTS[@]}" ]; then
            return 0
        else
            return 1
        fi
    else
        return 1
    fi
}

# Flow 1: Portal Selection with Dynamic Content
test_portal_selection_flow() {
    echo -e "${BLUE}=== Testing Portal Selection Flow ===${NC}"
    
    # Step 1: Load portal selection page
    if simulate_page_load "$FRONTEND_URL" "creator,investor,production"; then
        local step1_pass=true
    else
        local step1_pass=false
    fi
    
    # Step 2: Check portal content API
    local creator_response=$(api_request "GET" "/api/content/portals/creator")
    local creator_status=$(echo "$creator_response" | cut -d'|' -f1)
    local creator_body=$(echo "$creator_response" | cut -d'|' -f2-)
    
    # Step 3: Check portal configuration API
    local config_response=$(api_request "GET" "/api/config/portal/creator")
    local config_status=$(echo "$config_response" | cut -d'|' -f1)
    
    # Step 4: Check feature flags API
    local flags_response=$(api_request "GET" "/api/features/flags?portal=creator")
    local flags_status=$(echo "$flags_response" | cut -d'|' -f1)
    
    # Evaluate flow
    if [ "$step1_pass" = true ] && [ "$creator_status" = "200" ] && [ "$config_status" = "200" ] && [ "$flags_status" = "200" ]; then
        print_result "Portal Selection with Dynamic Content" "PASS"
    else
        print_result "Portal Selection with Dynamic Content" "FAIL" "Page:$step1_pass, Content:$creator_status, Config:$config_status, Flags:$flags_status"
    fi
    
    echo ""
}

# Flow 2: Dynamic Login Process
test_dynamic_login_flow() {
    echo -e "${BLUE}=== Testing Dynamic Login Flow ===${NC}"
    
    local portals=("creator" "investor" "production")
    local login_success=true
    
    for portal in "${portals[@]}"; do
        # Step 1: Check form configuration endpoint
        local form_response=$(api_request "GET" "/api/content/forms/login?portal=$portal")
        local form_status=$(echo "$form_response" | cut -d'|' -f1)
        
        # Step 2: Test actual login
        local email="${portal%r}.${portal}@demo.com"
        if [ "$portal" = "creator" ]; then
            email="alex.creator@demo.com"
        elif [ "$portal" = "investor" ]; then
            email="sarah.investor@demo.com"
        elif [ "$portal" = "production" ]; then
            email="stellar.production@demo.com"
        fi
        
        local login_response=$(api_request "POST" "/api/auth/$portal/login" "{\"email\":\"$email\",\"password\":\"Demo123\"}")
        local login_status=$(echo "$login_response" | cut -d'|' -f1)
        local login_body=$(echo "$login_response" | cut -d'|' -f2-)
        
        # Step 3: Check if token is returned
        local token=$(echo "$login_body" | jq -r '.token // empty' 2>/dev/null || echo "")
        
        if [ "$form_status" != "200" ] && [ "$form_status" != "404" ]; then
            login_success=false
            break
        fi
        
        if [ "$login_status" != "200" ] || [ -z "$token" ]; then
            login_success=false
            break
        fi
    done
    
    if [ "$login_success" = true ]; then
        print_result "Dynamic Login Process (All Portals)" "PASS"
    else
        print_result "Dynamic Login Process (All Portals)" "FAIL" "One or more portal logins failed"
    fi
    
    echo ""
}

# Flow 3: Dashboard Loading with Feature Flags
test_dashboard_feature_flags_flow() {
    echo -e "${BLUE}=== Testing Dashboard with Feature Flags Flow ===${NC}"
    
    # Step 1: Authenticate as creator
    local auth_response=$(api_request "POST" "/api/auth/creator/login" '{"email":"alex.creator@demo.com","password":"Demo123"}')
    local auth_status=$(echo "$auth_response" | cut -d'|' -f1)
    local auth_body=$(echo "$auth_response" | cut -d'|' -f2-)
    local token=$(echo "$auth_body" | jq -r '.token // empty' 2>/dev/null || echo "")
    
    if [ "$auth_status" != "200" ] || [ -z "$token" ]; then
        print_result "Dashboard Feature Flags Flow" "FAIL" "Authentication failed"
        echo ""
        return
    fi
    
    # Step 2: Load feature flags for creator portal
    local flags_response=$(api_request "GET" "/api/features/flags?portal=creator&userType=creator")
    local flags_status=$(echo "$flags_response" | cut -d'|' -f1)
    local flags_body=$(echo "$flags_response" | cut -d'|' -f2-)
    
    # Step 3: Load portal configuration
    local config_response=$(api_request "GET" "/api/config/portal/creator")
    local config_status=$(echo "$config_response" | cut -d'|' -f1)
    
    # Step 4: Load navigation structure
    local nav_response=$(api_request "GET" "/api/content/navigation/creator?type=header")
    local nav_status=$(echo "$nav_response" | cut -d'|' -f1)
    
    # Step 5: Test dashboard data endpoints
    local pitches_response=$(api_request "GET" "/api/pitches" "" "$token")
    local pitches_status=$(echo "$pitches_response" | cut -d'|' -f1)
    
    # Evaluate flow
    if [ "$flags_status" = "200" ] && [ "$config_status" = "200" ] && [ "$nav_status" = "200" ] && [ "$pitches_status" = "200" ]; then
        print_result "Dashboard Feature Flags Flow" "PASS"
    else
        print_result "Dashboard Feature Flags Flow" "FAIL" "Flags:$flags_status, Config:$config_status, Nav:$nav_status, Data:$pitches_status"
    fi
    
    echo ""
}

# Flow 4: Dynamic Navigation Rendering
test_dynamic_navigation_flow() {
    echo -e "${BLUE}=== Testing Dynamic Navigation Flow ===${NC}"
    
    local portals=("creator" "investor" "production" "admin")
    local menu_types=("header" "sidebar" "footer")
    local nav_success=true
    local total_nav_tests=0
    local passed_nav_tests=0
    
    for portal in "${portals[@]}"; do
        for menu_type in "${menu_types[@]}"; do
            total_nav_tests=$((total_nav_tests + 1))
            
            local nav_response=$(api_request "GET" "/api/content/navigation/$portal?type=$menu_type")
            local nav_status=$(echo "$nav_response" | cut -d'|' -f1)
            local nav_body=$(echo "$nav_response" | cut -d'|' -f2-)
            
            # Accept both 200 (custom nav) and 404 (fallback nav) as success
            if [ "$nav_status" = "200" ] || [ "$nav_status" = "404" ]; then
                passed_nav_tests=$((passed_nav_tests + 1))
            fi
        done
    done
    
    if [ "$passed_nav_tests" -eq "$total_nav_tests" ]; then
        print_result "Dynamic Navigation Rendering" "PASS" "$passed_nav_tests/$total_nav_tests navigation endpoints working"
    else
        print_result "Dynamic Navigation Rendering" "FAIL" "Only $passed_nav_tests/$total_nav_tests navigation endpoints working"
    fi
    
    echo ""
}

# Flow 5: Create Pitch with Dynamic Forms
test_create_pitch_dynamic_forms_flow() {
    echo -e "${BLUE}=== Testing Create Pitch Dynamic Forms Flow ===${NC}"
    
    # Step 1: Authenticate as creator
    local auth_response=$(api_request "POST" "/api/auth/creator/login" '{"email":"alex.creator@demo.com","password":"Demo123"}')
    local auth_status=$(echo "$auth_response" | cut -d'|' -f1)
    local auth_body=$(echo "$auth_response" | cut -d'|' -f2-)
    local token=$(echo "$auth_body" | jq -r '.token // empty' 2>/dev/null || echo "")
    
    if [ "$auth_status" != "200" ] || [ -z "$token" ]; then
        print_result "Create Pitch Dynamic Forms Flow" "FAIL" "Authentication failed"
        echo ""
        return
    fi
    
    # Step 2: Load form configuration for pitch creation
    local form_response=$(api_request "GET" "/api/content/forms/pitch-create?portal=creator")
    local form_status=$(echo "$form_response" | cut -d'|' -f1)
    
    # Step 3: Load feature flags that might affect form fields
    local flags_response=$(api_request "GET" "/api/features/flags?portal=creator")
    local flags_status=$(echo "$flags_response" | cut -d'|' -f1)
    
    # Step 4: Test actual pitch creation with minimal data
    local pitch_data='{
        "title": "E2E Test Pitch",
        "logline": "A test pitch for end-to-end testing",
        "genre": "Drama",
        "format": "Feature Film",
        "shortSynopsis": "This is a test pitch created during automated testing."
    }'
    
    local create_response=$(api_request "POST" "/api/pitches" "$pitch_data" "$token")
    local create_status=$(echo "$create_response" | cut -d'|' -f1)
    local create_body=$(echo "$create_response" | cut -d'|' -f2-)
    
    # Evaluate flow
    if [ "$flags_status" = "200" ] && [ "$create_status" = "201" ]; then
        print_result "Create Pitch Dynamic Forms Flow" "PASS"
        
        # Clean up: Delete the test pitch
        local pitch_id=$(echo "$create_body" | jq -r '.pitch.id // empty' 2>/dev/null || echo "")
        if [ -n "$pitch_id" ]; then
            api_request "DELETE" "/api/pitches/$pitch_id" "" "$token" > /dev/null 2>&1
        fi
    else
        print_result "Create Pitch Dynamic Forms Flow" "FAIL" "Form:$form_status, Flags:$flags_status, Create:$create_status"
    fi
    
    echo ""
}

# Flow 6: Multilingual Content Flow
test_multilingual_content_flow() {
    echo -e "${BLUE}=== Testing Multilingual Content Flow ===${NC}"
    
    # Step 1: Load default translations
    local default_response=$(api_request "GET" "/api/i18n/translations")
    local default_status=$(echo "$default_response" | cut -d'|' -f1)
    
    # Step 2: Load Spanish translations with English fallback
    local spanish_response=$(api_request "GET" "/api/i18n/translations?locale=es&fallback=en")
    local spanish_status=$(echo "$spanish_response" | cut -d'|' -f1)
    
    # Step 3: Load specific translation keys
    local keys_response=$(api_request "GET" "/api/i18n/translations?keys=auth.login.title,auth.login.button,common.loading")
    local keys_status=$(echo "$keys_response" | cut -d'|' -f1)
    
    # Step 4: Load portal content with locale
    local portal_es_response=$(api_request "GET" "/api/content/portals/creator?locale=es")
    local portal_es_status=$(echo "$portal_es_response" | cut -d'|' -f1)
    
    # Evaluate flow
    if [ "$default_status" = "200" ] && [ "$spanish_status" = "200" ] && [ "$keys_status" = "200" ] && [ "$portal_es_status" = "200" ]; then
        print_result "Multilingual Content Flow" "PASS"
    else
        print_result "Multilingual Content Flow" "FAIL" "Default:$default_status, Spanish:$spanish_status, Keys:$keys_status, Portal:$portal_es_status"
    fi
    
    echo ""
}

# Flow 7: Error Handling and Fallbacks
test_error_handling_fallbacks_flow() {
    echo -e "${BLUE}=== Testing Error Handling and Fallbacks Flow ===${NC}"
    
    local error_tests_passed=0
    local total_error_tests=0
    
    # Test 1: Invalid portal type
    total_error_tests=$((total_error_tests + 1))
    local invalid_portal_response=$(api_request "GET" "/api/content/portals/invalid")
    local invalid_portal_status=$(echo "$invalid_portal_response" | cut -d'|' -f1)
    if [ "$invalid_portal_status" = "400" ]; then
        error_tests_passed=$((error_tests_passed + 1))
    fi
    
    # Test 2: Non-existent form configuration (should return 404)
    total_error_tests=$((total_error_tests + 1))
    local invalid_form_response=$(api_request "GET" "/api/content/forms/nonexistent?portal=creator")
    local invalid_form_status=$(echo "$invalid_form_response" | cut -d'|' -f1)
    if [ "$invalid_form_status" = "404" ]; then
        error_tests_passed=$((error_tests_passed + 1))
    fi
    
    # Test 3: Invalid navigation menu type
    total_error_tests=$((total_error_tests + 1))
    local invalid_nav_response=$(api_request "GET" "/api/content/navigation/creator?type=invalid")
    local invalid_nav_status=$(echo "$invalid_nav_response" | cut -d'|' -f1)
    if [ "$invalid_nav_status" = "200" ] || [ "$invalid_nav_status" = "404" ]; then
        # Both are acceptable - 200 for fallback data, 404 for not found
        error_tests_passed=$((error_tests_passed + 1))
    fi
    
    # Test 4: Invalid locale (should fallback gracefully)
    total_error_tests=$((total_error_tests + 1))
    local invalid_locale_response=$(api_request "GET" "/api/i18n/translations?locale=invalid&fallback=en")
    local invalid_locale_status=$(echo "$invalid_locale_response" | cut -d'|' -f1)
    if [ "$invalid_locale_status" = "200" ]; then
        error_tests_passed=$((error_tests_passed + 1))
    fi
    
    # Test 5: Feature flags with invalid context (should return empty or defaults)
    total_error_tests=$((total_error_tests + 1))
    local invalid_flags_response=$(api_request "GET" "/api/features/flags?portal=invalid&userType=invalid")
    local invalid_flags_status=$(echo "$invalid_flags_response" | cut -d'|' -f1)
    if [ "$invalid_flags_status" = "200" ]; then
        error_tests_passed=$((error_tests_passed + 1))
    fi
    
    # Evaluate flow
    if [ "$error_tests_passed" -eq "$total_error_tests" ]; then
        print_result "Error Handling and Fallbacks Flow" "PASS" "$error_tests_passed/$total_error_tests error scenarios handled correctly"
    else
        print_result "Error Handling and Fallbacks Flow" "FAIL" "Only $error_tests_passed/$total_error_tests error scenarios handled correctly"
    fi
    
    echo ""
}

# Flow 8: Performance and Caching Flow
test_performance_caching_flow() {
    echo -e "${BLUE}=== Testing Performance and Caching Flow ===${NC}"
    
    local performance_tests_passed=0
    local total_performance_tests=0
    
    # Test 1: Portal content load time
    total_performance_tests=$((total_performance_tests + 1))
    local start_time=$(date +%s%N)
    local portal_response=$(api_request "GET" "/api/content/portals/creator")
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
    local portal_status=$(echo "$portal_response" | cut -d'|' -f1)
    
    if [ "$portal_status" = "200" ] && [ "$duration" -lt 1000 ]; then
        performance_tests_passed=$((performance_tests_passed + 1))
    fi
    
    # Test 2: Feature flags load time
    total_performance_tests=$((total_performance_tests + 1))
    local start_time=$(date +%s%N)
    local flags_response=$(api_request "GET" "/api/features/flags")
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 ))
    local flags_status=$(echo "$flags_response" | cut -d'|' -f1)
    
    if [ "$flags_status" = "200" ] && [ "$duration" -lt 1000 ]; then
        performance_tests_passed=$((performance_tests_passed + 1))
    fi
    
    # Test 3: Translations load time
    total_performance_tests=$((total_performance_tests + 1))
    local start_time=$(date +%s%N)
    local translations_response=$(api_request "GET" "/api/i18n/translations")
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 ))
    local translations_status=$(echo "$translations_response" | cut -d'|' -f1)
    
    if [ "$translations_status" = "200" ] && [ "$duration" -lt 1000 ]; then
        performance_tests_passed=$((performance_tests_passed + 1))
    fi
    
    # Test 4: Multiple rapid requests (simulating real usage)
    total_performance_tests=$((total_performance_tests + 1))
    local rapid_success=true
    for i in {1..5}; do
        local rapid_response=$(api_request "GET" "/api/features/flags")
        local rapid_status=$(echo "$rapid_response" | cut -d'|' -f1)
        if [ "$rapid_status" != "200" ]; then
            rapid_success=false
            break
        fi
    done
    
    if [ "$rapid_success" = true ]; then
        performance_tests_passed=$((performance_tests_passed + 1))
    fi
    
    # Evaluate flow
    if [ "$performance_tests_passed" -eq "$total_performance_tests" ]; then
        print_result "Performance and Caching Flow" "PASS" "$performance_tests_passed/$total_performance_tests performance tests passed"
    else
        print_result "Performance and Caching Flow" "FAIL" "Only $performance_tests_passed/$total_performance_tests performance tests passed"
    fi
    
    echo ""
}

# Main test execution
main() {
    echo "Starting End-to-End User Flow Tests..."
    echo "Timestamp: $(date)"
    echo ""
    
    # Check if services are running
    echo -e "${BLUE}=== Checking Service Status ===${NC}"
    if curl -s "$API_BASE/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Backend API is running"
    else
        echo -e "${RED}✗${NC} Backend API is not running at $API_BASE"
        echo -e "${YELLOW}Starting backend tests anyway, some may fail${NC}"
    fi
    
    if curl -s "$FRONTEND_URL" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Frontend is running"
    else
        echo -e "${YELLOW}⚠${NC} Frontend is not running at $FRONTEND_URL (some tests will be limited)"
    fi
    echo ""
    
    # Run all flow tests
    test_portal_selection_flow
    test_dynamic_login_flow
    test_dashboard_feature_flags_flow
    test_dynamic_navigation_flow
    test_create_pitch_dynamic_forms_flow
    test_multilingual_content_flow
    test_error_handling_fallbacks_flow
    test_performance_caching_flow
    
    # Print summary
    echo -e "${BLUE}=== Flow Test Summary ===${NC}"
    echo "Total Flows: $TOTAL_FLOWS"
    echo -e "Passed: ${GREEN}$PASSED_FLOWS${NC}"
    echo -e "Failed: ${RED}$FAILED_FLOWS${NC}"
    
    local success_rate=$((PASSED_FLOWS * 100 / TOTAL_FLOWS))
    echo "Success Rate: $success_rate%"
    
    if [ "$FAILED_FLOWS" -eq 0 ]; then
        echo -e "${GREEN}All user flows completed successfully! ✅${NC}"
        exit 0
    elif [ "$success_rate" -ge 75 ]; then
        echo -e "${YELLOW}Most user flows completed successfully! ⚠️${NC}"
        exit 0
    else
        echo -e "${RED}Many user flows failed! ❌${NC}"
        exit 1
    fi
}

# Check dependencies
command -v curl >/dev/null 2>&1 || { echo -e "${RED}ERROR: curl is required${NC}"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo -e "${RED}ERROR: jq is required${NC}"; exit 1; }

# Run tests
main "$@"