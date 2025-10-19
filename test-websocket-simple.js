#!/usr/bin/env node

const WebSocket = require('ws');

// Token from login
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWxleC5jcmVhdG9yQGRlbW8uY29tIiwidXNlclR5cGUiOiJjcmVhdG9yIiwiZXhwIjoxNzYwNzQyMjk1fQ.uQhUJm-udUHKdFD5FHL9nA11kOhmRNPK1lMRiv7k4YA";

const wsUrl = `ws://localhost:8001/ws?token=${token}`;

console.log('🔌 Testing WebSocket connection to:', wsUrl.replace(/token=.*/, 'token=<hidden>'));

const ws = new WebSocket(wsUrl);

ws.on('open', function open() {
  console.log('✅ WebSocket connection opened successfully!');
  
  // Send a test message
  const testMessage = {
    type: 'ping',
    timestamp: new Date().toISOString(),
    data: { test: true }
  };
  
  console.log('📤 Sending test message:', testMessage);
  ws.send(JSON.stringify(testMessage));
});

ws.on('message', function message(data) {
  console.log('📨 Received message:', data.toString());
  try {
    const parsed = JSON.parse(data.toString());
    console.log('📦 Parsed message:', JSON.stringify(parsed, null, 2));
  } catch (e) {
    console.log('⚠️ Could not parse as JSON:', e.message);
  }
});

ws.on('close', function close(code, reason) {
  console.log(`🔌 WebSocket closed - Code: ${code}, Reason: "${reason}"`);
  
  // Log specific close codes
  switch(code) {
    case 1000:
      console.log('✅ Normal closure');
      break;
    case 1001:
      console.log('ℹ️ Going away (page refresh or navigation)');
      break;
    case 1002:
      console.log('❌ Protocol error');
      break;
    case 1003:
      console.log('❌ Unsupported data type');
      break;
    case 1006:
      console.log('❌ ABNORMAL CLOSURE - This is the error we\'re investigating!');
      console.log('   Possible causes: Server error, network issue, or premature connection termination');
      break;
    case 1008:
      console.log('❌ Policy violation (often authentication related)');
      break;
    case 1011:
      console.log('❌ Server error');
      break;
    default:
      if (code >= 4000) {
        console.log(`❌ Custom application error: ${code}`);
      } else {
        console.log(`⚠️ Unknown close code: ${code}`);
      }
  }
  
  process.exit(code === 1000 ? 0 : 1);
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err);
  console.error('   ReadyState:', ws.readyState);
  console.error('   URL:', ws.url);
});

// Timeout after 10 seconds
setTimeout(() => {
  if (ws.readyState === WebSocket.CONNECTING) {
    console.log('⏰ Connection timeout - closing');
    ws.close();
  }
}, 10000);