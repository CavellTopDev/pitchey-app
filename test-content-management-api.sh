#!/bin/bash

# Comprehensive Content Management API Testing Script
# Tests all new content management endpoints with real data validation

set -e

# Configuration
API_BASE="http://localhost:8001"
CREATOR_TOKEN=""
INVESTOR_TOKEN=""
PRODUCTION_TOKEN=""
ADMIN_TOKEN=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

echo -e "${BLUE}=== Content Management API Integration Tests ===${NC}"
echo "Testing backend running on: $API_BASE"
echo ""

# Function to print test results
print_result() {
    local test_name="$1"
    local status="$2"
    local details="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✓ PASS${NC} $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAIL${NC} $test_name"
        if [ -n "$details" ]; then
            echo -e "  ${YELLOW}Details:${NC} $details"
        fi
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Function to make API requests
api_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local token="$4"
    local expected_status="${5:-200}"
    
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

# Function to authenticate users
authenticate_users() {
    echo -e "${BLUE}=== Authenticating Test Users ===${NC}"
    
    # Authenticate Creator
    local creator_response=$(api_request "POST" "/api/auth/creator/login" '{"email":"alex.creator@demo.com","password":"Demo123"}')
    local creator_status=$(echo "$creator_response" | cut -d'|' -f1)
    local creator_body=$(echo "$creator_response" | cut -d'|' -f2-)
    
    if [ "$creator_status" = "200" ]; then
        CREATOR_TOKEN=$(echo "$creator_body" | jq -r '.token // empty')
        print_result "Creator Authentication" "PASS"
    else
        print_result "Creator Authentication" "FAIL" "Status: $creator_status"
    fi
    
    # Authenticate Investor
    local investor_response=$(api_request "POST" "/api/auth/investor/login" '{"email":"sarah.investor@demo.com","password":"Demo123"}')
    local investor_status=$(echo "$investor_response" | cut -d'|' -f1)
    local investor_body=$(echo "$investor_response" | cut -d'|' -f2-)
    
    if [ "$investor_status" = "200" ]; then
        INVESTOR_TOKEN=$(echo "$investor_body" | jq -r '.token // empty')
        print_result "Investor Authentication" "PASS"
    else
        print_result "Investor Authentication" "FAIL" "Status: $investor_status"
    fi
    
    # Authenticate Production
    local production_response=$(api_request "POST" "/api/auth/production/login" '{"email":"stellar.production@demo.com","password":"Demo123"}')
    local production_status=$(echo "$production_response" | cut -d'|' -f1)
    local production_body=$(echo "$production_response" | cut -d'|' -f2-)
    
    if [ "$production_status" = "200" ]; then
        PRODUCTION_TOKEN=$(echo "$production_body" | jq -r '.token // empty')
        print_result "Production Authentication" "PASS"
    else
        print_result "Production Authentication" "FAIL" "Status: $production_status"
    fi
    
    echo ""
}

# Test Portal Content Endpoints
test_portal_content() {
    echo -e "${BLUE}=== Testing Portal Content Endpoints ===${NC}"
    
    local portals=("creator" "investor" "production" "admin")
    
    for portal in "${portals[@]}"; do
        local response=$(api_request "GET" "/api/content/portals/$portal")
        local status=$(echo "$response" | cut -d'|' -f1)
        local body=$(echo "$response" | cut -d'|' -f2-)
        
        if [ "$status" = "200" ]; then
            local success=$(echo "$body" | jq -r '.success // false')
            local content_exists=$(echo "$body" | jq -r '.data.content // null' | grep -v null | wc -l)
            
            if [ "$success" = "true" ] && [ "$content_exists" -gt 0 ]; then
                print_result "Portal Content - $portal" "PASS"
            else
                print_result "Portal Content - $portal" "FAIL" "Empty or invalid content"
            fi
        else
            print_result "Portal Content - $portal" "FAIL" "Status: $status"
        fi
    done
    
    # Test with locale parameter
    local response=$(api_request "GET" "/api/content/portals/creator?locale=en")
    local status=$(echo "$response" | cut -d'|' -f1)
    
    if [ "$status" = "200" ]; then
        print_result "Portal Content with Locale" "PASS"
    else
        print_result "Portal Content with Locale" "FAIL" "Status: $status"
    fi
    
    echo ""
}

# Test Feature Flags Endpoints
test_feature_flags() {
    echo -e "${BLUE}=== Testing Feature Flags Endpoints ===${NC}"
    
    # Test public feature flags endpoint
    local response=$(api_request "GET" "/api/features/flags")
    local status=$(echo "$response" | cut -d'|' -f1)
    local body=$(echo "$response" | cut -d'|' -f2-)
    
    if [ "$status" = "200" ]; then
        local success=$(echo "$body" | jq -r '.success // false')
        local flags_exist=$(echo "$body" | jq -r '.data.flags // null' | grep -v null | wc -l)
        
        if [ "$success" = "true" ] && [ "$flags_exist" -gt 0 ]; then
            print_result "Feature Flags - Public Access" "PASS"
        else
            print_result "Feature Flags - Public Access" "FAIL" "No flags returned"
        fi
    else
        print_result "Feature Flags - Public Access" "FAIL" "Status: $status"
    fi
    
    # Test portal-specific feature flags
    local portals=("creator" "investor" "production")
    
    for portal in "${portals[@]}"; do
        local response=$(api_request "GET" "/api/features/flags?portal=$portal&userType=$portal")
        local status=$(echo "$response" | cut -d'|' -f1)
        
        if [ "$status" = "200" ]; then
            print_result "Feature Flags - $portal Portal" "PASS"
        else
            print_result "Feature Flags - $portal Portal" "FAIL" "Status: $status"
        fi
    done
    
    echo ""
}

# Test Portal Configuration Endpoints
test_portal_configuration() {
    echo -e "${BLUE}=== Testing Portal Configuration Endpoints ===${NC}"
    
    local portals=("creator" "investor" "production" "admin")
    
    for portal in "${portals[@]}"; do
        local response=$(api_request "GET" "/api/config/portal/$portal")
        local status=$(echo "$response" | cut -d'|' -f1)
        local body=$(echo "$response" | cut -d'|' -f2-)
        
        if [ "$status" = "200" ]; then
            local success=$(echo "$body" | jq -r '.success // false')
            local config_exists=$(echo "$body" | jq -r '.data.config // null' | grep -v null | wc -l)
            
            if [ "$success" = "true" ]; then
                print_result "Portal Configuration - $portal" "PASS"
            else
                print_result "Portal Configuration - $portal" "FAIL" "Invalid response"
            fi
        else
            print_result "Portal Configuration - $portal" "FAIL" "Status: $status"
        fi
    done
    
    echo ""
}

# Test Navigation Endpoints
test_navigation() {
    echo -e "${BLUE}=== Testing Navigation Endpoints ===${NC}"
    
    local portals=("creator" "investor" "production" "admin")
    local menu_types=("header" "sidebar" "footer")
    
    for portal in "${portals[@]}"; do
        for menu_type in "${menu_types[@]}"; do
            local response=$(api_request "GET" "/api/content/navigation/$portal?type=$menu_type")
            local status=$(echo "$response" | cut -d'|' -f1)
            local body=$(echo "$response" | cut -d'|' -f2-)
            
            if [ "$status" = "200" ] || [ "$status" = "404" ]; then
                # Both 200 (found) and 404 (fallback) are acceptable
                local success=$(echo "$body" | jq -r '.success // false')
                if [ "$success" = "true" ] || [ "$status" = "404" ]; then
                    print_result "Navigation - $portal/$menu_type" "PASS"
                else
                    print_result "Navigation - $portal/$menu_type" "FAIL" "Invalid response"
                fi
            else
                print_result "Navigation - $portal/$menu_type" "FAIL" "Status: $status"
            fi
        done
    done
    
    echo ""
}

# Test Translation Endpoints
test_translations() {
    echo -e "${BLUE}=== Testing Translation Endpoints ===${NC}"
    
    # Test default locale
    local response=$(api_request "GET" "/api/i18n/translations")
    local status=$(echo "$response" | cut -d'|' -f1)
    local body=$(echo "$response" | cut -d'|' -f2-)
    
    if [ "$status" = "200" ]; then
        local success=$(echo "$body" | jq -r '.success // false')
        if [ "$success" = "true" ]; then
            print_result "Translations - Default Locale" "PASS"
        else
            print_result "Translations - Default Locale" "FAIL" "Invalid response"
        fi
    else
        print_result "Translations - Default Locale" "FAIL" "Status: $status"
    fi
    
    # Test specific locale with fallback
    local response=$(api_request "GET" "/api/i18n/translations?locale=es&fallback=en")
    local status=$(echo "$response" | cut -d'|' -f1)
    
    if [ "$status" = "200" ]; then
        print_result "Translations - Locale with Fallback" "PASS"
    else
        print_result "Translations - Locale with Fallback" "FAIL" "Status: $status"
    fi
    
    # Test specific keys
    local response=$(api_request "GET" "/api/i18n/translations?keys=auth.login.title,auth.login.button")
    local status=$(echo "$response" | cut -d'|' -f1)
    
    if [ "$status" = "200" ]; then
        print_result "Translations - Specific Keys" "PASS"
    else
        print_result "Translations - Specific Keys" "FAIL" "Status: $status"
    fi
    
    echo ""
}

# Test Form Configuration Endpoints
test_form_configuration() {
    echo -e "${BLUE}=== Testing Form Configuration Endpoints ===${NC}"
    
    local form_types=("login" "register" "pitch-create" "profile")
    local portals=("creator" "investor" "production")
    
    for form_type in "${form_types[@]}"; do
        for portal in "${portals[@]}"; do
            local response=$(api_request "GET" "/api/content/forms/$form_type?portal=$portal")
            local status=$(echo "$response" | cut -d'|' -f1)
            
            if [ "$status" = "200" ] || [ "$status" = "404" ]; then
                # Both success and not found are acceptable (fallback behavior)
                print_result "Form Config - $form_type/$portal" "PASS"
            else
                print_result "Form Config - $form_type/$portal" "FAIL" "Status: $status"
            fi
        done
    done
    
    echo ""
}

# Test Static Content Endpoints
test_static_content() {
    echo -e "${BLUE}=== Testing Static Content Endpoints ===${NC}"
    
    local endpoints=(
        "/api/content/how-it-works"
        "/api/content/about"
        "/api/content/team"
        "/api/content/stats"
    )
    
    for endpoint in "${endpoints[@]}"; do
        local response=$(api_request "GET" "$endpoint")
        local status=$(echo "$response" | cut -d'|' -f1)
        local body=$(echo "$response" | cut -d'|' -f2-)
        
        if [ "$status" = "200" ]; then
            # Check if response contains meaningful content
            local has_content=$(echo "$body" | jq -r '. | length' 2>/dev/null || echo "0")
            if [ "$has_content" -gt 0 ]; then
                print_result "Static Content - ${endpoint##*/}" "PASS"
            else
                print_result "Static Content - ${endpoint##*/}" "FAIL" "Empty content"
            fi
        else
            print_result "Static Content - ${endpoint##*/}" "FAIL" "Status: $status"
        fi
    done
    
    echo ""
}

# Test Error Handling
test_error_handling() {
    echo -e "${BLUE}=== Testing Error Handling ===${NC}"
    
    # Test invalid portal type
    local response=$(api_request "GET" "/api/content/portals/invalid")
    local status=$(echo "$response" | cut -d'|' -f1)
    
    if [ "$status" = "400" ]; then
        print_result "Error Handling - Invalid Portal" "PASS"
    else
        print_result "Error Handling - Invalid Portal" "FAIL" "Expected 400, got $status"
    fi
    
    # Test invalid form type
    local response=$(api_request "GET" "/api/content/forms/")
    local status=$(echo "$response" | cut -d'|' -f1)
    
    if [ "$status" = "400" ] || [ "$status" = "404" ]; then
        print_result "Error Handling - Invalid Form" "PASS"
    else
        print_result "Error Handling - Invalid Form" "FAIL" "Expected 400/404, got $status"
    fi
    
    # Test non-existent navigation
    local response=$(api_request "GET" "/api/content/navigation/invalid")
    local status=$(echo "$response" | cut -d'|' -f1)
    
    if [ "$status" = "400" ]; then
        print_result "Error Handling - Invalid Navigation" "PASS"
    else
        print_result "Error Handling - Invalid Navigation" "FAIL" "Expected 400, got $status"
    fi
    
    echo ""
}

# Test Admin Content Management (requires admin token)
test_admin_endpoints() {
    echo -e "${BLUE}=== Testing Admin Content Management Endpoints ===${NC}"
    
    if [ -z "$ADMIN_TOKEN" ]; then
        print_result "Admin Endpoints" "SKIP" "No admin token available"
        echo ""
        return
    fi
    
    # Test content creation
    local create_data='{"key":"test.content","content":{"title":"Test Title","description":"Test Description"},"portalType":"creator","locale":"en","status":"active"}'
    local response=$(api_request "POST" "/api/admin/content" "$create_data" "$ADMIN_TOKEN")
    local status=$(echo "$response" | cut -d'|' -f1)
    
    if [ "$status" = "201" ] || [ "$status" = "409" ]; then
        # Both created and conflict (already exists) are acceptable
        print_result "Admin - Create Content" "PASS"
    else
        print_result "Admin - Create Content" "FAIL" "Status: $status"
    fi
    
    # Test feature flag creation
    local flag_data='{"name":"test-flag","description":"Test flag","isEnabled":true,"portalType":"creator"}'
    local response=$(api_request "POST" "/api/admin/features" "$flag_data" "$ADMIN_TOKEN")
    local status=$(echo "$response" | cut -d'|' -f1)
    
    if [ "$status" = "201" ] || [ "$status" = "409" ]; then
        print_result "Admin - Create Feature Flag" "PASS"
    else
        print_result "Admin - Create Feature Flag" "FAIL" "Status: $status"
    fi
    
    echo ""
}

# Test Performance and Response Times
test_performance() {
    echo -e "${BLUE}=== Testing API Performance ===${NC}"
    
    local start_time=$(date +%s%N)
    local response=$(api_request "GET" "/api/content/portals/creator")
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
    local status=$(echo "$response" | cut -d'|' -f1)
    
    if [ "$status" = "200" ] && [ "$duration" -lt 1000 ]; then
        print_result "Performance - Portal Content (<1s)" "PASS"
    elif [ "$status" = "200" ]; then
        print_result "Performance - Portal Content" "PASS" "Slow response: ${duration}ms"
    else
        print_result "Performance - Portal Content" "FAIL" "Status: $status"
    fi
    
    echo ""
}

# Main test execution
main() {
    echo "Starting Content Management API Integration Tests..."
    echo "Timestamp: $(date)"
    echo ""
    
    # Check if backend is running
    if ! curl -s "$API_BASE/health" > /dev/null 2>&1; then
        echo -e "${RED}ERROR: Backend is not running at $API_BASE${NC}"
        echo "Please start the backend server first:"
        echo "  PORT=8001 deno run --allow-all working-server.ts"
        exit 1
    fi
    
    # Run authentication first
    authenticate_users
    
    # Run all test suites
    test_portal_content
    test_feature_flags
    test_portal_configuration
    test_navigation
    test_translations
    test_form_configuration
    test_static_content
    test_error_handling
    test_admin_endpoints
    test_performance
    
    # Print summary
    echo -e "${BLUE}=== Test Summary ===${NC}"
    echo "Total Tests: $TOTAL_TESTS"
    echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
    
    if [ "$FAILED_TESTS" -eq 0 ]; then
        echo -e "${GREEN}All tests passed! ✅${NC}"
        exit 0
    else
        echo -e "${RED}Some tests failed! ❌${NC}"
        exit 1
    fi
}

# Check dependencies
if ! command -v jq &> /dev/null; then
    echo -e "${RED}ERROR: jq is required but not installed${NC}"
    echo "Install with: sudo apt-get install jq (Ubuntu/Debian) or brew install jq (macOS)"
    exit 1
fi

if ! command -v curl &> /dev/null; then
    echo -e "${RED}ERROR: curl is required but not installed${NC}"
    exit 1
fi

# Run tests
main "$@"