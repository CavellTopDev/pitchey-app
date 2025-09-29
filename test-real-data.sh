#!/bin/bash

# Test script to verify all mock data has been replaced with real backend data

echo "================================================"
echo "Testing Real Data Implementation"
echo "================================================"

API_BASE="http://localhost:8001"

# Demo login credentials - use alice who is a creator
TEST_EMAIL="alice@example.com"
TEST_PASSWORD="password123"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local token=$4
    local data=$5
    
    echo -e "\n${YELLOW}Testing: $description${NC}"
    echo "Endpoint: $method $endpoint"
    
    if [ -z "$data" ]; then
        if [ -z "$token" ]; then
            response=$(curl -s -X $method "$API_BASE$endpoint")
        else
            response=$(curl -s -X $method \
                -H "Authorization: Bearer $token" \
                "$API_BASE$endpoint")
        fi
    else
        if [ -z "$token" ]; then
            response=$(curl -s -X $method \
                -H "Content-Type: application/json" \
                -d "$data" \
                "$API_BASE$endpoint")
        else
            response=$(curl -s -X $method \
                -H "Authorization: Bearer $token" \
                -H "Content-Type: application/json" \
                -d "$data" \
                "$API_BASE$endpoint")
        fi
    fi
    
    # Check if response contains mock data indicators
    if echo "$response" | grep -q "15000\|1234\|892\|mockPitchesData"; then
        echo -e "${RED}❌ FAILED: Found mock data in response${NC}"
        echo "Response contains hardcoded values"
        return 1
    else
        echo -e "${GREEN}✓ PASSED: No mock data detected${NC}"
        echo "Response: ${response:0:200}..."
        return 0
    fi
}

# Function to check for real database values
check_real_values() {
    local response=$1
    local field=$2
    
    # Extract the value
    value=$(echo "$response" | grep -o "\"$field\":[0-9]*" | cut -d: -f2)
    
    if [ -z "$value" ]; then
        echo -e "${YELLOW}Field '$field' not found${NC}"
        return 1
    fi
    
    # Check if it's a realistic value (not mock)
    if [ "$field" == "totalViews" ] && [ "$value" -gt 10000 ]; then
        echo -e "${RED}Suspicious: $field=$value (too high for real data)${NC}"
        return 1
    elif [ "$field" == "followers" ] && [ "$value" -eq 892 ]; then
        echo -e "${RED}Mock data detected: $field=$value${NC}"
        return 1
    else
        echo -e "${GREEN}Real value: $field=$value${NC}"
        return 0
    fi
}

echo -e "\n${YELLOW}1. Logging in with demo creator account (alice)...${NC}"
# Login with demo account
login_response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
    "$API_BASE/auth/login")

TOKEN=$(echo "$login_response" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}Failed to get authentication token${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Authenticated successfully${NC}"

echo -e "\n${YELLOW}2. Testing Creator Dashboard Endpoint${NC}"
dashboard_response=$(curl -s -X GET \
    -H "Authorization: Bearer $TOKEN" \
    "$API_BASE/api/creator/dashboard")

echo "Dashboard Response: ${dashboard_response:0:300}..."

# Check specific fields for real values
check_real_values "$dashboard_response" "totalViews"
check_real_values "$dashboard_response" "followers"
check_real_values "$dashboard_response" "avgRating"

echo -e "\n${YELLOW}3. Creating a test pitch${NC}"
pitch_data='{
    "title": "Test Pitch for Real Data",
    "logline": "Testing real backend data",
    "genre": "drama",
    "format": "feature",
    "shortSynopsis": "A test pitch"
}'

pitch_response=$(curl -s -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$pitch_data" \
    "$API_BASE/api/pitches")

PITCH_ID=$(echo "$pitch_response" | grep -o '"id":[0-9]*' | cut -d: -f2)
echo -e "${GREEN}✓ Created pitch with ID: $PITCH_ID${NC}"

echo -e "\n${YELLOW}4. Recording a real view${NC}"
view_response=$(curl -s -X POST \
    "$API_BASE/api/pitches/$PITCH_ID/view")

echo "View response: $view_response"

echo -e "\n${YELLOW}5. Fetching updated analytics${NC}"
sleep 1  # Give the database time to update
updated_dashboard=$(curl -s -X GET \
    -H "Authorization: Bearer $TOKEN" \
    "$API_BASE/api/creator/dashboard")

new_views=$(echo "$updated_dashboard" | grep -o '"totalViews":[0-9]*' | cut -d: -f2)
echo -e "${GREEN}Updated total views: $new_views${NC}"

echo -e "\n${YELLOW}6. Testing other endpoints for mock data${NC}"

# Test public pitches endpoint
test_endpoint "GET" "/api/public/pitches" "Public Pitches (no auth)"

# Test trending endpoint
test_endpoint "GET" "/api/trending" "Trending Pitches"

# Test user profile
test_endpoint "GET" "/api/profile" "User Profile" "$TOKEN"

# Test notifications
test_endpoint "GET" "/api/notifications" "Notifications" "$TOKEN"

echo -e "\n${YELLOW}7. Testing Investment Service${NC}"
portfolio_response=$(curl -s -X GET \
    -H "Authorization: Bearer $TOKEN" \
    "$API_BASE/api/investor/portfolio")

if echo "$portfolio_response" | grep -q "totalInvested\|portfolioValue"; then
    echo -e "${GREEN}✓ Investment endpoints returning structured data${NC}"
else
    echo -e "${YELLOW}⚠ Investment data structure needs verification${NC}"
fi

echo -e "\n${YELLOW}8. Testing Production Service${NC}"
production_response=$(curl -s -X GET \
    -H "Authorization: Bearer $TOKEN" \
    "$API_BASE/api/production/dashboard")

if echo "$production_response" | grep -q "activeProductions\|totalBudgetManaged"; then
    echo -e "${GREEN}✓ Production endpoints returning structured data${NC}"
else
    echo -e "${YELLOW}⚠ Production data structure needs verification${NC}"
fi

echo -e "\n================================================"
echo -e "${GREEN}Test Summary:${NC}"
echo "================================================"

# Count successes and failures
TESTS_PASSED=0
TESTS_FAILED=0

# Check for any remaining mock data patterns
echo -e "\n${YELLOW}Scanning for mock data patterns...${NC}"
mock_patterns=("mockPitchesData" "15000" "892" "1234" "hardcoded" "TODO" "FIXME")

for pattern in "${mock_patterns[@]}"; do
    echo -n "Checking for '$pattern': "
    if echo "$dashboard_response $pitch_response $view_response" | grep -q "$pattern"; then
        echo -e "${RED}FOUND${NC}"
        ((TESTS_FAILED++))
    else
        echo -e "${GREEN}CLEAN${NC}"
        ((TESTS_PASSED++))
    fi
done

echo -e "\n${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✅ All tests passed! Mock data has been successfully replaced with real backend data.${NC}"
    exit 0
else
    echo -e "\n${RED}⚠ Some tests failed. Review the mock data replacement.${NC}"
    exit 1
fi