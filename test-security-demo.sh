#!/bin/bash

# ============================================================================
# SECURITY TEST DEMONSTRATION FOR PITCHEY
# Quick demonstration of key security tests
# ============================================================================

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="http://localhost:8001"
API_URL="${BASE_URL}/api"

echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}     PITCHEY SECURITY TEST DEMONSTRATION${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}\n"

# Test 1: Check Security Headers
echo -e "${YELLOW}[1] Testing Security Headers...${NC}"
headers=$(curl -s -I "${API_URL}/public/pitches" 2>/dev/null)

if echo "$headers" | grep -q "X-Content-Type-Options: nosniff"; then
    echo -e "  ${GREEN}✓${NC} X-Content-Type-Options present"
else
    echo -e "  ${RED}✗${NC} X-Content-Type-Options missing"
fi

if echo "$headers" | grep -q "X-Frame-Options"; then
    echo -e "  ${GREEN}✓${NC} X-Frame-Options present"
else
    echo -e "  ${RED}✗${NC} X-Frame-Options missing"
fi

if echo "$headers" | grep -q "Content-Security-Policy"; then
    echo -e "  ${GREEN}✓${NC} CSP header present"
else
    echo -e "  ${RED}✗${NC} CSP header missing"
fi

# Test 2: Authentication Required
echo -e "\n${YELLOW}[2] Testing Authentication Requirement...${NC}"
response=$(curl -s -w "\n%{http_code}" "${API_URL}/user/profile" 2>/dev/null)
status=$(echo "$response" | tail -n1)

if [ "$status" == "401" ]; then
    echo -e "  ${GREEN}✓${NC} Unauthenticated request blocked (401)"
else
    echo -e "  ${RED}✗${NC} Endpoint not properly protected"
fi

# Test 3: Invalid JWT Rejection
echo -e "\n${YELLOW}[3] Testing Invalid JWT Rejection...${NC}"
response=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer invalid.jwt.token" \
    "${API_URL}/user/profile" 2>/dev/null)
status=$(echo "$response" | tail -n1)

if [ "$status" == "401" ]; then
    echo -e "  ${GREEN}✓${NC} Invalid JWT rejected"
else
    echo -e "  ${RED}✗${NC} Invalid JWT not properly rejected"
fi

# Test 4: SQL Injection Prevention (Basic)
echo -e "\n${YELLOW}[4] Testing SQL Injection Prevention...${NC}"
response=$(curl -s "${API_URL}/search?q=' OR '1'='1" 2>/dev/null)

if ! echo "$response" | grep -q "error" && ! echo "$response" | grep -q "syntax"; then
    echo -e "  ${GREEN}✓${NC} SQL injection attempt handled safely"
else
    echo -e "  ${YELLOW}!${NC} Check SQL injection handling"
fi

# Test 5: XSS Prevention
echo -e "\n${YELLOW}[5] Testing XSS Prevention...${NC}"
xss_test="<script>alert('XSS')</script>"
response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{\"search\":\"$xss_test\"}" \
    "${API_URL}/search" 2>/dev/null)

if ! echo "$response" | grep -q "<script>"; then
    echo -e "  ${GREEN}✓${NC} XSS payload appears to be filtered"
else
    echo -e "  ${RED}✗${NC} XSS payload not filtered"
fi

# Test 6: Rate Limiting Check
echo -e "\n${YELLOW}[6] Testing Rate Limiting...${NC}"
echo -e "  Making 10 rapid requests to test rate limiting..."

rate_limited=false
for i in {1..10}; do
    response=$(curl -s -w "\n%{http_code}" "${API_URL}/public/pitches" 2>/dev/null)
    status=$(echo "$response" | tail -n1)
    
    if [ "$status" == "429" ]; then
        echo -e "  ${GREEN}✓${NC} Rate limiting triggered after $i requests"
        rate_limited=true
        break
    fi
done

if [ "$rate_limited" == "false" ]; then
    echo -e "  ${YELLOW}!${NC} Rate limiting may need configuration"
fi

# Test 7: CORS Configuration
echo -e "\n${YELLOW}[7] Testing CORS Configuration...${NC}"
response=$(curl -s -I -H "Origin: http://evil.com" "${API_URL}/public/pitches" 2>/dev/null)

if echo "$response" | grep -q "Access-Control-Allow-Origin: http://evil.com"; then
    echo -e "  ${RED}✗${NC} CORS allows untrusted origin"
elif echo "$response" | grep -q "Access-Control-Allow-Origin: \*"; then
    echo -e "  ${YELLOW}!${NC} CORS uses wildcard (development mode?)"
else
    echo -e "  ${GREEN}✓${NC} CORS properly restricted"
fi

# Test 8: Password Requirements
echo -e "\n${YELLOW}[8] Testing Password Policy...${NC}"
weak_pass_response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"weak","username":"test"}' \
    "${API_URL}/auth/register" 2>/dev/null)

if echo "$weak_pass_response" | grep -q "Password must"; then
    echo -e "  ${GREEN}✓${NC} Weak passwords rejected"
else
    echo -e "  ${RED}✗${NC} Weak passwords may be accepted"
fi

# Summary
echo -e "\n${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                    TEST SUMMARY${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo -e "\nThis is a quick security check. Run the full test suite with:"
echo -e "  ${YELLOW}./test-security-workflows.sh${NC}"
echo -e "\nFor verbose output:"
echo -e "  ${YELLOW}./test-security-workflows.sh --verbose${NC}"
echo -e "\n${GREEN}Security testing complete!${NC}\n"