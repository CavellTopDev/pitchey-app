/**
 * Test Production WebSocket Connection
 * Direct test of wss://pitchey-backend-fresh.deno.dev/ws
 */

const BACKEND_URL = "wss://pitchey-backend-fresh.deno.dev";
const WS_URL = `${BACKEND_URL}/ws`;

console.log("🧪 Testing Production WebSocket Connection");
console.log(`🔌 Backend URL: ${BACKEND_URL}`);
console.log(`🔗 WebSocket URL: ${WS_URL}`);

interface TestResult {
  test: string;
  success: boolean;
  message: string;
  duration: number;
  details?: any;
}

const results: TestResult[] = [];

/**
 * Test 1: Connect without authentication
 */
async function testNoAuth(): Promise<TestResult> {
  console.log("\n🔐 Test 1: Connection without authentication (should fail quickly)");
  
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(WS_URL);
      
      const timeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          resolve({
            test: "No Auth Connection",
            success: false,
            message: "Connection timeout after 10s - backend may not be responding",
            duration: Date.now() - startTime
          });
        }
      }, 10000);
      
      ws.onopen = () => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;
        console.log(`⚠️  WebSocket opened without auth after ${duration}ms - this is unexpected!`);
        ws.close();
        resolve({
          test: "No Auth Connection",
          success: false,
          message: "WebSocket opened without authentication - security issue!",
          duration
        });
      };
      
      ws.onclose = (event) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;
        const success = event.code >= 1000 && event.code < 2000 && duration < 5000;
        
        console.log(`🔒 WebSocket closed - Code: ${event.code}, Reason: "${event.reason}", Duration: ${duration}ms`);
        
        resolve({
          test: "No Auth Connection",
          success,
          message: `Closed with code ${event.code}: ${event.reason || 'No reason'} (${duration}ms)`,
          duration,
          details: { code: event.code, reason: event.reason }
        });
      };
      
      ws.onerror = (error) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;
        console.log(`❌ WebSocket error after ${duration}ms:`, error);
        
        resolve({
          test: "No Auth Connection",
          success: duration < 5000, // Quick failure is good
          message: `Error after ${duration}ms: ${error}`,
          duration,
          details: { error: error.toString() }
        });
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ Failed to create WebSocket:`, error);
      resolve({
        test: "No Auth Connection",
        success: false,
        message: `Failed to create WebSocket: ${error}`,
        duration,
        details: { error: error.toString() }
      });
    }
  });
}

/**
 * Test 2: Connect with fake JWT token
 */
async function testFakeAuth(): Promise<TestResult> {
  console.log("\n🔑 Test 2: Connection with fake JWT token (should fail auth)");
  
  const fakeToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
  const wsUrlWithToken = `${WS_URL}?token=${fakeToken}`;
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(wsUrlWithToken);
      
      const timeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          resolve({
            test: "Fake Auth Connection",
            success: false,
            message: "Connection timeout after 10s",
            duration: Date.now() - startTime
          });
        }
      }, 10000);
      
      ws.onopen = () => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;
        console.log(`⚠️  WebSocket opened with fake token after ${duration}ms - auth may not be working!`);
        ws.close();
        resolve({
          test: "Fake Auth Connection",
          success: false,
          message: "WebSocket opened with fake JWT - authentication bypass!",
          duration
        });
      };
      
      ws.onmessage = (event) => {
        console.log(`📨 Received message: ${event.data}`);
      };
      
      ws.onclose = (event) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;
        const isAuthError = event.reason.toLowerCase().includes('token') || 
                           event.reason.toLowerCase().includes('auth') ||
                           event.code === 4001 || event.code === 4003;
        
        console.log(`🔒 WebSocket closed - Code: ${event.code}, Reason: "${event.reason}", Duration: ${duration}ms`);
        
        resolve({
          test: "Fake Auth Connection",
          success: isAuthError && duration < 5000,
          message: `Closed with code ${event.code}: ${event.reason || 'No reason'} (${duration}ms)`,
          duration,
          details: { code: event.code, reason: event.reason, isAuthError }
        });
      };
      
      ws.onerror = (error) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;
        console.log(`❌ WebSocket error after ${duration}ms:`, error);
        
        resolve({
          test: "Fake Auth Connection",
          success: duration < 5000,
          message: `Error after ${duration}ms: ${error}`,
          duration,
          details: { error: error.toString() }
        });
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ Failed to create WebSocket:`, error);
      resolve({
        test: "Fake Auth Connection",
        success: false,
        message: `Failed to create WebSocket: ${error}`,
        duration,
        details: { error: error.toString() }
      });
    }
  });
}

/**
 * Test 3: Get a real auth token and test connection
 */
