#!/bin/bash

# API Health Check Script
# Quick validation of core API endpoints

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="http://localhost:8001"
TIMEOUT=10

echo -e "${GREEN}🩺 API Health Check - Pitchey Local Development${NC}"
echo "=================================================="
echo "Backend URL: $BACKEND_URL"
echo "Timestamp: $(date)"
echo ""

# Function to test an endpoint
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    
    echo -n "Testing $name... "
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total}" \
        --max-time $TIMEOUT \
        "$url" 2>/dev/null || echo "HTTPSTATUS:000;TIME:timeout")
    
    status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    time=$(echo "$response" | grep -o "TIME:[0-9.]*" | cut -d: -f2)
    
    if [ "$status" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} (${status}, ${time}s)"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (Expected: $expected_status, Got: $status, Time: ${time}s)"
        return 1
    fi
}

# Function to test authenticated endpoint
test_authenticated_endpoint() {
    local name="$1"
    local url="$2"
    local email="$3"
    local password="$4"
    
    echo -n "Testing $name (authenticated)... "
    
    # First, login and get session cookie
    login_response=$(curl -s -c /tmp/pitchey_cookies.txt \
        -X POST \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}" \
        -w "HTTPSTATUS:%{http_code}" \
        "$BACKEND_URL/api/auth/sign-in" 2>/dev/null)
    
    login_status=$(echo "$login_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    
    if [ "$login_status" != "200" ]; then
        echo -e "${RED}❌ LOGIN FAILED${NC} (Status: $login_status)"
        return 1
    fi
    
    # Test the authenticated endpoint
    auth_response=$(curl -s -b /tmp/pitchey_cookies.txt \
        -w "HTTPSTATUS:%{http_code};TIME:%{time_total}" \
        --max-time $TIMEOUT \
        "$url" 2>/dev/null || echo "HTTPSTATUS:000;TIME:timeout")
    
    status=$(echo "$auth_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    time=$(echo "$auth_response" | grep -o "TIME:[0-9.]*" | cut -d: -f2)
    
    # Cleanup
    rm -f /tmp/pitchey_cookies.txt
    
    if [ "$status" = "200" ]; then
        echo -e "${GREEN}✅ PASS${NC} (${status}, ${time}s)"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (Status: $status, Time: ${time}s)"
        return 1
    fi
}

# Test counter
total_tests=0
passed_tests=0

# Core Infrastructure Tests
echo "🔧 Core Infrastructure:"
echo "----------------------"

test_endpoint "Local Proxy Health" "$BACKEND_URL/health"
((total_tests++)); [ $? -eq 0 ] && ((passed_tests++))

test_endpoint "API Health" "$BACKEND_URL/api/health"
((total_tests++)); [ $? -eq 0 ] && ((passed_tests++))

test_endpoint "API Version" "$BACKEND_URL/api/version"
((total_tests++)); [ $? -eq 0 ] && ((passed_tests++))

echo ""

# Public API Tests
echo "🌐 Public API Endpoints:"
echo "------------------------"

test_endpoint "Pitch Browse" "$BACKEND_URL/api/pitches/browse"
((total_tests++)); [ $? -eq 0 ] && ((passed_tests++))

test_endpoint "Search API" "$BACKEND_URL/api/search?q=test"
((total_tests++)); [ $? -eq 0 ] && ((passed_tests++))

echo ""

# Authentication Tests
echo "🔐 Authentication Flow:"
echo "----------------------"

# Test login endpoint
echo -n "Testing Login Endpoint... "
login_test=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"alex.creator@demo.com","password":"Demo123"}' \
    -w "HTTPSTATUS:%{http_code}" \
    "$BACKEND_URL/api/auth/sign-in" 2>/dev/null)

login_status=$(echo "$login_test" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
((total_tests++))

if [ "$login_status" = "200" ]; then
    echo -e "${GREEN}✅ PASS${NC} (${login_status})"
    ((passed_tests++))
else
    echo -e "${RED}❌ FAIL${NC} (Status: $login_status)"
fi

echo ""

# Protected Endpoint Tests
echo "🛡️  Protected Endpoints:"
echo "------------------------"

test_authenticated_endpoint "Creator Dashboard" "$BACKEND_URL/api/creator/dashboard" "alex.creator@demo.com" "Demo123"
((total_tests++)); [ $? -eq 0 ] && ((passed_tests++))

test_authenticated_endpoint "Investor Dashboard" "$BACKEND_URL/api/investor/dashboard" "sarah.investor@demo.com" "Demo123"
((total_tests++)); [ $? -eq 0 ] && ((passed_tests++))

test_authenticated_endpoint "Production Dashboard" "$BACKEND_URL/api/production/dashboard" "stellar.production@demo.com" "Demo123"
((total_tests++)); [ $? -eq 0 ] && ((passed_tests++))

echo ""

# Service Connectivity Tests
echo "🔌 Service Connectivity:"
echo "------------------------"

echo -n "Testing MinIO Health... "
minio_response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
    --max-time $TIMEOUT \
    "http://localhost:9000/minio/health/live" 2>/dev/null || echo "HTTPSTATUS:000")

minio_status=$(echo "$minio_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
((total_tests++))

if [ "$minio_status" = "200" ]; then
    echo -e "${GREEN}✅ PASS${NC} (${minio_status})"
    ((passed_tests++))
else
    echo -e "${RED}❌ FAIL${NC} (Status: $minio_status)"
fi

echo -n "Testing Adminer... "
adminer_response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
    --max-time $TIMEOUT \
    "http://localhost:8080" 2>/dev/null || echo "HTTPSTATUS:000")

adminer_status=$(echo "$adminer_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
((total_tests++))

if [ "$adminer_status" = "200" ]; then
    echo -e "${GREEN}✅ PASS${NC} (${adminer_status})"
    ((passed_tests++))
else
    echo -e "${RED}❌ FAIL${NC} (Status: $adminer_status)"
fi

echo ""

# Summary
echo "📊 Summary:"
echo "----------"
echo "Total Tests: $total_tests"
echo "Passed: $passed_tests"
echo "Failed: $((total_tests - passed_tests))"

pass_rate=$(( (passed_tests * 100) / total_tests ))
echo "Pass Rate: $pass_rate%"

if [ $passed_tests -eq $total_tests ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED! Local development environment is healthy.${NC}"
    exit 0
else
    echo -e "${RED}⚠️  SOME TESTS FAILED. Please check the failed services.${NC}"
    exit 1
fi