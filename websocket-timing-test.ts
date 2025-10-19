// WebSocket Timing Analysis
// Check if there are timing issues causing test failures

async function testWebSocketTiming() {
  console.log('⏱️ WEBSOCKET TIMING ANALYSIS');
  console.log('═══════════════════════════════');
  
  // Get auth token
  const authResponse = await fetch('https://pitchey-backend-fresh.deno.dev/api/auth/creator/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alex.creator@demo.com', password: 'Demo123' })
  });
  
  const authData = await authResponse.json();
  const token = authData.token;
  
  console.log('✅ Got auth token');
  
  // Test different timeout values
  const timeouts = [2000, 5000, 10000, 15000];
  
  for (const timeout of timeouts) {
    console.log(`\n🔌 Testing with ${timeout}ms timeout...`);
    
    const result = await new Promise((resolve) => {
      const startTime = Date.now();
      const ws = new WebSocket(`wss://pitchey-backend-fresh.deno.dev/ws?token=${token}`);
      
      let connected = false;
      let messagesReceived = 0;
      let firstMessageTime = 0;
      let lastMessageTime = 0;
      
      const timeoutHandle = setTimeout(() => {
        const duration = Date.now() - startTime;
        console.log(`  ⏱️ Timeout reached after ${duration}ms`);
        console.log(`  📊 Connected: ${connected}, Messages: ${messagesReceived}`);
        
        if (ws.readyState !== WebSocket.CLOSED) {
          ws.close();
        }
        resolve({ 
          timeout: true, 
          connected, 
          messages: messagesReceived, 
          duration,
          firstMessageDelay: firstMessageTime > 0 ? firstMessageTime - startTime : 0
        });
      }, timeout);
      
      ws.onopen = () => {
        connected = true;
        const openTime = Date.now() - startTime;
        console.log(`  🎉 Connected in ${openTime}ms`);
        
        // Send test message
        ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      };
      
      ws.onmessage = (event) => {
        messagesReceived++;
        const messageTime = Date.now();
        
        if (firstMessageTime === 0) {
          firstMessageTime = messageTime;
          console.log(`  📨 First message received in ${messageTime - startTime}ms`);
        }
        lastMessageTime = messageTime;
        
        console.log(`  📨 Message ${messagesReceived}: ${event.data.substring(0, 50)}...`);
      };
      
      ws.onclose = (event) => {
        clearTimeout(timeoutHandle);
        const duration = Date.now() - startTime;
        
        console.log(`  🔒 Connection closed in ${duration}ms (Code: ${event.code})`);
        console.log(`  📊 Final: Connected: ${connected}, Messages: ${messagesReceived}`);
        
        resolve({ 
          timeout: false, 
          connected, 
          messages: messagesReceived, 
          duration,
          closeCode: event.code,
          firstMessageDelay: firstMessageTime > 0 ? firstMessageTime - startTime : 0
        });
      };
      
      ws.onerror = (error) => {
        clearTimeout(timeoutHandle);
        const duration = Date.now() - startTime;
        
        console.log(`  ❌ Error occurred in ${duration}ms`);
        resolve({ 
          timeout: false, 
          connected: false, 
          messages: messagesReceived, 
          duration,
          error: true
        });
      };
    });
    
    console.log(`  🏁 Result: ${JSON.stringify(result, null, 2)}`);
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n═══════════════════════════════');
  console.log('⏱️ Timing analysis complete');
}

if (import.meta.main) {
  testWebSocketTiming().catch(console.error);
}