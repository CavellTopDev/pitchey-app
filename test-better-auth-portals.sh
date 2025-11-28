#!/bin/bash

# Test script for Better Auth portal authentication
# Tests all three portals with correct user types and validates responses

API_URL="${API_URL:-http://localhost:8001}"
echo "🔧 Testing Better Auth Portal Authentication at $API_URL"
echo "================================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_portal() {
    local portal=$1
    local email=$2
    local password=$3
    local expected_type=$4
    
    echo -e "\n${YELLOW}Testing $portal Portal:${NC}"
    echo "Email: $email"
    
    response=$(curl -s -X POST "$API_URL/api/auth/$portal/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}")
    
    # Check if response contains token
    if echo "$response" | grep -q "token"; then
        # Extract user type from response
        user_type=$(echo "$response" | grep -o '"userType":"[^"]*"' | cut -d'"' -f4)
        
        if [ "$user_type" = "$expected_type" ]; then
            echo -e "${GREEN}✅ SUCCESS: Correct user type ($user_type)${NC}"
            
            # Extract token for further testing
            token=$(echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
            echo "Token (first 20 chars): ${token:0:20}..."
            
            # Test protected endpoint with token
            test_protected_endpoint "$portal" "$token"
        else
            echo -e "${RED}❌ FAIL: Wrong user type. Expected: $expected_type, Got: $user_type${NC}"
        fi
    else
        echo -e "${RED}❌ FAIL: No token in response${NC}"
        echo "Response: $response"
    fi
}

# Test protected endpoints
test_protected_endpoint() {
    local portal=$1
    local token=$2
    
    echo "Testing protected endpoints..."
    
    # Test analytics endpoint
    analytics_response=$(curl -s -X GET "$API_URL/api/analytics/dashboard" \
        -H "Authorization: Bearer $token")
    
    if echo "$analytics_response" | grep -q "success"; then
        echo -e "${GREEN}  ✅ Analytics endpoint accessible${NC}"
    else
        echo -e "${RED}  ❌ Analytics endpoint failed${NC}"
    fi
    
    # Test NDA endpoint
    nda_response=$(curl -s -X GET "$API_URL/api/nda/requests" \
        -H "Authorization: Bearer $token")
    
    if echo "$nda_response" | grep -q "success"; then
        echo -e "${GREEN}  ✅ NDA endpoint accessible${NC}"
    else
        echo -e "${RED}  ❌ NDA endpoint failed${NC}"
    fi
}

# Test invalid credentials
test_invalid_login() {
    local portal=$1
    
    echo -e "\n${YELLOW}Testing invalid login for $portal:${NC}"
    
    response=$(curl -s -X POST "$API_URL/api/auth/$portal/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"invalid@test.com","password":"wrongpass"}')
    
    if echo "$response" | grep -q "success.*false"; then
        echo -e "${GREEN}✅ Correctly rejected invalid credentials${NC}"
    else
        echo -e "${RED}❌ Should have rejected invalid credentials${NC}"
    fi
}

# Test cross-portal access (should be denied)
test_cross_portal_access() {
    echo -e "\n${YELLOW}Testing cross-portal access prevention:${NC}"
    
    # Try to login creator account through investor portal
    response=$(curl -s -X POST "$API_URL/api/auth/investor/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"alex.creator@demo.com","password":"Demo123"}')
    
    if echo "$response" | grep -q "Access denied"; then
        echo -e "${GREEN}✅ Correctly denied cross-portal access${NC}"
    else
        echo -e "${RED}❌ Should have denied cross-portal access${NC}"
        echo "Response: $response"
    fi
}

# Main test execution
echo -e "\n${YELLOW}=== TESTING DEMO ACCOUNTS ===${NC}"

# Test Creator Portal
test_portal "creator" "alex.creator@demo.com" "Demo123" "creator"

# Test Investor Portal
test_portal "investor" "sarah.investor@demo.com" "Demo123" "investor"

# Test Production Portal
test_portal "production" "stellar.production@demo.com" "Demo123" "production"

# Test invalid logins
echo -e "\n${YELLOW}=== TESTING INVALID CREDENTIALS ===${NC}"
test_invalid_login "creator"
test_invalid_login "investor"
test_invalid_login "production"

# Test cross-portal access
test_cross_portal_access

echo -e "\n${YELLOW}=== TEST SUMMARY ===${NC}"
echo "All tests completed. Check results above for any failures."
echo "If all tests pass, Better Auth integration is working correctly!"