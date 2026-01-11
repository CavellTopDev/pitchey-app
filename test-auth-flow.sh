#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Testing Authentication Flow${NC}"
echo "======================================"

# Test 1: Login as creator
echo -e "\n${BLUE}1. Testing login as creator${NC}"
COOKIE_JAR=$(mktemp)

# Make login request and capture response
RESPONSE=$(curl -s -X POST http://localhost:8001/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -c "$COOKIE_JAR" \
  -D - \
  -d '{
    "email": "alex.creator@demo.com",
    "password": "Demo123",
    "userType": "creator"
  }')

echo "Response headers:"
echo "$RESPONSE" | head -20

echo -e "\nResponse body:"
echo "$RESPONSE" | tail -n 1 | jq .

echo -e "\n${BLUE}2. Checking cookies set by login${NC}"
echo "Cookies in jar:"
cat "$COOKIE_JAR"

echo -e "\n${BLUE}3. Testing /api/auth/session endpoint${NC}"
SESSION_RESPONSE=$(curl -s http://localhost:8001/api/auth/session \
  -b "$COOKIE_JAR" \
  -H "Accept: application/json")

echo "Session response:"
echo "$SESSION_RESPONSE" | jq .

echo -e "\n${BLUE}4. Testing protected endpoint /api/creator/dashboard${NC}"
DASHBOARD_RESPONSE=$(curl -s http://localhost:8001/api/creator/dashboard \
  -b "$COOKIE_JAR" \
  -H "Accept: application/json")

echo "Dashboard response:"
echo "$DASHBOARD_RESPONSE" | jq .

# Clean up
rm "$COOKIE_JAR"

echo -e "\n${BLUE}Test complete!${NC}"
