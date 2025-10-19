#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write

/**
 * Test WebSocket Authentication Fixes
 * Tests the new flexible authentication methods for WebSocket connections
 */

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  details?: any;
}

interface WebSocketTestCase {
  name: string;
  url: string;
  description: string;
  expectedOutcome: 'success' | 'limited' | 'fail';
  authMethod: 'query' | 'header' | 'message' | 'none';
}

const testCases: WebSocketTestCase[] = [
  {
    name: "No Authentication Token",
    url: "ws://localhost:8001/ws",
    description: "Test connection without any authentication (should allow limited functionality)",
    expectedOutcome: 'limited',
    authMethod: 'none'
  },
  {
    name: "Authentication via First Message",
    url: "ws://localhost:8001/ws",
    description: "Test connection without token, then authenticate via first message",
    expectedOutcome: 'success',
    authMethod: 'message'
  }
];

async function testWebSocketConnection(testCase: WebSocketTestCase): Promise<TestResult> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({
        name: testCase.name,
        success: false,
        message: "Test timed out",
        details: { timeout: "10s" }
      });
    }, 10000);

    try {
      console.log(`\n🧪 Testing: ${testCase.name}`);
      console.log(`📍 URL: ${testCase.url}`);
      console.log(`📝 Description: ${testCase.description}`);
      
      const ws = new WebSocket(testCase.url);
      let messageCount = 0;
      let authAttempted = false;

      ws.onopen = () => {
        console.log("✅ WebSocket connection opened");
        
        // If this is the "first message" auth test, send auth message
        if (testCase.authMethod === 'message') {
          setTimeout(() => {
            if (!authAttempted) {
              authAttempted = true;
              console.log("🔐 Sending authentication via first message");
              ws.send(JSON.stringify({
                type: 'auth',
                token: 'demo_token_for_testing',
                timestamp: new Date().toISOString()
              }));
            }
          }, 500);
        }
      };

      ws.onmessage = (event) => {
        messageCount++;
        console.log(`📨 Message ${messageCount}:`, event.data);
        
        try {
          const message = JSON.parse(event.data);
          
          // Handle different message types
          if (message.type === 'connected') {
            const isAuthenticated = message.authenticated;
            const capabilities = message.capabilities || [];
            
            console.log(`🔗 Connection confirmed - Authenticated: ${isAuthenticated}`);
            console.log(`🎯 Capabilities: ${capabilities.join(', ')}`);
            
            if (testCase.expectedOutcome === 'success' && isAuthenticated) {
              clearTimeout(timeout);
              ws.close();
              resolve({
                name: testCase.name,
                success: true,
                message: "Authenticated connection successful",
                details: { capabilities, authenticated: isAuthenticated }
              });
            } else if (testCase.expectedOutcome === 'limited' && !isAuthenticated && capabilities.length > 0) {
              clearTimeout(timeout);
              ws.close();
              resolve({
                name: testCase.name,
                success: true,
                message: "Unauthenticated connection with limited functionality",
                details: { capabilities, authenticated: isAuthenticated }
              });
            }
          } else if (message.type === 'auth_success') {
            console.log("🎉 Authentication via first message successful");
            if (testCase.authMethod === 'message') {
              clearTimeout(timeout);
              ws.close();
              resolve({
                name: testCase.name,
                success: true,
                message: "Authentication via first message successful",
                details: { authMethod: 'first_message' }
              });
            }
          } else if (message.type === 'auth_error') {
            console.log("❌ Authentication failed");
            if (testCase.expectedOutcome === 'fail') {
              clearTimeout(timeout);
              ws.close();
              resolve({
                name: testCase.name,
                success: true,
                message: "Authentication correctly failed as expected",
                details: { authMethod: testCase.authMethod }
              });
            }
          } else if (message.type === 'error') {
            console.log("⚠️ Error message received:", message);
            
            // For auth failure tests, this might be expected
            if (testCase.expectedOutcome === 'fail') {
              clearTimeout(timeout);
              ws.close();
              resolve({
                name: testCase.name,
                success: true,
                message: "Authentication correctly failed as expected",
                details: { error: message }
              });
            }
          }
          
          // For ping/pong, just acknowledge
          if (message.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          }
          
        } catch (error) {
          console.log("⚠️ Failed to parse message:", error);
        }
      };

      ws.onclose = (event) => {
        console.log(`🔌 WebSocket closed - Code: ${event.code}, Reason: "${event.reason}"`);
        
        // Handle expected auth failures
        if (testCase.expectedOutcome === 'fail' && (event.code === 1008 || event.code === 4001)) {
          clearTimeout(timeout);
          resolve({
            name: testCase.name,
            success: true,
            message: "Connection correctly rejected for invalid authentication",
            details: { closeCode: event.code, reason: event.reason }
          });
        } else if (messageCount === 0) {
          // No messages received before close
          clearTimeout(timeout);
          resolve({
            name: testCase.name,
            success: false,
            message: `Connection closed immediately: ${event.reason}`,
            details: { closeCode: event.code, reason: event.reason }
          });
        }
      };

      ws.onerror = (error) => {
        console.log("❌ WebSocket error:", error);
        clearTimeout(timeout);
        resolve({
          name: testCase.name,
          success: false,
          message: "WebSocket connection error",
          details: { error: error.toString() }
        });
      };

    } catch (error) {
      clearTimeout(timeout);
      resolve({
        name: testCase.name,
        success: false,
        message: `Failed to create WebSocket: ${error}`,
        details: { error: error.toString() }
      });
    }
  });
}

async function runAllTests(): Promise<void> {
  console.log("🚀 Starting WebSocket Authentication Tests");
  console.log("=" .repeat(60));
  
  const results: TestResult[] = [];
  
  for (const testCase of testCases) {
    const result = await testWebSocketConnection(testCase);
    results.push(result);
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Print summary
  console.log("\n" + "=" .repeat(60));
  console.log("📊 TEST RESULTS SUMMARY");
  console.log("=" .repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  for (const result of results) {
    const status = result.success ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} ${result.name}`);
    console.log(`    ${result.message}`);
    if (result.details) {
      console.log(`    Details: ${JSON.stringify(result.details, null, 2).split('\n').join('\n    ')}`);
    }
    console.log();
    
    if (result.success) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log(`📈 Results: ${passed} passed, ${failed} failed out of ${results.length} total tests`);
  
  if (failed === 0) {
    console.log("🎉 All WebSocket authentication tests passed!");
  } else {
    console.log("⚠️ Some tests failed. Check the server logs for details.");
  }
}

// Check if server is running before testing
async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch("http://localhost:8001/api/test/new");
    return response.ok;
  } catch (error) {
    console.error("❌ Server health check failed. Make sure the server is running on port 8001");
    console.error("   Start server with: PORT=8001 deno run --allow-all working-server.ts");
    return false;
  }
}

// Main execution
if (import.meta.main) {
  console.log("🔍 Checking server health...");
  const serverHealthy = await checkServerHealth();
  
  if (serverHealthy) {
    console.log("✅ Server is running");
    await runAllTests();
  } else {
    console.log("❌ Server is not accessible. Please start the server first.");
    Deno.exit(1);
  }
}
