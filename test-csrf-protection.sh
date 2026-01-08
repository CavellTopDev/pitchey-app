#!/bin/bash

# CSRF Protection Test Script
# Tests double-submit cookie pattern implementation

echo "🔒 CSRF Protection Test Suite"
echo "=============================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_URL=${API_URL:-"http://localhost:8001"}
ORIGIN="http://localhost:5173"

# Test results
PASSED=0
FAILED=0

# Function to run test
run_test() {
    local test_name=$1
    local expected_status=$2
    local actual_status=$3
    
    if [ "$actual_status" = "$expected_status" ]; then
        echo -e "${GREEN}✓${NC} $test_name (${actual_status})"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $test_name (expected ${expected_status}, got ${actual_status})"
        ((FAILED++))
    fi
}

echo -e "${BLUE}1. Testing GET Request (Should Get CSRF Cookie)${NC}"

# GET request should set CSRF cookie
GET_RESPONSE=$(curl -s -i -X GET "$API_URL/api/health" \
    -H "Origin: $ORIGIN" \
    -c /tmp/csrf-cookies.txt)

if grep -q "csrf-token=" /tmp/csrf-cookies.txt; then
    CSRF_TOKEN=$(grep "csrf-token" /tmp/csrf-cookies.txt | awk '{print $7}')
    run_test "GET sets CSRF cookie" "found" "found"
    echo "  Token: ${CSRF_TOKEN:0:10}..."
else
    run_test "GET sets CSRF cookie" "found" "not-found"
fi

echo ""
echo -e "${BLUE}2. Testing POST Without CSRF Token${NC}"

# POST without CSRF token should fail
POST_NO_TOKEN=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/api/pitches" \
    -H "Content-Type: application/json" \
    -H "Origin: $ORIGIN" \
    -d '{"title":"Test Pitch"}' \
    -b /tmp/csrf-cookies.txt)

run_test "POST without CSRF header blocked" "403" "$POST_NO_TOKEN"

echo ""
echo -e "${BLUE}3. Testing POST With Mismatched CSRF Token${NC}"

# POST with wrong CSRF token should fail
POST_WRONG_TOKEN=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/api/pitches" \
    -H "Content-Type: application/json" \
    -H "Origin: $ORIGIN" \
    -H "X-CSRF-Token: wrong-token-12345" \
    -d '{"title":"Test Pitch"}' \
    -b /tmp/csrf-cookies.txt)

run_test "POST with wrong CSRF token blocked" "403" "$POST_WRONG_TOKEN"

echo ""
echo -e "${BLUE}4. Testing POST With Correct CSRF Token${NC}"

# POST with correct CSRF token should work (may fail for other auth reasons)
if [ ! -z "$CSRF_TOKEN" ]; then
    POST_CORRECT=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/api/pitches" \
        -H "Content-Type: application/json" \
        -H "Origin: $ORIGIN" \
        -H "X-CSRF-Token: $CSRF_TOKEN" \
        -d '{"title":"Test Pitch"}' \
        -b /tmp/csrf-cookies.txt)
    
    # Should NOT be 403 (CSRF error)
    if [ "$POST_CORRECT" != "403" ]; then
        run_test "POST with correct CSRF token allowed" "!403" "$POST_CORRECT"
    else
        run_test "POST with correct CSRF token allowed" "!403" "403"
    fi
else
    echo "  Skipped (no token available)"
fi

echo ""
echo -e "${BLUE}5. Testing Cross-Origin Request${NC}"

# Request from different origin should be blocked
CROSS_ORIGIN=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/api/pitches" \
    -H "Content-Type: application/json" \
    -H "Origin: http://evil-site.com" \
    -H "X-CSRF-Token: $CSRF_TOKEN" \
    -d '{"title":"Evil Pitch"}' \
    -b /tmp/csrf-cookies.txt)

run_test "Cross-origin POST blocked" "403" "$CROSS_ORIGIN"

echo ""
echo -e "${BLUE}6. Testing Missing Origin Header${NC}"

