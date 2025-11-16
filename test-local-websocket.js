#!/usr/bin/env node

// Test local WebSocket functionality
const WebSocket = require('ws');

const LOCAL_WS = 'ws://localhost:8001/ws';

console.log('🔌 Testing Local WebSocket Implementation\n');

function testLocalWebSocket() {
  return new Promise((resolve) => {
    console.log('📡 Connecting to local WebSocket server...');
    
    const ws = new WebSocket(LOCAL_WS);
    let features = {
      connection: false,
      ping: false,
      presence: false,
      notifications: false
    };
    
    const startTime = Date.now();
    
    const timeout = setTimeout(() => {
      ws.close();
      resolve(features);
    }, 5000);
    
    ws.on('open', () => {
      features.connection = true;
      const connectTime = Date.now() - startTime;
      console.log(`   ✅ Connected in ${connectTime}ms`);
      
      // Test ping
      console.log('   🏓 Testing ping...');
      ws.send(JSON.stringify({ type: 'ping' }));
      
      // Test presence
      setTimeout(() => {
        console.log('   👤 Testing presence...');
        ws.send(JSON.stringify({ 
          type: 'presence',
          status: 'online'
        }));
      }, 1000);
      
      // Test notifications
      setTimeout(() => {
        console.log('   🔔 Testing notifications...');
        ws.send(JSON.stringify({ 
          type: 'subscribe',
          channel: 'notifications'
        }));
      }, 2000);
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log(`   📨 Received: ${message.type}`);
        
        switch(message.type) {
          case 'pong':
            features.ping = true;
            console.log(`   ✅ Ping/Pong: Working`);
            break;
          case 'presence_update':
            features.presence = true;
            console.log(`   ✅ Presence: Working`);
            break;
          case 'notification':
            features.notifications = true;
            console.log(`   ✅ Notifications: Working`);
            break;
          case 'connected':
            console.log(`   🎉 Connection confirmed by server`);
            break;
          default:
            console.log(`   📋 Message type: ${message.type}`);
        }
      } catch (e) {
        console.log(`   📨 Raw message: ${data}`);
      }
    });
    
    ws.on('error', (error) => {
      console.log(`   ❌ Error: ${error.message}`);
      clearTimeout(timeout);
      resolve(features);
    });
    
    ws.on('close', (code, reason) => {
      console.log(`   🔒 Connection closed (${code})`);
      clearTimeout(timeout);
      resolve(features);
    });
  });
}

async function runLocalTest() {
  const results = await testLocalWebSocket();
  
  console.log('\n🔌 LOCAL WEBSOCKET SUMMARY\n');
  
  console.log('📊 FEATURE STATUS:');
  console.log('┌─────────────────────────────────────────┐');
  console.log('│ FEATURE         │ STATUS              │');
  console.log('├─────────────────────────────────────────┤');
  console.log(`│ Connection      │ ${results.connection ? '✅ Working' : '❌ Failed'}          │`);
  console.log(`│ Ping/Pong       │ ${results.ping ? '✅ Working' : '❌ Failed'}          │`);
  console.log(`│ Presence        │ ${results.presence ? '✅ Working' : '❌ Failed'}          │`);
  console.log(`│ Notifications   │ ${results.notifications ? '✅ Working' : '❌ Failed'}          │`);
  console.log('└─────────────────────────────────────────┘');
  
  const workingCount = Object.values(results).filter(Boolean).length;
  console.log(`\n🎯 WEBSOCKET HEALTH: ${workingCount}/4 features working`);
  
  if (results.connection) {
    console.log('\n✅ LOCAL WEBSOCKET: OPERATIONAL');
    console.log('🔧 DEPLOYMENT ISSUE: Production WebSocket needs debugging');
    console.log('💡 RECOMMENDATION: Check Deno Deploy WebSocket configuration');
  } else {
    console.log('\n❌ LOCAL WEBSOCKET: FAILED');
    console.log('🔧 ACTION NEEDED: Fix WebSocket implementation');
  }
}

runLocalTest().catch(console.error);