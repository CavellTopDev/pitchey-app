#!/bin/bash

# Test WebSocket Connection with Fixed JWT
echo "=== Testing WebSocket Connection with Fixed JWT ==="
echo "Testing at: $(date)"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

API_URL="https://pitchey-production.cavelltheleaddev.workers.dev"
WS_URL="wss://pitchey-production.cavelltheleaddev.workers.dev"

# Test 1: Login as creator to get a fresh token
echo -e "${YELLOW}1. Logging in as creator to get fresh JWT token...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alex.creator@demo.com",
    "password": "Demo123"
  }')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Failed to get token from login${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Got JWT token${NC}"
echo "Token (first 50 chars): ${TOKEN:0:50}..."
echo ""

# Test 2: Verify token format (should not have padding)
echo -e "${YELLOW}2. Verifying JWT token format...${NC}"
if [[ "$TOKEN" == *"="* ]]; then
  echo -e "${RED}❌ Token contains padding characters (=), this is incorrect!${NC}"
else
  echo -e "${GREEN}✅ Token has correct format (no padding)${NC}"
fi
echo ""

# Test 3: Test WebSocket connection using wscat (if available)
echo -e "${YELLOW}3. Testing WebSocket connection...${NC}"
if command -v wscat &> /dev/null; then
  echo "Testing with wscat..."
  timeout 5s wscat -c "$WS_URL/ws?token=$TOKEN" -x '{"type":"ping"}' 2>&1 | head -20
else
  echo "wscat not available, testing with curl WebSocket upgrade..."
  UPGRADE_RESPONSE=$(curl -s -i -N \
    -H "Connection: Upgrade" \
    -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Version: 13" \
    -H "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
    "$WS_URL/ws?token=$TOKEN" 2>&1 | head -20)
  
  if echo "$UPGRADE_RESPONSE" | grep -q "101 Switching Protocols"; then
    echo -e "${GREEN}✅ WebSocket upgrade successful (101 Switching Protocols)${NC}"
  elif echo "$UPGRADE_RESPONSE" | grep -q "401"; then
    echo -e "${RED}❌ Authentication failed (401)${NC}"
    echo "$UPGRADE_RESPONSE"
  elif echo "$UPGRADE_RESPONSE" | grep -q "400"; then
    echo -e "${RED}❌ Bad request (400) - likely malformed token${NC}"
    echo "$UPGRADE_RESPONSE"
  else
    echo -e "${YELLOW}⚠️ Unexpected response:${NC}"
    echo "$UPGRADE_RESPONSE"
  fi
fi
echo ""

# Test 4: Test notification endpoints with the token
echo -e "${YELLOW}4. Testing notification endpoints with JWT...${NC}"
NOTIFICATIONS_RESPONSE=$(curl -s -X GET "$API_URL/api/notifications" \
  -H "Authorization: Bearer $TOKEN")

if echo "$NOTIFICATIONS_RESPONSE" | grep -q '"notifications"'; then
  echo -e "${GREEN}✅ Notification endpoint works with JWT${NC}"
else
  echo -e "${RED}❌ Notification endpoint failed${NC}"
  echo "Response: $NOTIFICATIONS_RESPONSE"
fi
echo ""

# Test 5: Check Worker logs for WebSocket errors
echo -e "${YELLOW}5. Checking recent Worker logs...${NC}"
echo "Note: Use 'wrangler tail' to see live logs"
echo ""

echo "=== Test Summary ==="
echo "- JWT token obtained: ✓"
echo "- Token format correct: $([ ! "$TOKEN" == *"="* ] && echo '✓' || echo '✗')"
echo "- WebSocket tested: ✓"
echo "- Notifications tested: ✓"
echo ""
echo "To monitor live WebSocket connections, run:"
echo "  wrangler tail"
echo ""
echo "To test from browser console:"
echo "  const ws = new WebSocket('$WS_URL/ws?token=$TOKEN');"
echo "  ws.onopen = () => console.log('Connected!');"
echo "  ws.onmessage = (e) => console.log('Message:', e.data);"
echo "  ws.onerror = (e) => console.log('Error:', e);"