# Request without Origin header should be blocked for mutations
NO_ORIGIN=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/api/pitches" \
    -H "Content-Type: application/json" \
    -H "X-CSRF-Token: $CSRF_TOKEN" \
    -d '{"title":"No Origin Pitch"}' \
    -b /tmp/csrf-cookies.txt)

run_test "POST without Origin blocked" "403" "$NO_ORIGIN"

echo ""
echo -e "${BLUE}7. Testing Safe Methods (GET, HEAD, OPTIONS)${NC}"

# GET should work without CSRF token
GET_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$API_URL/api/pitches" \
    -H "Origin: $ORIGIN")

run_test "GET works without CSRF" "200" "$GET_STATUS"

# OPTIONS should work without CSRF token
OPTIONS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$API_URL/api/pitches" \
    -H "Origin: $ORIGIN")

if [ "$OPTIONS_STATUS" = "200" ] || [ "$OPTIONS_STATUS" = "204" ]; then
    run_test "OPTIONS works without CSRF" "200/204" "$OPTIONS_STATUS"
else
    run_test "OPTIONS works without CSRF" "200/204" "$OPTIONS_STATUS"
fi

echo ""
echo -e "${BLUE}8. Testing Token Rotation (Sensitive Endpoints)${NC}"

# Login to get auth token
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
    -H "Content-Type: application/json" \
    -H "Origin: $ORIGIN" \
    -H "X-CSRF-Token: $CSRF_TOKEN" \
    -d '{
        "email": "alex.creator@demo.com",
        "password": "Demo123"
    }' \
    -b /tmp/csrf-cookies.txt \
    -c /tmp/csrf-cookies-new.txt)

# Check if new CSRF token was issued
if [ -f /tmp/csrf-cookies-new.txt ]; then
    NEW_TOKEN=$(grep "csrf-token" /tmp/csrf-cookies-new.txt | awk '{print $7}')
    
    if [ "$NEW_TOKEN" != "$CSRF_TOKEN" ] && [ ! -z "$NEW_TOKEN" ]; then
        run_test "Token rotated on sensitive operation" "rotated" "rotated"
    else
        run_test "Token rotated on sensitive operation" "rotated" "not-rotated"
    fi
fi

echo ""
echo -e "${BLUE}9. Testing SameSite Cookie Attribute${NC}"

# Check if cookie has SameSite attribute
if grep -q "SameSite" /tmp/csrf-cookies.txt 2>/dev/null; then
    run_test "CSRF cookie has SameSite attribute" "found" "found"
else
    echo -e "${YELLOW}⚠${NC} CSRF cookie SameSite attribute not verified"
fi

echo ""
echo -e "${BLUE}10. Testing HttpOnly and Secure Flags${NC}"

# Check cookie flags
COOKIE_LINE=$(grep "csrf-token" /tmp/csrf-cookies.txt 2>/dev/null | head -1)

if echo "$COOKIE_LINE" | grep -q "Secure"; then
    echo -e "${GREEN}✓${NC} Secure flag set (HTTPS only)"
else
    echo -e "${YELLOW}⚠${NC} Secure flag not set (testing on HTTP)"
fi

# CSRF cookie should NOT be HttpOnly (needs JS access)
if echo "$COOKIE_LINE" | grep -q "HttpOnly"; then
    echo -e "${RED}✗${NC} HttpOnly flag set (blocks JavaScript access)"
else
    echo -e "${GREEN}✓${NC} HttpOnly not set (JavaScript can read)"
fi

echo ""
echo "=============================="
echo "Test Results:"
echo "  ✅ Passed: $PASSED"
echo "  ❌ Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 CSRF protection is working correctly!${NC}"
    echo ""
    echo "Security features confirmed:"
    echo "  • Double-submit cookie pattern active"
    echo "  • Origin validation enforced"
    echo "  • Token rotation on sensitive ops"
    echo "  • Safe methods exempted"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some CSRF tests failed${NC}"
    echo ""
    echo "Review:"
    echo "  1. Ensure CSRF middleware is active"
    echo "  2. Check Origin whitelist configuration"
    echo "  3. Verify cookie settings"
    exit 1
fi

# Cleanup
rm -f /tmp/csrf-cookies.txt /tmp/csrf-cookies-new.txt