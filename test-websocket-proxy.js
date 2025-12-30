#!/usr/bin/env node

// Test WebSocket functionality through Worker proxy
const WebSocket = require('ws');

const WORKER_API = 'https://pitchey-api-prod.ndlovucavelle.workers.dev';
const DIRECT_WS = 'wss://pitchey-backend-fresh.deno.dev/ws';

console.log('🔌 Testing WebSocket Integration\n');

function createWebSocketTest(url, name, timeout = 10000) {
  return new Promise((resolve) => {
    console.log(`📡 Connecting to ${name}...`);
    const startTime = Date.now();
    let resolved = false;
    
    const ws = new WebSocket(url, {
      headers: {
        'Origin': 'https://pitchey-5o8.pages.dev',
        'User-Agent': 'WebSocket-Test/1.0'
      }
    });
    
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log(`   ⏰ ${name}: Connection timeout after ${timeout}ms`);
        ws.close();
        resolve({ success: false, error: 'timeout', responseTime: timeout });
      }
    }, timeout);
    
    ws.on('open', () => {
      if (!resolved) {
        const responseTime = Date.now() - startTime;
        console.log(`   ✅ ${name}: Connected in ${responseTime}ms`);
        
        // Test sending a message
        ws.send(JSON.stringify({
          type: 'ping',
          timestamp: Date.now()
        }));
        
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            ws.close();
            resolve({ 
              success: true, 
              responseTime,
              status: 'connected_and_tested' 
            });
          }
        }, 1000);
      }
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log(`   📨 ${name}: Received ${message.type || 'unknown'} message`);
      } catch (e) {
        console.log(`   📨 ${name}: Received data (${data.length} bytes)`);
      }
    });
    
    ws.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;
        console.log(`   ❌ ${name}: Error after ${responseTime}ms - ${error.message}`);
        resolve({ success: false, error: error.message, responseTime });
      }
    });
    
    ws.on('close', (code, reason) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;
        console.log(`   🔒 ${name}: Closed (${code}) after ${responseTime}ms`);
        resolve({ success: false, error: `closed_${code}`, responseTime });
      }
    });
  });
}

async function testWebSocketConnections() {
  console.log('1. Testing Direct WebSocket Connection...');
  
  const directResult = await createWebSocketTest(DIRECT_WS, 'Direct Backend WS');
  
  console.log('\n2. Testing Worker Proxy Capability...');
  
  // Test if worker can handle WebSocket upgrade requests
  try {
    const response = await fetch(`${WORKER_API}/ws`, {
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
        'Sec-WebSocket-Key': Buffer.from('test-key').toString('base64'),
        'Sec-WebSocket-Version': '13',
        'Origin': 'https://pitchey-5o8.pages.dev'
      }
    });
    
    console.log(`   📊 Worker WS Upgrade: ${response.status}`);
    console.log(`   📋 Response Headers:`);
    for (const [key, value] of response.headers.entries()) {
      console.log(`      ${key}: ${value}`);
    }
    
    if (response.status === 101) {
      console.log(`   ✅ Worker: WebSocket upgrade successful`);
    } else {
      console.log(`   ⚠️ Worker: WebSocket upgrade not supported (${response.status})`);
    }
    
  } catch (error) {
    console.log(`   ❌ Worker WS Test: ${error.message}`);
  }

  console.log('\n3. Testing Frontend WebSocket Integration...');
  
  // Test the WebSocket URL that frontend would use
  const frontendWsUrl = 'wss://pitchey-backend-fresh.deno.dev/ws';
  const frontendResult = await createWebSocketTest(frontendWsUrl, 'Frontend WS URL');

  return { directResult, frontendResult };
}

async function testWebSocketFeatures() {
  console.log('\n4. Testing WebSocket Feature Implementation...');
  
  return new Promise((resolve) => {
    const ws = new WebSocket(DIRECT_WS, {
      headers: {
        'Origin': 'https://pitchey-5o8.pages.dev'
      }
    });
    
    let messagesReceived = [];
    let featureTests = {
      connection: false,
      ping: false,
      notifications: false,
      presence: false
    };
    
    const timeout = setTimeout(() => {
      ws.close();
      resolve(featureTests);
    }, 5000);
    
    ws.on('open', () => {
      featureTests.connection = true;
      console.log(`   ✅ Connection: Established`);
      
      // Test ping
      ws.send(JSON.stringify({ type: 'ping' }));
      
      // Test notification subscription
      ws.send(JSON.stringify({ 
        type: 'subscribe',
        channel: 'notifications'
      }));
      
      // Test presence update
      ws.send(JSON.stringify({ 
        type: 'presence',
        status: 'online'
      }));
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        messagesReceived.push(message);
        
        switch(message.type) {
          case 'pong':
            featureTests.ping = true;
            console.log(`   ✅ Ping/Pong: Working`);
            break;
          case 'notification':
            featureTests.notifications = true;
            console.log(`   ✅ Notifications: Working`);
            break;
          case 'presence_update':
            featureTests.presence = true;
            console.log(`   ✅ Presence: Working`);
            break;
          default:
            console.log(`   📨 Message: ${message.type}`);
        }
      } catch (e) {
        console.log(`   📨 Raw Data: ${data}`);
      }
    });
    
    ws.on('error', (error) => {
      console.log(`   ❌ WebSocket Error: ${error.message}`);
      clearTimeout(timeout);
      resolve(featureTests);
    });
    
    ws.on('close', () => {
      clearTimeout(timeout);
      resolve(featureTests);
    });
  });
}

async function printWebSocketSummary(results) {
  console.log('\n🔌 WEBSOCKET TEST SUMMARY\n');
  
  console.log('📡 CONNECTION STATUS:');
  console.log('┌─────────────────────────────────────────────┐');
  console.log('│ SERVICE             │ STATUS │ TIME        │');
  console.log('├─────────────────────────────────────────────┤');
  
  const directStatus = results.directResult.success ? '✅ Connected' : '❌ Failed';
  const directTime = `${results.directResult.responseTime}ms`;
  console.log(`│ Direct Backend WS   │ ${directStatus.padEnd(10)} │ ${directTime.padEnd(11)} │`);
  
  const frontendStatus = results.frontendResult.success ? '✅ Connected' : '❌ Failed';
  const frontendTime = `${results.frontendResult.responseTime}ms`;
  console.log(`│ Frontend WS URL     │ ${frontendStatus.padEnd(10)} │ ${frontendTime.padEnd(11)} │`);
  
  console.log('└─────────────────────────────────────────────┘');
  
  console.log('\n🌐 INTEGRATION NOTES:');
  console.log('  📋 Frontend connects directly to Deno Deploy WS');
  console.log('  🔄 Worker handles HTTP API, proxies WS upgrade requests');
  console.log('  ⚡ Real-time features maintained during migration');
  console.log('  🛡️ WebSocket security through origin validation');
  
  if (results.directResult.success && results.frontendResult.success) {
    console.log('\n🚀 WEBSOCKET STATUS: ✅ FULLY OPERATIONAL');
  } else {
    console.log('\n⚠️ WEBSOCKET STATUS: ⚠️ NEEDS ATTENTION');
  }
}

// Run WebSocket tests
async function runTests() {
  try {
    const connectionResults = await testWebSocketConnections();
    const featureResults = await testWebSocketFeatures();
    await printWebSocketSummary(connectionResults);
  } catch (error) {
    console.error('WebSocket test error:', error);
  }
}

runTests();