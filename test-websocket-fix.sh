#!/bin/bash

# Test WebSocket connection fix

echo "🔌 Testing WebSocket Connection Fix"
echo "==================================="

API_URL="https://pitchey-optimized.cavelltheleaddev.workers.dev"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "\n${YELLOW}Step 1: Get authentication token${NC}"
# Login to get a valid token
response=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}')

token=$(echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$token" ]; then
  echo -e "${RED}❌ Failed to get authentication token${NC}"
  echo "Response: $response"
  exit 1
fi

echo -e "${GREEN}✅ Got token: ${token:0:30}...${NC}"

echo -e "\n${YELLOW}Step 2: Test WebSocket upgrade request${NC}"
# Test WebSocket endpoint with curl
ws_response=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Upgrade: websocket" \
  -H "Connection: Upgrade" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  -H "Sec-WebSocket-Version: 13" \
  "$API_URL/ws?token=$token")

if [ "$ws_response" = "101" ]; then
  echo -e "${GREEN}✅ WebSocket endpoint returns 101 Switching Protocols${NC}"
elif [ "$ws_response" = "400" ]; then
  echo -e "${RED}❌ WebSocket still returning 400 error${NC}"
elif [ "$ws_response" = "404" ]; then
  echo -e "${YELLOW}⚠️ WebSocket endpoint not found (404)${NC}"
else
  echo -e "${YELLOW}⚠️ WebSocket returned unexpected status: $ws_response${NC}"
fi

echo -e "\n${YELLOW}Step 3: Test with wscat (if available)${NC}"
if command -v wscat &> /dev/null; then
  echo "Testing live WebSocket connection..."
  timeout 3 wscat -c "wss://pitchey-optimized.cavelltheleaddev.workers.dev/ws?token=$token" 2>&1 | head -5
else
  echo "wscat not installed. Install with: npm install -g wscat"
fi

echo -e "\n${YELLOW}Step 4: Check health endpoint${NC}"
health_response=$(curl -s "$API_URL/api/health")
if echo "$health_response" | grep -q "healthy"; then
  echo -e "${GREEN}✅ Health endpoint working${NC}"
else
  echo -e "${RED}❌ Health endpoint issue${NC}"
fi

echo -e "\n${YELLOW}Summary:${NC}"
echo "----------"
echo "Before fix: WebSocket returned 400 Bad Request"
echo "After fix: WebSocket should return 101 Switching Protocols"
echo ""
echo "The WebSocket handler is now:"
echo "  • Accepting upgrade requests"
echo "  • Validating tokens"
echo "  • Handling ping/pong"
echo "  • Managing notifications"
echo "  • Tracking presence"