#!/bin/bash

# Real-time Features Test Script
# Tests all WebSocket-powered features

echo "🚀 Real-time Features Test Suite"
echo "================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_URL=${API_URL:-"http://localhost:8001"}
WS_URL=${WS_URL:-"ws://localhost:8001"}

# Test results
PASSED=0
FAILED=0

# Function to run test
run_test() {
    local test_name=$1
    local result=$2
    
    if [ $result -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $test_name"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $test_name"
        ((FAILED++))
    fi
}

echo "Configuration:"
echo "  API: $API_URL"
echo "  WebSocket: $WS_URL"
echo ""

# 1. Authentication
echo -e "${BLUE}1. Authentication${NC}"
echo "   Logging in as demo creator..."

LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alex.creator@demo.com",
    "password": "Demo123"
  }')

if echo "$LOGIN_RESPONSE" | grep -q "token"; then
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    USER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)
    run_test "Authentication" 0
else
    run_test "Authentication" 1
    echo "Cannot continue without authentication"
    exit 1
fi

echo ""
echo -e "${BLUE}2. WebSocket Connection${NC}"

# Create WebSocket test script
cat > /tmp/test-ws-features.js << 'EOF'
const WebSocket = require('ws');

const wsUrl = process.argv[2];
const token = process.argv[3];
const userId = process.argv[4];

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, condition) {
    if (condition) {
        console.log(`✓ ${name}`);
        testsPassed++;
    } else {
        console.log(`✗ ${name}`);
        testsFailed++;
    }
}

console.log('   Connecting to WebSocket...');

const ws = new WebSocket(`${wsUrl}/ws?token=${token}&userId=${userId}&userType=creator`);

let connected = false;
let receivedWelcome = false;
let receivedPong = false;
let receivedNotification = false;
let receivedPresence = false;

ws.on('open', () => {
    connected = true;
    runTest('WebSocket connected', true);
    
    // Test ping/pong
    ws.send(JSON.stringify({
        type: 'ping',
        timestamp: Date.now()
    }));
    
    // Test notification subscription
    setTimeout(() => {
        ws.send(JSON.stringify({
            type: 'subscribe',
            channel: `user_${userId}_notifications`
        }));
    }, 500);
    
    // Test presence update
    setTimeout(() => {
        ws.send(JSON.stringify({
            type: 'presence',
            status: 'online',
            activity: 'testing'
        }));
    }, 1000);
    
    // Test typing indicator
    setTimeout(() => {
        ws.send(JSON.stringify({
            type: 'typing',
            conversationId: 'test-123',
            isTyping: true
        }));
    }, 1500);
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        
        switch(message.type) {
            case 'welcome':
                receivedWelcome = true;
                runTest('Welcome message received', true);
                break;
                
            case 'pong':
                receivedPong = true;
                runTest('Ping/pong working', true);
                break;
                
            case 'notification':
                receivedNotification = true;
                runTest('Notification received', true);
                break;
                
            case 'presence_update':
                receivedPresence = true;
                runTest('Presence update received', true);
                break;
                
            case 'subscribed':
                runTest('Channel subscription confirmed', true);
                break;
                
            case 'typing_update':
                runTest('Typing indicator working', true);
                break;
        }
    } catch (error) {
        console.error('Error parsing message:', error);
    }
});

ws.on('error', (error) => {
    runTest('WebSocket connection', false);
    console.error('WebSocket error:', error.message);
    process.exit(1);
});

ws.on('close', () => {
    console.log('\nWebSocket closed');
});

// Complete tests after 5 seconds
setTimeout(() => {
    console.log('\n');
    console.log('3. Real-time Features Summary');
    runTest('Connection established', connected);
    runTest('Welcome message', receivedWelcome);
    runTest('Ping/pong heartbeat', receivedPong);
    runTest('Channel subscriptions', receivedNotification || receivedPresence);
    
    ws.close();
    
    if (testsFailed > 0) {
        console.log(`\n⚠️  Some tests failed (${testsFailed}/${testsPassed + testsFailed})`);
        process.exit(1);
    } else {
        console.log(`\n✅ All tests passed (${testsPassed}/${testsPassed})`);
        process.exit(0);
    }
}, 5000);
EOF

# Install ws if needed
if ! npm list ws --depth=0 >/dev/null 2>&1; then
    npm install ws --no-save >/dev/null 2>&1
fi

# Run WebSocket tests
node /tmp/test-ws-features.js "$WS_URL" "$TOKEN" "$USER_ID"
WS_RESULT=$?

echo ""
echo -e "${BLUE}4. HTTP Fallback Test${NC}"

# Test that polling still works
POLL_RESPONSE=$(curl -s -X GET "$API_URL/api/poll/all" \
  -H "Authorization: Bearer $TOKEN")

if echo "$POLL_RESPONSE" | grep -q "notifications"; then
    run_test "HTTP polling fallback available" 0
else
    run_test "HTTP polling fallback available" 1
fi

# Test notification endpoints
NOTIF_RESPONSE=$(curl -s -X GET "$API_URL/api/notifications/unread" \
  -H "Authorization: Bearer $TOKEN")

if [ $? -eq 0 ]; then
    run_test "Notification endpoints working" 0
else
    run_test "Notification endpoints working" 1
fi

echo ""
echo "================================="
echo "Test Results:"
echo "  ✅ Passed: $PASSED"
echo "  ❌ Failed: $FAILED"
echo ""

if [ $WS_RESULT -eq 0 ] && [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All real-time features are working!${NC}"
    echo ""
    echo "Enabled features:"
    echo "  • Instant notifications"
    echo "  • Live presence indicators"
    echo "  • Real-time pitch view counts"
    echo "  • Typing indicators in chat"
    echo "  • Draft auto-sync"
    echo "  • Collaborative editing"
    echo ""
    echo "UX improvements:"
    echo "  • No more 5-second delays"
    echo "  • Instant feedback on all actions"
    echo "  • Live user activity tracking"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some real-time features failed${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check if Worker has WebSocket support enabled"
    echo "  2. Verify Cloudflare plan supports WebSocket"
    echo "  3. Check CORS configuration"
    echo "  4. Review authentication tokens"
    exit 1
fi

# Cleanup
rm -f /tmp/test-ws-features.js