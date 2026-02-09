#!/bin/bash

# Test script to verify pitch viewing functionality on production
echo "🔍 Testing Pitch Viewing Functionality on pitchey-5o8.pages.dev"
echo "=========================================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test API endpoints
API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"

echo -e "\n${YELLOW}1. Testing Public Pitches Endpoint${NC}"
echo "GET $API_URL/api/pitches/public"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/pitches/public")
http_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ Status: $http_code OK${NC}"
    
    # Check if response contains pitch data
    if echo "$body" | grep -q '"id"'; then
        echo -e "${GREEN}✓ Response contains pitch data${NC}"
        
        # Count pitches in response
        pitch_count=$(echo "$body" | grep -o '"id"' | wc -l)
        echo -e "${GREEN}✓ Found $pitch_count pitches${NC}"
    else
        echo -e "${RED}✗ Response doesn't contain expected pitch data${NC}"
        echo "Response: $body" | head -c 200
    fi
else
    echo -e "${RED}✗ Status: $http_code${NC}"
    echo "Response: $body" | head -c 200
fi

echo -e "\n${YELLOW}2. Testing Trending Endpoint${NC}"
echo "GET $API_URL/api/trending"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/trending")
http_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ Status: $http_code OK${NC}"
    
    # Check if response is valid
    if echo "$body" | grep -q '\[' || echo "$body" | grep -q '"data"'; then
        echo -e "${GREEN}✓ Response structure looks valid${NC}"
    else
        echo -e "${YELLOW}⚠ Response might be empty or malformed${NC}"
    fi
else
    echo -e "${RED}✗ Status: $http_code${NC}"
    echo "Response: $body" | head -c 200
fi

echo -e "\n${YELLOW}3. Testing Search Endpoint${NC}"
echo "GET $API_URL/api/search?q=test"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/search?q=test")
http_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ Status: $http_code OK${NC}"
else
    echo -e "${RED}✗ Status: $http_code${NC}"
fi

echo -e "\n${YELLOW}4. Testing Frontend Access${NC}"
echo "GET https://pitchey-5o8.pages.dev"
frontend_response=$(curl -s -o /dev/null -w "%{http_code}" "https://pitchey-5o8.pages.dev")

if [ "$frontend_response" = "200" ]; then
    echo -e "${GREEN}✓ Frontend is accessible (Status: $frontend_response)${NC}"
else
    echo -e "${RED}✗ Frontend returned status: $frontend_response${NC}"
fi

echo -e "\n${YELLOW}5. Testing Individual Pitch Access${NC}"
echo "GET $API_URL/api/pitches/public/1"
response=$(curl -s -w "\n%{http_code}" "$API_URL/api/pitches/public/1")
http_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" = "200" ] || [ "$http_code" = "404" ]; then
    echo -e "${GREEN}✓ Endpoint is responding (Status: $http_code)${NC}"
    
    if [ "$http_code" = "200" ] && echo "$body" | grep -q '"id"'; then
        echo -e "${GREEN}✓ Can fetch individual pitch data${NC}"
    fi
else
    echo -e "${RED}✗ Unexpected status: $http_code${NC}"
fi

echo -e "\n${YELLOW}========== Test Summary ==========${NC}"
echo "The API endpoints are being tested to ensure:"
echo "1. Public pitches can be fetched"
echo "2. Trending endpoint responds correctly"
echo "3. Search functionality works"
echo "4. Frontend is accessible"
echo "5. Individual pitches can be retrieved"

echo -e "\n${GREEN}Testing complete!${NC}"
echo "If all tests pass, users should be able to view pitches on https://pitchey-5o8.pages.dev"