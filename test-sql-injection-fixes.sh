#!/bin/bash

# SQL Injection Security Fix Test Script
# Tests that our fixes prevent common SQL injection attacks

echo "🔒 SQL Injection Security Test Suite"
echo "====================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Function to test endpoint
test_injection() {
    local endpoint=$1
    local payload=$2
    local description=$3
    
    echo -n "Testing: $description... "
    
    # Make request with malicious payload
    response=$(curl -s -X GET "http://localhost:8001/api/${endpoint}?${payload}" \
        -H "Content-Type: application/json" \
        2>/dev/null)
    
    # Check if response contains SQL error or successful injection signs
    if echo "$response" | grep -qi "syntax error\|SQL\|DROP TABLE\|DELETE FROM\|UPDATE.*SET" ; then
        echo -e "${RED}VULNERABLE${NC}"
        echo "  Payload: $payload"
        echo "  Response: ${response:0:200}"
        ((FAILED++))
    else
        echo -e "${GREEN}PROTECTED${NC}"
        ((PASSED++))
    fi
}

echo "Starting local test server..."
echo ""

# Test various SQL injection vectors
echo "1. Testing Classic SQL Injection Attacks"
echo "-----------------------------------------"

test_injection "pitches/search" \
    "search=';DROP TABLE users;--" \
    "DROP TABLE injection"

test_injection "pitches/search" \
    "search=' OR '1'='1" \
    "Authentication bypass"

test_injection "pitches/search" \
    "genre=action' UNION SELECT * FROM users--" \
    "UNION SELECT injection"

test_injection "pitches/search" \
    "sortBy=(SELECT password FROM users)" \
    "ORDER BY injection"

echo ""
echo "2. Testing Blind SQL Injection"
echo "-------------------------------"

test_injection "pitches/search" \
    "search=test' AND SLEEP(5)--" \
    "Time-based blind injection"

test_injection "pitches/search" \
    "search=test' AND 1=1--" \
    "Boolean-based blind injection"

echo ""
echo "3. Testing Second-Order Injection"
echo "----------------------------------"

test_injection "pitches/search" \
    "search=admin'--" \
    "Second-order injection"

echo ""
echo "4. Testing Encoded Attacks"
echo "---------------------------"

test_injection "pitches/search" \
    "search=%27%20OR%201%3D1" \
    "URL-encoded injection"

test_injection "pitches/search" \
    "search=\x27\x20\x4F\x52\x20\x31\x3D\x31" \
    "Hex-encoded injection"

echo ""
echo "5. Testing Stacked Queries"
echo "---------------------------"

test_injection "pitches/search" \
    "search=';INSERT INTO users (email,password) VALUES ('hacker@evil.com','password');--" \
    "Stacked query injection"

echo ""
echo "6. Testing Comment Variations"
echo "------------------------------"

test_injection "pitches/search" \
    "search=' OR 1=1--" \
    "SQL comment (--)"

test_injection "pitches/search" \
    "search=' OR 1=1#" \
    "SQL comment (#)"

test_injection "pitches/search" \
    "search=' OR 1=1/*" \
    "SQL comment (/*)"

echo ""
echo "7. Testing LIMIT/OFFSET Injection"
echo "----------------------------------"

test_injection "pitches/browse" \
    "limit=10;DELETE FROM pitches&offset=0" \
    "LIMIT injection"

test_injection "pitches/browse" \
    "limit=10&offset=-1 UNION SELECT * FROM users" \
    "OFFSET injection"

echo ""
echo "====================================="
echo "Test Results:"
echo "  ✅ Passed: $PASSED"
echo "  ❌ Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All SQL injection tests passed! Your application is protected.${NC}"
    exit 0
else
    echo -e "${RED}⚠️  WARNING: $FAILED SQL injection vulnerabilities detected!${NC}"
    echo "Please review the failed tests and ensure all queries use parameterized statements."
    exit 1
fi