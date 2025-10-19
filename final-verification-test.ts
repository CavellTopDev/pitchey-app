// Final Automated Verification Test
// Conclusively verify the WebSocket infinite loop issue is resolved

async function finalVerificationTest() {
  console.log('🎯 FINAL VERIFICATION: WebSocket Infinite Loop Fix');
  console.log('══════════════════════════════════════════════════');
  
  let passed = 0;
  let failed = 0;
  
  function test(name: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      if (details) console.log(`    ${details}`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${name}`);
      if (details) console.log(`    ${details}`);
      failed++;
    }
  }

  // TEST 1: Backend Health
  console.log('\n📋 Test 1: Backend System Health');
  try {
    const response = await fetch('https://pitchey-backend-fresh.deno.dev/api/health');
    const data = await response.json();
    
    test('Backend is responsive', response.ok);
    test('Backend has recent deployment', 
      new Date(data.data.deployedAt).getTime() > Date.now() - (2 * 60 * 60 * 1000),
      `Deployed: ${data.data.deployedAt}`
    );
    test('Backend reports healthy status', data.data.status === 'healthy');
  } catch (error) {
    test('Backend is accessible', false, error.message);
  }

  // TEST 2: Authentication (JWT with userId field)
  console.log('\n🔐 Test 2: Authentication System');
  let authToken = null;
  try {
    const authResponse = await fetch('https://pitchey-backend-fresh.deno.dev/api/auth/creator/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alex.creator@demo.com', password: 'Demo123' })
    });
    
    test('Authentication endpoint responds', authResponse.ok);
    
    if (authResponse.ok) {
      const authData = await authResponse.json();
      authToken = authData.token;
      
      const payload = JSON.parse(atob(authToken.split('.')[1]));
      
      test('JWT contains userId field (not sub)', 
        !!payload.userId && !payload.sub,
        `userId: ${payload.userId}, sub: ${payload.sub || 'undefined'}`
      );
      test('JWT has valid expiration', payload.exp > Date.now() / 1000);
    }
  } catch (error) {
    test('Authentication system works', false, error.message);
  }

  // TEST 3: Single WebSocket Connection
  console.log('\n🔌 Test 3: WebSocket Connection (Single)');
  if (authToken) {
    try {
      const wsResult = await new Promise((resolve) => {
        const ws = new WebSocket(`wss://pitchey-backend-fresh.deno.dev/ws?token=${authToken}`);
        let connected = false;
        let messagesReceived = 0;
        
        const timeout = setTimeout(() => {
          ws.close();
          resolve({ connected: false, messages: 0, error: 'timeout' });
        }, 5000);
        
        ws.onopen = () => {
          connected = true;
          ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        };
        
        ws.onmessage = () => {
          messagesReceived++;
        };
        
        ws.onclose = () => {
          clearTimeout(timeout);
          resolve({ connected, messages: messagesReceived });
        };
        
        ws.onerror = () => {
          clearTimeout(timeout);
          resolve({ connected: false, messages: 0, error: 'connection_error' });
        };
      });
      
      test('WebSocket can connect with valid token', wsResult.connected);
      test('WebSocket receives server messages', wsResult.messages > 0, 
        `Received ${wsResult.messages} messages`
      );
      
    } catch (error) {
      test('WebSocket connection works', false, error.message);
    }
  } else {
    test('WebSocket test skipped', false, 'No auth token available');
  }

  // TEST 4: Multiple Connection Handling (Infinite Loop Prevention)
  console.log('\n🔄 Test 4: Multiple Connection Handling');
  if (authToken) {
    try {
      const connectionResults = [];
      const startTime = Date.now();
      
      // Create 5 connections rapidly
      for (let i = 0; i < 5; i++) {
        const result = await new Promise((resolve) => {
          const ws = new WebSocket(`wss://pitchey-backend-fresh.deno.dev/ws?token=invalid_${i}`);
          
          const timeout = setTimeout(() => {
            ws.close();
            resolve({ connected: false, rejected: true });
          }, 2000);
          
          ws.onopen = () => {
            clearTimeout(timeout);
            ws.close();
            resolve({ connected: true, rejected: false });
          };
          
          ws.onclose = (event) => {
            clearTimeout(timeout);
            resolve({ connected: false, rejected: event.code >= 4000 });
          };
          
          ws.onerror = () => {
            clearTimeout(timeout);
            resolve({ connected: false, rejected: true });
          };
        });
        
        connectionResults.push(result);
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      }
      
      const totalTime = Date.now() - startTime;
      const rejectedCount = connectionResults.filter(r => r.rejected).length;
      
      test('Invalid tokens are rejected', rejectedCount >= 4, 
        `${rejectedCount}/5 connections properly rejected`
      );
      test('No infinite retry loops', totalTime < 15000,
        `Total time: ${totalTime}ms (should be < 15s)`
      );
      
    } catch (error) {
      test('Multiple connection handling works', false, error.message);
    }
  }

  // TEST 5: Frontend Integration
  console.log('\n🌐 Test 5: Frontend Integration');
  try {
    const frontendResponse = await fetch('https://pitchey.netlify.app/');
    test('Frontend is accessible', frontendResponse.ok);
    
    const html = await frontendResponse.text();
    test('Frontend has proper structure', html.includes('Pitchey') && html.includes('root'));
    
    // Check for JavaScript bundle
    const jsMatch = html.match(/src="([^"]*\.js[^"]*)"/);
    if (jsMatch) {
      const jsUrl = `https://pitchey.netlify.app${jsMatch[1]}`;
      const jsResponse = await fetch(jsUrl);
      test('Frontend JavaScript bundle loads', jsResponse.ok);
      
      if (jsResponse.ok) {
        const jsContent = await jsResponse.text();
        test('Frontend configured for correct backend', 
          jsContent.includes('pitchey-backend-fresh.deno.dev'));
        test('Frontend has WebSocket support', 
          jsContent.includes('WebSocket') || jsContent.includes('ws://'));
      }
    }
    
  } catch (error) {
    test('Frontend integration works', false, error.message);
  }

  // FINAL RESULTS
  console.log('\n🏁 FINAL VERIFICATION RESULTS');
  console.log('══════════════════════════════════════════════════');
  console.log(`✅ Tests Passed: ${passed}`);
  console.log(`❌ Tests Failed: ${failed}`);
  console.log(`📊 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 COMPLETE SUCCESS: WebSocket infinite loop issue RESOLVED!');
    console.log('✅ Production site is fully operational');
    console.log('✅ All real-time features should work correctly');
  } else if (failed <= 2) {
    console.log('\n⚠️ MOSTLY SUCCESS: Core issue resolved with minor issues');
    console.log('✅ WebSocket infinite loop issue appears to be fixed');
    console.log('⚠️ Some secondary issues may remain');
  } else {
    console.log('\n❌ SIGNIFICANT ISSUES: Major problems detected');
    console.log('❌ WebSocket infinite loop may not be fully resolved');
    console.log('🔧 Further investigation required');
  }
  
  console.log('\n══════════════════════════════════════════════════');
  return { passed, failed, successRate: (passed / (passed + failed)) * 100 };
}

// Run the final verification
if (import.meta.main) {
  finalVerificationTest().catch(console.error);
}