async function testRealAuth(): Promise<TestResult> {
  console.log("\n🎫 Test 3: Getting real auth token and testing connection");
  
  const startTime = Date.now();
  
  try {
    // First, get a real auth token using demo credentials
    console.log("🔐 Attempting to get real auth token...");
    
    const authResponse = await fetch("https://pitchey-backend-fresh.deno.dev/api/auth/creator/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "alex.creator@demo.com",
        password: "Demo123"
      })
    });
    
    if (!authResponse.ok) {
      const authError = await authResponse.text();
      return {
        test: "Real Auth Connection",
        success: false,
        message: `Failed to get auth token: ${authResponse.status} ${authError}`,
        duration: Date.now() - startTime,
        details: { status: authResponse.status, error: authError }
      };
    }
    
    const authData = await authResponse.json();
    const token = authData.token;
    
    if (!token) {
      return {
        test: "Real Auth Connection",
        success: false,
        message: "No token in auth response",
        duration: Date.now() - startTime,
        details: { authData }
      };
    }
    
    console.log(`✅ Got auth token: ${token.substring(0, 20)}...`);
    
    // Now test WebSocket with real token
    const wsUrlWithToken = `${WS_URL}?token=${token}`;
    const wsStartTime = Date.now();
    
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(wsUrlWithToken);
        
        const timeout = setTimeout(() => {
          if (ws.readyState === WebSocket.CONNECTING) {
            ws.close();
            resolve({
              test: "Real Auth Connection",
              success: false,
              message: "WebSocket connection timeout after 10s",
              duration: Date.now() - startTime
            });
          }
        }, 10000);
        
        ws.onopen = () => {
          clearTimeout(timeout);
          const duration = Date.now() - wsStartTime;
          console.log(`🎉 WebSocket connected successfully with real token after ${duration}ms!`);
          
          // Send a test message
          ws.send(JSON.stringify({
            type: "ping",
            timestamp: new Date().toISOString()
          }));
          
          setTimeout(() => {
            ws.close(1000, "Test completed successfully");
            resolve({
              test: "Real Auth Connection",
              success: true,
              message: `WebSocket connected successfully with real auth token (${duration}ms)`,
              duration: Date.now() - startTime,
              details: { wsConnectTime: duration }
            });
          }, 2000);
        };
        
        ws.onmessage = (event) => {
          console.log(`📨 Received WebSocket message: ${event.data}`);
        };
        
        ws.onclose = (event) => {
          clearTimeout(timeout);
          const duration = Date.now() - startTime;
          const wsSuccess = event.code === 1000;
          
          console.log(`🔒 WebSocket closed - Code: ${event.code}, Reason: "${event.reason}", Duration: ${duration}ms`);
          
          resolve({
            test: "Real Auth Connection",
            success: wsSuccess,
            message: `WebSocket closed with code ${event.code}: ${event.reason || 'No reason'} (${duration}ms total)`,
            duration,
            details: { code: event.code, reason: event.reason, wsConnectTime: Date.now() - wsStartTime }
          });
        };
        
        ws.onerror = (error) => {
          clearTimeout(timeout);
          const duration = Date.now() - startTime;
          console.log(`❌ WebSocket error after ${duration}ms:`, error);
          
          resolve({
            test: "Real Auth Connection",
            success: false,
            message: `WebSocket error after ${duration}ms: ${error}`,
            duration,
            details: { error: error.toString() }
          });
        };
        
      } catch (error) {
        const duration = Date.now() - startTime;
        console.log(`❌ Failed to create WebSocket:`, error);
        resolve({
          test: "Real Auth Connection",
          success: false,
          message: `Failed to create WebSocket: ${error}`,
          duration,
          details: { error: error.toString() }
        });
      }
    });
    
  } catch (error) {
    return {
      test: "Real Auth Connection", 
      success: false,
      message: `Auth request failed: ${error}`,
      duration: Date.now() - startTime,
      details: { error: error.toString() }
    };
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log("🚀 Starting WebSocket Production Tests...\n");
  
  try {
    // Test 1: No auth
    const result1 = await testNoAuth();
    results.push(result1);
    
    // Test 2: Fake auth  
    const result2 = await testFakeAuth();
    results.push(result2);
    
    // Test 3: Real auth
    const result3 = await testRealAuth();
    results.push(result3);
    
    // Print results summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 WEBSOCKET TEST RESULTS SUMMARY");
    console.log("=".repeat(60));
    
    results.forEach((result, index) => {
      const status = result.success ? "✅ PASS" : "❌ FAIL";
      console.log(`${index + 1}. ${status} ${result.test}`);
      console.log(`   Duration: ${result.duration}ms`);
      console.log(`   Message: ${result.message}`);
      if (result.details) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
      }
      console.log("");
    });
    
    const passCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    console.log(`📈 Overall: ${passCount}/${totalCount} tests passed`);
    
    if (passCount === totalCount) {
      console.log("🎉 All tests passed! WebSocket is working correctly.");
    } else if (passCount > 0) {
      console.log("⚠️  Some tests passed - WebSocket partially working.");
    } else {
      console.log("🚨 All tests failed - WebSocket not working in production.");
    }
    
    console.log("\n" + "=".repeat(60));
    
  } catch (error) {
    console.error("❌ Test suite failed:", error);
  }
}

// Run the tests
if (import.meta.main) {
  await runTests();
}