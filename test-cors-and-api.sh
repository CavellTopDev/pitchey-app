#!/bin/bash

echo "🔍 Testing CORS and API Configuration"
echo "======================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test CORS preflight
echo -e "\n${YELLOW}1. Testing CORS Preflight Request:${NC}"
CORS_RESPONSE=$(curl -s -I -X OPTIONS http://localhost:8001/api/public/pitches \
  -H "Origin: http://localhost:5174" \
  -H "Access-Control-Request-Method: GET" \
  2>/dev/null | grep -i "access-control")

if [ ! -z "$CORS_RESPONSE" ]; then
  echo -e "${GREEN}✅ CORS Headers Present:${NC}"
  echo "$CORS_RESPONSE"
else
  echo -e "${RED}❌ No CORS headers found${NC}"
fi

# Test public endpoint
echo -e "\n${YELLOW}2. Testing Public API Endpoint:${NC}"
PUBLIC_RESPONSE=$(curl -s -X GET http://localhost:8001/api/public/pitches \
  -H "Origin: http://localhost:5174" \
  -H "Content-Type: application/json")

if echo "$PUBLIC_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Public endpoint working${NC}"
  echo "Response: $(echo "$PUBLIC_RESPONSE" | jq -c '{success, message, data_count: .data | length}')"
else
  echo -e "${RED}❌ Public endpoint failed${NC}"
  echo "$PUBLIC_RESPONSE"
fi

# Test authenticated endpoint (should fail without token)
echo -e "\n${YELLOW}3. Testing Protected Endpoint (without auth):${NC}"
AUTH_RESPONSE=$(curl -s -X GET http://localhost:8001/api/creator/dashboard \
  -H "Origin: http://localhost:5174" \
  -H "Content-Type: application/json")

if echo "$AUTH_RESPONSE" | jq -e '.success == false' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Authentication correctly required${NC}"
  echo "Response: $(echo "$AUTH_RESPONSE" | jq -c '{success, error}')"
else
  echo -e "${RED}❌ Authentication check failed${NC}"
  echo "$AUTH_RESPONSE"
fi

# Test with demo token
echo -e "\n${YELLOW}4. Testing Protected Endpoint (with demo token):${NC}"
# First login to get a real token
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8001/api/auth/creator/login \
  -H "Origin: http://localhost:5174" \
  -H "Content-Type: application/json" \
  -d '{"email": "alex.creator@demo.com", "password": "Demo123"}')

if echo "$LOGIN_RESPONSE" | jq -e '.token' > /dev/null 2>&1; then
  TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')
  echo -e "${GREEN}✅ Login successful, got token${NC}"
  
  # Now test dashboard with real token
  DASHBOARD_RESPONSE=$(curl -s -X GET http://localhost:8001/api/creator/dashboard \
    -H "Origin: http://localhost:5174" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN")
  
  if echo "$DASHBOARD_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Dashboard endpoint working with auth${NC}"
    echo "Response: $(echo "$DASHBOARD_RESPONSE" | jq -c '{success, message}')"
  else
    echo -e "${YELLOW}⚠️  Dashboard endpoint returned:${NC}"
    echo "$DASHBOARD_RESPONSE" | jq '.' 2>/dev/null || echo "$DASHBOARD_RESPONSE"
  fi
else
  echo -e "${RED}❌ Login failed${NC}"
  echo "$LOGIN_RESPONSE"
fi

# Test server health
echo -e "\n${YELLOW}5. Testing Server Health:${NC}"
HEALTH_RESPONSE=$(curl -s http://localhost:8001/api/health)
if echo "$HEALTH_RESPONSE" | jq -e '.status == "healthy"' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Server is healthy${NC}"
else
  echo -e "${RED}❌ Server health check failed${NC}"
fi

echo -e "\n${GREEN}======================================"
echo -e "Testing Complete!${NC}"
echo -e "\n${YELLOW}Summary:${NC}"
echo "• Backend URL: http://localhost:8001"
echo "• Frontend URL: http://localhost:5174"
echo "• CORS: Configured for all origins (*)"
echo -e "\n${YELLOW}If you're still seeing CORS errors in the browser:${NC}"
echo "1. Clear browser cache and cookies"
echo "2. Open DevTools Network tab and check actual request/response"
echo "3. Make sure both servers are running"
echo "4. Check if browser extensions are blocking requests"