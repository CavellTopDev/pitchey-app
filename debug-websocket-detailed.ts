// Detailed WebSocket debugging to identify why connections still fail
// This will help us understand what's happening after the fix

async function debugWebSocketConnection() {
  console.log('🔍 DETAILED WEBSOCKET DEBUG ANALYSIS');
  console.log('=====================================');
  
  // Step 1: Get a valid token
  console.log('Step 1: Getting authentication token...');
  
  const authResponse = await fetch('https://pitchey-backend-fresh.deno.dev/api/auth/creator/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alex.creator@demo.com',
      password: 'Demo123'
    })
  });
  
  if (!authResponse.ok) {
    console.error('❌ Authentication failed:', authResponse.status);
    return;
  }
  
  const authData = await authResponse.json();
  const token = authData.token;
  
  console.log('✅ Authentication successful');
  console.log(`Token: ${token.substring(0, 50)}...`);
  console.log(`User: ${authData.user?.firstName} ${authData.user?.lastName}`);
  
  // Step 2: Decode the JWT to understand its structure
  console.log('\nStep 2: JWT Token Analysis');
  try {
    const [header, payload, signature] = token.split('.');
    const decodedPayload = JSON.parse(atob(payload));
    
    console.log('📄 JWT Payload Structure:');
    console.log(JSON.stringify(decodedPayload, null, 2));
    
    // Check if 'sub' field exists (this is what we fixed)
    if (decodedPayload.sub) {
      console.log(`✅ 'sub' field found: ${decodedPayload.sub}`);
    } else {
      console.log(`❌ 'sub' field missing!`);
    }
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (decodedPayload.exp && decodedPayload.exp > now) {
      console.log(`✅ Token not expired (exp: ${decodedPayload.exp}, now: ${now})`);
    } else {
      console.log(`❌ Token expired! (exp: ${decodedPayload.exp}, now: ${now})`);
    }
    
  } catch (error) {
    console.error('❌ Failed to decode JWT:', error);
  }
  
  // Step 3: Test WebSocket connection with detailed error handling
  console.log('\nStep 3: WebSocket Connection Test');
  
  return new Promise((resolve) => {
    const wsUrl = `wss://pitchey-backend-fresh.deno.dev/ws?token=${token}`;
    console.log(`🔌 Connecting to: ${wsUrl.substring(0, 80)}...`);
    
    const ws = new WebSocket(wsUrl);
    
    const timeout = setTimeout(() => {
      console.log('⏱️ Connection timeout after 10 seconds');
      ws.close();
      resolve('timeout');
    }, 10000);
    
    ws.onopen = () => {
      clearTimeout(timeout);
      console.log('🎉 WebSocket OPENED successfully!');
      
      // Send a test message
      const testMessage = {
        type: 'ping',
        timestamp: Date.now()
      };
      
      ws.send(JSON.stringify(testMessage));
      console.log('📤 Sent test message:', testMessage);
      
      setTimeout(() => {
        ws.close();
        resolve('success');
      }, 2000);
    };
    
    ws.onmessage = (event) => {
      console.log('📨 Received message:', event.data);
    };
    
    ws.onclose = (event) => {
      clearTimeout(timeout);
      console.log(`🔒 WebSocket CLOSED`);
      console.log(`   Code: ${event.code}`);
      console.log(`   Reason: "${event.reason}"`);
      console.log(`   Was Clean: ${event.wasClean}`);
      
      // Decode close codes
      const closeCodes = {
        1000: 'Normal Closure',
        1001: 'Going Away', 
        1002: 'Protocol Error',
        1003: 'Unsupported Data',
        1004: 'Reserved',
        1005: 'No Status Received',
        1006: 'Abnormal Closure',
        1007: 'Invalid frame payload data',
        1008: 'Policy Violation',
        1009: 'Message Too Big',
        1010: 'Mandatory Extension',
        1011: 'Internal Server Error',
        1015: 'TLS Handshake'
      };
      
      const codeDescription = closeCodes[event.code] || 'Unknown';
      console.log(`   Code Description: ${codeDescription}`);
      
      if (event.code === 1006) {
        console.log('⚠️ Abnormal closure - likely connection refused or network error');
      } else if (event.code >= 4000) {
        console.log('⚠️ Custom application error code');
      }
      
      resolve(`closed_${event.code}`);
    };
    
    ws.onerror = (error) => {
      clearTimeout(timeout);
      console.log('❌ WebSocket ERROR occurred');
      console.log('   Error event:', error);
      console.log('   Error type:', typeof error);
      console.log('   Error keys:', Object.keys(error));
      
      if (error.message) {
        console.log('   Error message:', error.message);
      }
      
      resolve('error');
    };
  });
}

// Run the debug
if (import.meta.main) {
  debugWebSocketConnection().then(result => {
    console.log('\n🏁 FINAL RESULT:', result);
    console.log('=====================================');
  });
}