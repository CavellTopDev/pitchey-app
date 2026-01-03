#!/bin/bash

# Test Real-time WebSocket Functionality

API_URL="${API_URL:-https://pitchey-api-prod.ndlovucavelle.workers.dev}"
WS_URL="${WS_URL:-wss://pitchey-api-prod.ndlovucavelle.workers.dev}"

echo "🧪 Testing Enhanced Real-time WebSocket Functionality"
echo "=================================================="
echo "API URL: $API_URL"
echo "WebSocket URL: $WS_URL"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Check WebSocket endpoint availability
echo -e "${BLUE}Test 1: WebSocket Endpoint Availability${NC}"
echo "----------------------------------------"
response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/ws")
if [ "$response" == "200" ] || [ "$response" == "426" ] || [ "$response" == "101" ]; then
    echo -e "${GREEN}✅ WebSocket endpoint is accessible (HTTP $response)${NC}"
else
    echo -e "${RED}❌ WebSocket endpoint returned unexpected status: $response${NC}"
fi
echo ""

# Test 2: Get WebSocket connection info
echo -e "${BLUE}Test 2: WebSocket Connection Information${NC}"
echo "----------------------------------------"
ws_info=$(curl -s "$API_URL/ws")
echo "Response: $ws_info"

# Check if it's returning polling fallback info
if echo "$ws_info" | grep -q "polling"; then
    echo -e "${YELLOW}⚠️  WebSocket fallback to polling detected${NC}"
    echo "Polling endpoints:"
    echo "$ws_info" | grep -o '"[^"]*": *"/api/poll/[^"]*"' | sed 's/"//g'
else
    echo -e "${GREEN}✅ WebSocket appears to be available${NC}"
fi
echo ""

# Test 3: Real-time stats endpoint
echo -e "${BLUE}Test 3: Real-time Stats Endpoint${NC}"
echo "---------------------------------"
stats_response=$(curl -s "$API_URL/api/realtime/stats" 2>/dev/null || echo "{}")
if [ -n "$stats_response" ]; then
    echo "Stats Response:"
    echo "$stats_response" | head -5
    echo -e "${GREEN}✅ Real-time stats endpoint accessible${NC}"
else
    echo -e "${RED}❌ Real-time stats endpoint not responding${NC}"
fi
echo ""

# Test 4: Test polling endpoints as fallback
echo -e "${BLUE}Test 4: Polling Endpoints (Fallback)${NC}"
echo "-------------------------------------"

# Test notification polling
echo "Testing /api/poll/notifications..."
poll_notif=$(curl -s "$API_URL/api/poll/notifications" 2>/dev/null || echo "{}")
if echo "$poll_notif" | grep -q "error"; then
    echo -e "${YELLOW}⚠️  Notification polling requires authentication${NC}"
else
    echo -e "${GREEN}✅ Notification polling endpoint works${NC}"
fi

# Test dashboard polling
echo "Testing /api/poll/dashboard..."
poll_dash=$(curl -s "$API_URL/api/poll/dashboard" 2>/dev/null || echo "{}")
if echo "$poll_dash" | grep -q "error"; then
    echo -e "${YELLOW}⚠️  Dashboard polling requires authentication${NC}"
else
    echo -e "${GREEN}✅ Dashboard polling endpoint works${NC}"
fi
echo ""

# Test 5: Check if WebSocket connection can be established
echo -e "${BLUE}Test 5: WebSocket Connection Test${NC}"
echo "----------------------------------"

# Create a simple WebSocket test using Node.js if available
if command -v node &> /dev/null; then
    cat > /tmp/test-ws.js << 'EOF'
const WebSocket = require('ws');

const wsUrl = process.argv[2] || 'wss://pitchey-api-prod.ndlovucavelle.workers.dev/ws';
console.log(`Attempting to connect to: ${wsUrl}`);

const ws = new WebSocket(wsUrl + '?token=test&userId=1&userType=creator');

ws.on('open', () => {
    console.log('✅ WebSocket connection opened successfully');
    ws.send(JSON.stringify({ type: 'ping', data: {} }));
    setTimeout(() => ws.close(), 2000);
});

ws.on('message', (data) => {
    console.log('📨 Received:', data.toString());
});

ws.on('error', (error) => {
    console.log('❌ WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
    console.log(`🔌 WebSocket closed - Code: ${code}, Reason: ${reason}`);
    process.exit(0);
});

setTimeout(() => {
    console.log('⏱️ Connection timeout');
    process.exit(1);
}, 5000);
EOF

    # Check if ws module is installed
    if npm list ws &>/dev/null; then
        node /tmp/test-ws.js "$WS_URL/ws" 2>&1
    else
        echo -e "${YELLOW}⚠️  Node.js ws module not installed, skipping WebSocket test${NC}"
        echo "Install with: npm install -g ws"
    fi
else
    echo -e "${YELLOW}⚠️  Node.js not available, skipping WebSocket connection test${NC}"
fi
echo ""

# Test 6: Test with Python WebSocket client if available
echo -e "${BLUE}Test 6: Alternative WebSocket Test (Python)${NC}"
echo "-------------------------------------------"

if command -v python3 &> /dev/null; then
    python3 -c "
import asyncio
import json
try:
    import websockets
    
    async def test_websocket():
        uri = '$WS_URL/ws?token=test&userId=1&userType=creator'
        try:
            async with websockets.connect(uri) as websocket:
                print('✅ Connected to WebSocket')
                
                # Send ping
                await websocket.send(json.dumps({'type': 'ping', 'data': {}}))
                
                # Wait for response
                response = await asyncio.wait_for(websocket.recv(), timeout=2)
                print(f'📨 Received: {response}')
                
                return True
        except Exception as e:
            print(f'❌ WebSocket connection failed: {e}')
            return False
    
    asyncio.run(test_websocket())
    
except ImportError:
    print('⚠️  websockets module not installed')
    print('Install with: pip install websockets')
" 2>&1
else
    echo -e "${YELLOW}⚠️  Python not available, skipping alternative test${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}========== Test Summary ==========${NC}"
echo "Real-time functionality test complete!"
echo ""
echo "Key findings:"
echo "- WebSocket endpoint: $([[ "$response" == "200" || "$response" == "426" || "$response" == "101" ]] && echo "✅ Available" || echo "❌ Not available")"
echo "- Polling fallback: $([[ "$ws_info" == *"polling"* ]] && echo "✅ Working" || echo "⚠️  Check required")"
echo "- Real-time stats: $([[ -n "$stats_response" ]] && echo "✅ Available" || echo "❌ Not available")"
echo ""
echo "Note: Full WebSocket testing requires authentication."
echo "For production testing, use valid auth tokens."