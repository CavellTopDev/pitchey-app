// WebSocket Secure (WSS) Connection Test
// Tests secure WebSocket connection to the Pitchey backend

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0"; // Accept self-signed certificates

const WebSocket = require('ws');

const WSS_URL = 'wss://localhost:8001/ws';

console.log('🔐 Testing WebSocket Secure (WSS) connection...');
console.log(`🔗 Connecting to: ${WSS_URL}`);

const ws = new WebSocket(WSS_URL, {
    rejectUnauthorized: false, // Accept self-signed certificates
    timeout: 10000 // 10 second timeout
});

ws.on('open', function() {
    console.log('✅ WSS connection established successfully!');
    
    // Test sending a message
    const testMessage = {
        type: 'ping',
        timestamp: new Date().toISOString()
    };
    
    console.log('📤 Sending test message:', testMessage);
    ws.send(JSON.stringify(testMessage));
    
    // Close after a few seconds
    setTimeout(() => {
        console.log('🔚 Closing connection...');
        ws.close();
    }, 3000);
});

ws.on('message', function(data) {
    try {
        const message = JSON.parse(data);
        console.log('📥 Received message:', message);
    } catch (e) {
        console.log('📥 Received raw data:', data.toString());
    }
});

ws.on('error', function(error) {
    console.error('❌ WebSocket error:', error.message);
    process.exit(1);
});

ws.on('close', function(code, reason) {
    console.log(`🔚 Connection closed: ${code} - ${reason || 'No reason provided'}`);
    
    if (code === 1000) {
        console.log('✅ WSS test completed successfully!');
        process.exit(0);
    } else {
        console.log('⚠️  Connection closed unexpectedly');
        process.exit(1);
    }
});

// Timeout handling
setTimeout(() => {
    if (ws.readyState !== WebSocket.OPEN) {
        console.error('❌ Connection timeout - unable to establish WSS connection');
        ws.terminate();
        process.exit(1);
    }
}, 15000);