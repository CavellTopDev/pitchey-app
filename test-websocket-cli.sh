#!/bin/bash

# WebSocket CLI Testing Script
echo "🔌 WebSocket Testing Script"
echo "═══════════════════════════════════════════"

WS_URL="wss://pitchey-backend-fresh-dpgqq3t2wr6w.deno.dev/ws"

echo -e "\n1. Testing WebSocket Server Health"
curl -s "https://pitchey-backend-fresh-dpgqq3t2wr6w.deno.dev/api/health" | jq '.'

echo -e "\n2. WebSocket Connection Test with Node.js"
cat > /tmp/ws-test.js << 'EOF'
const WebSocket = require('ws');
const ws = new WebSocket('wss://pitchey-backend-fresh-dpgqq3t2wr6w.deno.dev/ws');

ws.on('open', function open() {
  console.log('✅ Connected to WebSocket');
  
  // Send ping
  ws.send(JSON.stringify({type: 'ping', timestamp: Date.now()}));
  console.log('📤 Sent: ping');
  
  // Send test message
  setTimeout(() => {
    ws.send(JSON.stringify({type: 'test', message: 'Hello from CLI'}));
    console.log('📤 Sent: test message');
  }, 1000);
  
  // Close after 3 seconds
  setTimeout(() => {
    ws.close();
    console.log('🔒 Connection closed');
  }, 3000);
});

ws.on('message', function message(data) {
  const msg = JSON.parse(data.toString());
  console.log('📥 Received:', msg.type || 'unknown', '-', msg.message || msg);
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket Error:', err.message);
});
EOF

echo "Running WebSocket test..."
cd /tmp && npm install ws 2>/dev/null && node ws-test.js

echo -e "\n3. Testing with wscat (interactive)"
echo "To test interactively, run:"
echo "wscat -c '$WS_URL'"
echo ""
echo "Then type these messages:"
echo '{"type":"ping","timestamp":1700000000}'
echo '{"type":"test","message":"Hello WebSocket"}'
echo ""

echo "4. Python WebSocket Test (alternative)"
cat > /tmp/ws-test.py << 'EOF'
import websocket
import json
import time

def on_message(ws, message):
    print(f"📥 Received: {message}")

def on_error(ws, error):
    print(f"❌ Error: {error}")

def on_close(ws, close_status_code, close_msg):
    print("🔒 Connection closed")

def on_open(ws):
    print("✅ Connected to WebSocket")
    ws.send(json.dumps({"type": "ping", "timestamp": int(time.time())}))
    print("📤 Sent: ping")
    time.sleep(1)
    ws.send(json.dumps({"type": "test", "message": "Hello from Python"}))
    print("📤 Sent: test message")
    time.sleep(2)
    ws.close()

if __name__ == "__main__":
    ws = websocket.WebSocketApp("wss://pitchey-backend-fresh-dpgqq3t2wr6w.deno.dev/ws",
                                on_open=on_open,
                                on_message=on_message,
                                on_error=on_error,
                                on_close=on_close)
    ws.run_forever()
EOF

echo -e "\nTo run Python test:"
echo "pip install websocket-client"
echo "python /tmp/ws-test.py"