#!/bin/bash

# Comprehensive JWT Authentication Test
# Tests all aspects of the JWT implementation

echo "🔐 Testing JWT Authentication System"
echo "===================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

WORKER_URL="https://pitchey-api-prod.cavelltheleaddev.workers.dev"

# Test 1: Check if auth returns JWT format tokens
echo -e "\n${CYAN}Test 1: JWT Token Generation${NC}"
echo "Testing with demo account..."

AUTH_RESPONSE=$(curl -s -X POST "$WORKER_URL/api/auth/creator/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"alex.creator@demo.com","password":"Demo123"}')

TOKEN=$(echo "$AUTH_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [[ -z "$TOKEN" ]]; then
    echo -e "${RED}✗ No token returned${NC}"
    echo "Response: $AUTH_RESPONSE"
    exit 1
fi

# Check token format (should be xxx.yyy.zzz)
if [[ "$TOKEN" == *"."*"."* ]]; then
    echo -e "${GREEN}✓ Token has JWT format (xxx.yyy.zzz)${NC}"
else
    echo -e "${RED}✗ Token doesn't have JWT format${NC}"
    echo "Token: $TOKEN"
    exit 1
fi

# Check for mock token pattern
if [[ "$TOKEN" == *"mock"* ]]; then
    echo -e "${RED}✗ Still using mock tokens!${NC}"
    exit 1
else
    echo -e "${GREEN}✓ Not using mock token pattern${NC}"
fi

# Test 2: Decode JWT payload
echo -e "\n${CYAN}Test 2: JWT Payload Structure${NC}"
HEADER=$(echo "$TOKEN" | cut -d'.' -f1)
PAYLOAD=$(echo "$TOKEN" | cut -d'.' -f2)
SIGNATURE=$(echo "$TOKEN" | cut -d'.' -f3)

# Decode header
echo "Header:"
echo "${HEADER}==" | base64 -d 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "  Unable to decode header"

# Decode payload
echo -e "\nPayload:"
DECODED_PAYLOAD=$(echo "${PAYLOAD}==" | base64 -d 2>/dev/null)
if echo "$DECODED_PAYLOAD" | python3 -m json.tool 2>/dev/null; then
    echo -e "${GREEN}✓ Valid JWT payload structure${NC}"
    
    # Check for required fields
    if echo "$DECODED_PAYLOAD" | grep -q '"email"'; then
        echo -e "${GREEN}✓ Contains email field${NC}"
    else
        echo -e "${YELLOW}⚠ Missing email field${NC}"
    fi
    
    if echo "$DECODED_PAYLOAD" | grep -q '"exp"'; then
        echo -e "${GREEN}✓ Contains expiration (exp) field${NC}"
    else
        echo -e "${YELLOW}⚠ Missing expiration field${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Could not parse payload${NC}"
fi

# Test 3: Test JWT authorization
echo -e "\n${CYAN}Test 3: JWT Authorization${NC}"
PROFILE_RESPONSE=$(curl -s "$WORKER_URL/api/users/profile" \
    -H "Authorization: Bearer $TOKEN")

if echo "$PROFILE_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ JWT accepted for protected endpoint${NC}"
else
    echo -e "${RED}✗ JWT rejected for protected endpoint${NC}"
    echo "Response: $PROFILE_RESPONSE"
fi

# Test 4: Test invalid JWT
echo -e "\n${CYAN}Test 4: Invalid JWT Rejection${NC}"
INVALID_RESPONSE=$(curl -s "$WORKER_URL/api/users/profile" \
    -H "Authorization: Bearer invalid-token-12345")

if echo "$INVALID_RESPONSE" | grep -q '"success":false\|401\|UNAUTHORIZED'; then
    echo -e "${GREEN}✓ Invalid JWT properly rejected${NC}"
else
    echo -e "${RED}✗ Invalid JWT not rejected properly${NC}"
    echo "Response: $INVALID_RESPONSE"
fi

# Test 5: Test missing JWT
echo -e "\n${CYAN}Test 5: Missing JWT Handling${NC}"
NO_AUTH_RESPONSE=$(curl -s "$WORKER_URL/api/users/profile")

if echo "$NO_AUTH_RESPONSE" | grep -q '"success":false\|401\|UNAUTHORIZED'; then
    echo -e "${GREEN}✓ Missing JWT properly handled${NC}"
else
    echo -e "${RED}✗ Missing JWT not handled properly${NC}"
    echo "Response: $NO_AUTH_RESPONSE"
fi

# Test 6: Test other portals
echo -e "\n${CYAN}Test 6: Multi-Portal JWT Support${NC}"

# Investor portal
INVESTOR_RESPONSE=$(curl -s -X POST "$WORKER_URL/api/auth/investor/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"sarah.investor@demo.com","password":"Demo123"}')

if echo "$INVESTOR_RESPONSE" | grep -q '"token"' && echo "$INVESTOR_RESPONSE" | grep -q '"userType":"investor"'; then
    echo -e "${GREEN}✓ Investor portal JWT working${NC}"
else
    echo -e "${YELLOW}⚠ Investor portal needs verification${NC}"
fi

# Production portal
PRODUCTION_RESPONSE=$(curl -s -X POST "$WORKER_URL/api/auth/production/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"stellar.production@demo.com","password":"Demo123"}')

if echo "$PRODUCTION_RESPONSE" | grep -q '"token"' && echo "$PRODUCTION_RESPONSE" | grep -q '"userType":"production"'; then
    echo -e "${GREEN}✓ Production portal JWT working${NC}"
else
    echo -e "${YELLOW}⚠ Production portal needs verification${NC}"
fi

# Summary
echo -e "\n${CYAN}===================================="
echo -e "JWT Authentication Test Summary${NC}"
echo -e "${CYAN}====================================${NC}"

# Count successes
TESTS_PASSED=0
TESTS_TOTAL=6

if [[ "$TOKEN" == *"."*"."* ]] && [[ "$TOKEN" != *"mock"* ]]; then
    ((TESTS_PASSED++))
fi

if echo "$DECODED_PAYLOAD" | grep -q '"email"' 2>/dev/null; then
    ((TESTS_PASSED++))
fi

if echo "$PROFILE_RESPONSE" | grep -q '"success":true'; then
    ((TESTS_PASSED++))
fi

if echo "$INVALID_RESPONSE" | grep -q '"success":false\|401'; then
    ((TESTS_PASSED++))
fi

if echo "$NO_AUTH_RESPONSE" | grep -q '"success":false\|401'; then
    ((TESTS_PASSED++))
fi

if echo "$INVESTOR_RESPONSE" | grep -q '"token"'; then
    ((TESTS_PASSED++))
fi

echo -e "\nTests Passed: $TESTS_PASSED / $TESTS_TOTAL"

if [ $TESTS_PASSED -eq $TESTS_TOTAL ]; then
    echo -e "${GREEN}✅ JWT Authentication Fully Functional!${NC}"
else
    echo -e "${YELLOW}⚠ JWT Authentication Partially Working${NC}"
    echo "Some features may need additional configuration."
fi

echo -e "\n${CYAN}Token Sample:${NC}"
echo "${TOKEN:0:50}..."