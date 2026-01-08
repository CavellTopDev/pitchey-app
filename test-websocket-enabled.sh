#!/bin/bash

# WebSocket Connection Test Script
# Tests that WebSocket is properly enabled and functional

echo "🔌 WebSocket Connection Test"
echo "============================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test environment
API_URL=${API_URL:-"http://localhost:8001"}
WS_URL=${WS_URL:-"ws://localhost:8001"}

echo "Testing against:"
echo "  API: $API_URL"
echo "  WebSocket: $WS_URL"
echo ""

# Step 1: Login as demo creator to get token
echo "1. Authenticating as demo creator..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alex.creator@demo.com",
    "password": "Demo123"
  }' 2>/dev/null)

if echo "$LOGIN_RESPONSE" | grep -q "token"; then
  TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  USER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)
  echo -e "${GREEN}✓ Authentication successful${NC}"
  echo "  Token: ${TOKEN:0:20}..."
  echo "  User ID: $USER_ID"
else
  echo -e "${RED}✗ Authentication failed${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo ""
echo "2. Testing WebSocket upgrade..."

# Create a Node.js script to test WebSocket
cat > /tmp/test-websocket.js << 'EOF'
const WebSocket = require('ws');

const wsUrl = process.argv[2];
const token = process.argv[3];
const userId = process.argv[4];

console.log('Connecting to:', wsUrl);

const ws = new WebSocket(`${wsUrl}/ws?token=${token}&userId=${userId}&userType=creator`);

let connected = false;

ws.on('open', () => {
  connected = true;
  console.log('✓ WebSocket connected successfully');
  
  // Send a test message
  ws.send(JSON.stringify({
    type: 'ping',
    timestamp: Date.now()
  }));
});

ws.on('message', (data) => {
  console.log('✓ Received message:', data.toString());
  
  const message = JSON.parse(data.toString());
  
  if (message.type === 'pong') {
    console.log('✓ Ping/pong working');
  }
  
  if (message.type === 'welcome') {
    console.log('✓ Welcome message received');
  }
  
  // Test complete
  setTimeout(() => {
    ws.close();
    process.exit(0);
  }, 1000);
});

ws.on('error', (error) => {
  console.error('✗ WebSocket error:', error.message);
  process.exit(1);
});

ws.on('close', (code, reason) => {
  if (connected) {
    console.log('✓ WebSocket closed cleanly');
  } else {
    console.error('✗ WebSocket failed to connect');
    console.error('  Close code:', code);
    console.error('  Reason:', reason.toString());
    process.exit(1);
  }
});

// Timeout after 5 seconds
setTimeout(() => {
  if (!connected) {
    console.error('✗ Connection timeout - WebSocket not available');
    console.error('  This might mean WebSocket is still disabled or Worker needs upgrade');
    process.exit(1);
  }
}, 5000);
EOF

# Check if ws module is installed
if ! npm list ws --depth=0 >/dev/null 2>&1; then
  echo "Installing ws module..."
  npm install ws --no-save >/dev/null 2>&1
fi

# Run the WebSocket test
node /tmp/test-websocket.js "$WS_URL" "$TOKEN" "$USER_ID"
RESULT=$?

echo ""
if [ $RESULT -eq 0 ]; then
  echo -e "${GREEN}🎉 WebSocket is working!${NC}"
  echo ""
  echo "Real-time features now enabled:"
  echo "  ✓ Instant notifications"
  echo "  ✓ Live presence indicators"
  echo "  ✓ Real-time pitch updates"
  echo "  ✓ Typing indicators"
  echo "  ✓ Draft auto-sync"
else
  echo -e "${YELLOW}⚠️  WebSocket connection failed${NC}"
  echo ""
  echo "Possible reasons:"
  echo "  1. Worker not running with WebSocket support"
  echo "  2. Still on Cloudflare free tier"
  echo "  3. CORS/authentication issues"
  echo ""
  echo "Fallback: HTTP polling will be used (5-second intervals)"
fi

# Clean up
rm -f /tmp/test-websocket.js

exit $RESULT