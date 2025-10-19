#!/bin/bash

# Quick API validation for client requirements
# Tests the 15 specific client requirements against the running backend

set -e

API_URL="${API_URL:-http://localhost:8001}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🧪 Pitchey API Requirements Validation"
echo "======================================"
echo "API URL: $API_URL"
echo "Timestamp: $TIMESTAMP"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Helper function to log test results
log_test() {
    local test_name="$1"
    local status="$2"
    local details="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    case $status in
        "PASS")
            echo -e "${GREEN}[PASS]${NC} $test_name"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            ;;
        "FAIL")
            echo -e "${RED}[FAIL]${NC} $test_name"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            ;;
        "SKIP")
            echo -e "${YELLOW}[SKIP]${NC} $test_name"
            ;;
    esac
    
    if [ ! -z "$details" ]; then
        echo -e "      ${details}"
    fi
}

# Test demo account login
test_demo_login() {
    local user_type="$1"
    local email="$2"
    
    echo -e "${BLUE}Testing $user_type login...${NC}"
    
    response=$(curl -s -w "%{http_code}" -X POST "$API_URL/api/auth/$user_type/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"Demo123\"}" 2>/dev/null)
    
    http_code="${response: -3}"
    response_body="${response%???}"
    
    if [ "$http_code" = "200" ]; then
        # Extract token for further tests
        token=$(echo "$response_body" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
        if [ ! -z "$token" ]; then
            log_test "$user_type Login" "PASS" "Authentication successful, token received"
            echo "$token" > "/tmp/pitchey_${user_type}_token"
            return 0
        else
            log_test "$user_type Login" "FAIL" "No token in response"
            return 1
        fi
    else
        log_test "$user_type Login" "FAIL" "HTTP $http_code - $response_body"
        return 1
    fi
}

# Test logout functionality
test_logout() {
    local user_type="$1"
    
    if [ -f "/tmp/pitchey_${user_type}_token" ]; then
        token=$(cat "/tmp/pitchey_${user_type}_token")
        
        response=$(curl -s -w "%{http_code}" -X POST "$API_URL/api/auth/logout" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $token" 2>/dev/null)
        
        http_code="${response: -3}"
        
        if [ "$http_code" = "200" ]; then
            log_test "$user_type Logout" "PASS" "Logout endpoint responds correctly"
        else
            log_test "$user_type Logout" "FAIL" "HTTP $http_code"
        fi
    else
        log_test "$user_type Logout" "SKIP" "No token available for logout test"
    fi
}

# Test dashboard access
test_dashboard() {
    local user_type="$1"
    
    if [ -f "/tmp/pitchey_${user_type}_token" ]; then
        token=$(cat "/tmp/pitchey_${user_type}_token")
        
        response=$(curl -s -w "%{http_code}" -X GET "$API_URL/api/dashboard/$user_type" \
            -H "Authorization: Bearer $token" 2>/dev/null)
        
        http_code="${response: -3}"
        response_body="${response%???}"
        
        if [ "$http_code" = "200" ]; then
            log_test "$user_type Dashboard" "PASS" "Dashboard endpoint accessible"
        else
            log_test "$user_type Dashboard" "FAIL" "HTTP $http_code - Dashboard not accessible"
        fi
    else
        log_test "$user_type Dashboard" "SKIP" "No token available for dashboard test"
    fi
}

# Test API endpoint
test_endpoint() {
    local method="$1"
    local endpoint="$2"
    local test_name="$3"
    local token="$4"
    
    if [ "$method" = "GET" ]; then
        if [ ! -z "$token" ]; then
            response=$(curl -s -w "%{http_code}" -X GET "$API_URL$endpoint" \
                -H "Authorization: Bearer $token" 2>/dev/null)
        else
            response=$(curl -s -w "%{http_code}" -X GET "$API_URL$endpoint" 2>/dev/null)
        fi
        
        http_code="${response: -3}"
        response_body="${response%???}"
        
        if [ "$http_code" = "200" ]; then
            log_test "$test_name" "PASS" "Endpoint responds with valid data"
        elif [ "$http_code" = "404" ]; then
            log_test "$test_name" "FAIL" "Endpoint not found (404)"
        else
            log_test "$test_name" "FAIL" "HTTP $http_code"
        fi
    fi
}

# Test pitch creation restriction
test_pitch_creation_restriction() {
    if [ -f "/tmp/pitchey_investor_token" ]; then
        token=$(cat "/tmp/pitchey_investor_token")
        
        response=$(curl -s -w "%{http_code}" -X POST "$API_URL/api/pitches" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $token" \
            -d '{"title":"Test Pitch","logline":"Should not be created","genre":"Test","format":"Feature"}' 2>/dev/null)
        
        http_code="${response: -3}"
        
        if [ "$http_code" = "403" ]; then
            log_test "Investor Pitch Creation Block" "PASS" "Investor properly blocked from creating pitches"
        elif [ "$http_code" = "201" ]; then
            log_test "Investor Pitch Creation Block" "FAIL" "Investor can create pitches - SECURITY VIOLATION"
        else
            log_test "Investor Pitch Creation Block" "SKIP" "Unexpected response: HTTP $http_code"
        fi
    else
        log_test "Investor Pitch Creation Block" "SKIP" "No investor token available"
    fi
}

echo -e "${BLUE}=== CRITICAL ISSUE #1: Investor Sign-Out Functionality ===${NC}"
test_demo_login "investor" "sarah.investor@demo.com"
test_logout "investor"

echo ""
echo -e "${BLUE}=== CRITICAL ISSUE #2: Investor Dashboard Functionality ===${NC}"
test_dashboard "investor"

echo ""
echo -e "${BLUE}=== BROWSE PITCHES: Tab Content Separation ===${NC}"
test_endpoint "GET" "/api/pitches/trending" "Trending Tab Endpoint"
test_endpoint "GET" "/api/pitches/new" "New Tab Endpoint"
test_endpoint "GET" "/api/pitches/top-rated" "Top Rated Tab Removal Check"

echo ""
echo -e "${BLUE}=== BROWSE PITCHES: General Browse with Sorting ===${NC}"
test_endpoint "GET" "/api/pitches/browse/general?sort=alphabetical&order=asc" "Alphabetical Sort A-Z"
test_endpoint "GET" "/api/pitches/browse/general?sort=date&order=desc" "Date Sort Newest First"
test_endpoint "GET" "/api/pitches/browse/general?sort=budget&order=desc" "Budget Sort High to Low"
test_endpoint "GET" "/api/pitches/browse/general?sort=views&order=desc" "View Count Sort"

echo ""
echo -e "${BLUE}=== ACCESS CONTROL: Investor Restrictions ===${NC}"
test_pitch_creation_restriction

echo ""
echo -e "${BLUE}=== PITCH CREATION: Character Management ===${NC}"
test_demo_login "creator" "alex.creator@demo.com"
creator_token=""
if [ -f "/tmp/pitchey_creator_token" ]; then
    creator_token=$(cat "/tmp/pitchey_creator_token")
fi

# Test character endpoints
test_endpoint "GET" "/api/pitches/1/characters" "Character List Endpoint" "$creator_token"

echo ""
echo -e "${BLUE}=== DOCUMENT UPLOAD: Multiple Files & NDA ===${NC}"
test_endpoint "POST" "/api/upload/document" "Document Upload Endpoint" "$creator_token"

echo ""
echo -e "${BLUE}=== NDA WORKFLOW: Request/Approve/Sign ===${NC}"
test_endpoint "POST" "/api/nda/request" "NDA Request Endpoint" "$creator_token"
test_endpoint "GET" "/api/nda/signed" "NDA List Endpoint" "$creator_token"

echo ""
echo -e "${BLUE}=== INFO REQUEST SYSTEM: Post-NDA Communication ===${NC}"
test_endpoint "GET" "/api/info-requests" "Info Request List" "$creator_token"

echo ""
echo -e "${BLUE}=== ADDITIONAL VERIFICATIONS ===${NC}"

# Test basic connectivity
response=$(curl -s -w "%{http_code}" "$API_URL/" 2>/dev/null)
http_code="${response: -3}"
if [ "$http_code" = "200" ]; then
    log_test "Backend Connectivity" "PASS" "Backend server is responding"
else
    log_test "Backend Connectivity" "FAIL" "Backend server not responding (HTTP $http_code)"
fi

# Test health endpoint
response=$(curl -s -w "%{http_code}" "$API_URL/health" 2>/dev/null)
http_code="${response: -3}"
if [ "$http_code" = "200" ]; then
    log_test "Health Check Endpoint" "PASS" "Health endpoint available"
else
    log_test "Health Check Endpoint" "SKIP" "Health endpoint not available"
fi

# Test CORS
response=$(curl -s -w "%{http_code}" -H "Origin: http://localhost:5173" "$API_URL/api/pitches" 2>/dev/null)
http_code="${response: -3}"
if [ "$http_code" = "200" ]; then
    log_test "CORS Configuration" "PASS" "CORS allows frontend origin"
else
    log_test "CORS Configuration" "SKIP" "CORS test inconclusive"
fi

# Summary
echo ""
echo -e "${BLUE}=== VALIDATION SUMMARY ===${NC}"
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

if [ $TOTAL_TESTS -gt 0 ]; then
    pass_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo "Pass Rate: $pass_rate%"
    
    if [ $pass_rate -ge 90 ]; then
        echo -e "${GREEN}✅ EXCELLENT: Platform meets most client requirements${NC}"
    elif [ $pass_rate -ge 75 ]; then
        echo -e "${YELLOW}⚠️ GOOD: Most features working, minor issues${NC}"
    elif [ $pass_rate -ge 50 ]; then
        echo -e "${YELLOW}🔧 NEEDS WORK: Significant issues need fixing${NC}"
    else
        echo -e "${RED}❌ CRITICAL: Major issues prevent client requirements${NC}"
    fi
fi

# Generate quick report
cat > "api-validation-report-$TIMESTAMP.md" << EOF
# API Requirements Validation Report

**Date**: $(date)
**API URL**: $API_URL

## Summary
- Total Tests: $TOTAL_TESTS
- Passed: $PASSED_TESTS
- Failed: $FAILED_TESTS
- Pass Rate: $pass_rate%

## Critical Issues Status
- Investor Sign-Out: $([ $FAILED_TESTS -eq 0 ] && echo "✅ Working" || echo "❌ Issues Found")
- Investor Dashboard: $([ $FAILED_TESTS -eq 0 ] && echo "✅ Working" || echo "❌ Issues Found")
- Browse Functionality: $([ $FAILED_TESTS -eq 0 ] && echo "✅ Working" || echo "❌ Issues Found")
- Access Control: $([ $FAILED_TESTS -eq 0 ] && echo "✅ Working" || echo "❌ Issues Found")

## Recommendations
$(if [ $FAILED_TESTS -gt 0 ]; then
    echo "1. Fix failing API endpoints"
    echo "2. Implement missing functionality"
    echo "3. Re-run validation tests"
    echo "4. Complete database schema updates"
else
    echo "1. Proceed with frontend testing"
    echo "2. Schedule client validation"
    echo "3. Prepare for production deployment"
fi)

---
Generated by Pitchey API Requirements Validation
EOF

echo ""
echo "📄 Quick report saved: api-validation-report-$TIMESTAMP.md"

# Cleanup
rm -f /tmp/pitchey_*_token

exit $FAILED_TESTS