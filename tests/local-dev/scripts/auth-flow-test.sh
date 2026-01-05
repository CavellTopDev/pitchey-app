#!/bin/bash

# Authentication Flow Test Script
# Comprehensive testing of all three portal authentication flows

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="http://localhost:8001"
TIMEOUT=10

echo -e "${BLUE}🔐 Authentication Flow Test - Pitchey Local Development${NC}"
echo "======================================================"
echo "Backend URL: $BACKEND_URL"
echo "Timestamp: $(date)"
echo ""

# Demo user credentials
declare -A DEMO_USERS=(
    ["creator"]="alex.creator@demo.com:Demo123"
    ["investor"]="sarah.investor@demo.com:Demo123"  
    ["production"]="stellar.production@demo.com:Demo123"
)

# Function to test complete authentication flow for a user type
test_auth_flow() {
    local user_type="$1"
    local credentials="${DEMO_USERS[$user_type]}"
    local email=$(echo "$credentials" | cut -d: -f1)
    local password=$(echo "$credentials" | cut -d: -f2)
    
    echo -e "${YELLOW}Testing $user_type authentication flow...${NC}"
    echo "Email: $email"
    echo ""
    
    local cookie_file="/tmp/pitchey_${user_type}_cookies.txt"
    local success=0
    
    # Step 1: Login
    echo -n "  1. Login... "
    login_response=$(curl -s -c "$cookie_file" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}" \
        -w "HTTPSTATUS:%{http_code}" \
        "$BACKEND_URL/api/auth/sign-in" 2>/dev/null)
    
    login_status=$(echo "$login_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    
    if [ "$login_status" = "200" ]; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((success++))
    else
        echo -e "${RED}❌ FAIL${NC} (Status: $login_status)"
        rm -f "$cookie_file"
        return 1
    fi
    
    # Step 2: Session validation
    echo -n "  2. Session validation... "
    session_response=$(curl -s -b "$cookie_file" \
        -w "HTTPSTATUS:%{http_code}" \
        "$BACKEND_URL/api/auth/session" 2>/dev/null)
    
    session_status=$(echo "$session_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    
    if [ "$session_status" = "200" ]; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((success++))
        
        # Extract user info from response
        session_data=$(echo "$session_response" | sed 's/HTTPSTATUS:[0-9]*//g')
        echo "     User data: $(echo "$session_data" | head -c 100)..."
    else
        echo -e "${RED}❌ FAIL${NC} (Status: $session_status)"
    fi
    
    # Step 3: Access own dashboard
    local dashboard_endpoint
    case "$user_type" in
        "creator") dashboard_endpoint="/api/creator/dashboard" ;;
        "investor") dashboard_endpoint="/api/investor/dashboard" ;;
        "production") dashboard_endpoint="/api/production/dashboard" ;;
    esac
    
    echo -n "  3. Own dashboard access... "
    dashboard_response=$(curl -s -b "$cookie_file" \
        -w "HTTPSTATUS:%{http_code}" \
        "$BACKEND_URL$dashboard_endpoint" 2>/dev/null)
    
    dashboard_status=$(echo "$dashboard_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    
    if [ "$dashboard_status" = "200" ]; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((success++))
    else
        echo -e "${RED}❌ FAIL${NC} (Status: $dashboard_status)"
    fi
    
    # Step 4: Test access control (should NOT access other portals)
    echo -n "  4. Portal isolation test... "
    isolation_success=0
    
    case "$user_type" in
        "creator")
            # Creator should NOT access investor/production dashboards
            inv_response=$(curl -s -b "$cookie_file" -w "HTTPSTATUS:%{http_code}" "$BACKEND_URL/api/investor/dashboard" 2>/dev/null)
            prod_response=$(curl -s -b "$cookie_file" -w "HTTPSTATUS:%{http_code}" "$BACKEND_URL/api/production/dashboard" 2>/dev/null)
            
            inv_status=$(echo "$inv_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
            prod_status=$(echo "$prod_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
            
            if [ "$inv_status" != "200" ] && [ "$prod_status" != "200" ]; then
                isolation_success=1
            fi
            ;;
        "investor")
            # Investor should NOT access creator/production dashboards
            creator_response=$(curl -s -b "$cookie_file" -w "HTTPSTATUS:%{http_code}" "$BACKEND_URL/api/creator/dashboard" 2>/dev/null)
            prod_response=$(curl -s -b "$cookie_file" -w "HTTPSTATUS:%{http_code}" "$BACKEND_URL/api/production/dashboard" 2>/dev/null)
            
            creator_status=$(echo "$creator_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
            prod_status=$(echo "$prod_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
            
            if [ "$creator_status" != "200" ] && [ "$prod_status" != "200" ]; then
                isolation_success=1
            fi
            ;;
        "production")
            # Production should NOT access creator/investor dashboards
            creator_response=$(curl -s -b "$cookie_file" -w "HTTPSTATUS:%{http_code}" "$BACKEND_URL/api/creator/dashboard" 2>/dev/null)
            inv_response=$(curl -s -b "$cookie_file" -w "HTTPSTATUS:%{http_code}" "$BACKEND_URL/api/investor/dashboard" 2>/dev/null)
            
            creator_status=$(echo "$creator_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
            inv_status=$(echo "$inv_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
            
            if [ "$creator_status" != "200" ] && [ "$inv_status" != "200" ]; then
                isolation_success=1
            fi
            ;;
    esac
    
    if [ $isolation_success -eq 1 ]; then
        echo -e "${GREEN}✅ PASS${NC} (Portal isolation working)"
        ((success++))
    else
        echo -e "${RED}❌ FAIL${NC} (Portal isolation failed - SECURITY ISSUE)"
    fi
    
    # Step 5: Session persistence test
    echo -n "  5. Session persistence... "
    sleep 2  # Wait 2 seconds
    
    persist_response=$(curl -s -b "$cookie_file" \
        -w "HTTPSTATUS:%{http_code}" \
        "$BACKEND_URL/api/auth/session" 2>/dev/null)
    
    persist_status=$(echo "$persist_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    
    if [ "$persist_status" = "200" ]; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((success++))
    else
        echo -e "${RED}❌ FAIL${NC} (Status: $persist_status)"
    fi
    
    # Step 6: Logout
    echo -n "  6. Logout... "
    logout_response=$(curl -s -b "$cookie_file" \
        -X POST \
        -w "HTTPSTATUS:%{http_code}" \
        "$BACKEND_URL/api/auth/sign-out" 2>/dev/null)
    
    logout_status=$(echo "$logout_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    
    if [ "$logout_status" = "200" ]; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((success++))
    else
        echo -e "${RED}❌ FAIL${NC} (Status: $logout_status)"
    fi
    
    # Step 7: Verify logout (session should be invalid)
    echo -n "  7. Post-logout verification... "
    verify_response=$(curl -s -b "$cookie_file" \
        -w "HTTPSTATUS:%{http_code}" \
        "$BACKEND_URL/api/auth/session" 2>/dev/null)
    
    verify_status=$(echo "$verify_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    
    if [ "$verify_status" != "200" ]; then
        echo -e "${GREEN}✅ PASS${NC} (Session invalidated)"
        ((success++))
    else
        echo -e "${RED}❌ FAIL${NC} (Session still valid after logout)"
    fi
    
    # Cleanup
    rm -f "$cookie_file"
    
    echo ""
    echo "  $user_type flow result: $success/7 steps passed"
    
    if [ $success -eq 7 ]; then
        echo -e "  ${GREEN}🎉 $user_type authentication flow: COMPLETE SUCCESS${NC}"
        return 0
    else
        echo -e "  ${RED}⚠️  $user_type authentication flow: $(( 7 - success )) FAILURES${NC}"
        return 1
    fi
}

# Test invalid credentials
test_invalid_credentials() {
    echo -e "${YELLOW}Testing invalid credentials...${NC}"
    echo ""
    
    local invalid_tests=0
    local invalid_passed=0
    
    # Test 1: Wrong email
    echo -n "  1. Wrong email... "
    wrong_email_response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d '{"email":"wrong@example.com","password":"Demo123"}' \
        -w "HTTPSTATUS:%{http_code}" \
        "$BACKEND_URL/api/auth/sign-in" 2>/dev/null)
    
    wrong_email_status=$(echo "$wrong_email_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    ((invalid_tests++))
    
    if [ "$wrong_email_status" = "401" ] || [ "$wrong_email_status" = "400" ]; then
        echo -e "${GREEN}✅ PASS${NC} (Properly rejected: $wrong_email_status)"
        ((invalid_passed++))
    else
        echo -e "${RED}❌ FAIL${NC} (Status: $wrong_email_status)"
    fi
    
    # Test 2: Wrong password
    echo -n "  2. Wrong password... "
    wrong_password_response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d '{"email":"alex.creator@demo.com","password":"wrongpassword"}' \
        -w "HTTPSTATUS:%{http_code}" \
        "$BACKEND_URL/api/auth/sign-in" 2>/dev/null)
    
    wrong_password_status=$(echo "$wrong_password_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    ((invalid_tests++))
    
    if [ "$wrong_password_status" = "401" ] || [ "$wrong_password_status" = "400" ]; then
        echo -e "${GREEN}✅ PASS${NC} (Properly rejected: $wrong_password_status)"
        ((invalid_passed++))
    else
        echo -e "${RED}❌ FAIL${NC} (Status: $wrong_password_status)"
    fi
    
    # Test 3: Malformed request
    echo -n "  3. Malformed request... "
    malformed_response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d '{"email":"invalid","password":""}' \
        -w "HTTPSTATUS:%{http_code}" \
        "$BACKEND_URL/api/auth/sign-in" 2>/dev/null)
    
    malformed_status=$(echo "$malformed_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    ((invalid_tests++))
    
    if [ "$malformed_status" = "400" ] || [ "$malformed_status" = "401" ]; then
        echo -e "${GREEN}✅ PASS${NC} (Properly rejected: $malformed_status)"
        ((invalid_passed++))
    else
        echo -e "${RED}❌ FAIL${NC} (Status: $malformed_status)"
    fi
    
    echo ""
    echo "  Invalid credentials test: $invalid_passed/$invalid_tests passed"
    
    if [ $invalid_passed -eq $invalid_tests ]; then
        echo -e "  ${GREEN}🔒 Security validation: PASSED${NC}"
        return 0
    else
        echo -e "  ${RED}🚨 Security validation: FAILED${NC}"
        return 1
    fi
}

# Main test execution
main() {
    local total_user_flows=0
    local passed_user_flows=0
    
    # Test each user type
    for user_type in creator investor production; do
        ((total_user_flows++))
        if test_auth_flow "$user_type"; then
            ((passed_user_flows++))
        fi
        echo "$(printf '=%.0s' {1..50})"
        echo ""
    done
    
    # Test security aspects
    local security_passed=0
    if test_invalid_credentials; then
        security_passed=1
    fi
    
    echo "$(printf '=%.0s' {1..50})"
    echo ""
    
    # Final summary
    echo -e "${BLUE}📊 FINAL SUMMARY:${NC}"
    echo "=================="
    echo "User Flow Tests: $passed_user_flows/$total_user_flows passed"
    echo "Security Tests: $security_passed/1 passed"
    echo ""
    
    local total_score=$((passed_user_flows + security_passed))
    local max_score=$((total_user_flows + 1))
    
    if [ $total_score -eq $max_score ]; then
        echo -e "${GREEN}🎉 ALL AUTHENTICATION TESTS PASSED!${NC}"
        echo -e "${GREEN}✅ All three portals are working correctly${NC}"
        echo -e "${GREEN}✅ Portal isolation is enforced${NC}"
        echo -e "${GREEN}✅ Security validations passed${NC}"
        exit 0
    else
        echo -e "${RED}⚠️  AUTHENTICATION ISSUES DETECTED${NC}"
        echo -e "${RED}❌ $((max_score - total_score)) test(s) failed${NC}"
        echo ""
        echo "Please check:"
        echo "- Backend server is running on port 8001"
        echo "- Demo users are properly seeded in database"
        echo "- Authentication endpoints are working"
        echo "- Session management is configured"
        exit 1
    fi
}

# Run the tests
main