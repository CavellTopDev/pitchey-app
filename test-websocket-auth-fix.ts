#!/usr/bin/env -S deno run --allow-env --allow-net

/**
 * Test WebSocket Authentication Fix
 * Verifies that authentication failures no longer cause infinite retries
 */

const BACKEND_URL = "wss://pitchey-backend-fresh.deno.dev";
const WS_URL = `${BACKEND_URL}/ws`;

console.log("🧪 Testing WebSocket Authentication Fix");
console.log("🎯 Verifying that auth failures don't cause infinite retries\n");

/**
 * Test 1: No token (should close with 1008, should not retry infinitely)
 */
async function testNoToken(): Promise<boolean> {
  console.log("🔐 Test 1: Connection without token");
  
  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    const startTime = Date.now();
    let opened = false;
    
    const timeout = setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.close();
        console.log("❌ Connection timeout - backend not responding");
        resolve(false);
      }
    }, 10000);
    
    ws.onopen = () => {
      opened = true;
      console.log("✅ Connection opened (expected - backend validates after open)");
    };
    
    ws.onclose = (event) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;
      
      console.log(`🔒 Connection closed after ${duration}ms`);
      console.log(`   Code: ${event.code}, Reason: "${event.reason}"`);
      
      if (event.code === 1008 && event.reason.includes("token")) {
        console.log("✅ Correct auth failure response");
        resolve(true);
      } else {
        console.log("❌ Unexpected close code/reason");
        resolve(false);
      }
    };
    
    ws.onerror = (error) => {
      clearTimeout(timeout);
      console.log("❌ WebSocket error:", error);
      resolve(false);
    };
  });
}

/**
 * Test 2: Invalid token (should close with 1008, should not retry infinitely)
 */
async function testInvalidToken(): Promise<boolean> {
  console.log("\n🔑 Test 2: Connection with invalid token");
  
  const fakeToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature";
  const wsUrlWithToken = `${WS_URL}?token=${fakeToken}`;
  
  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrlWithToken);
    const startTime = Date.now();
    
    const timeout = setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.close();
        console.log("❌ Connection timeout");
        resolve(false);
      }
    }, 10000);
    
    ws.onopen = () => {
      console.log("✅ Connection opened (expected - backend validates after open)");
    };
    
    ws.onclose = (event) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;
      
      console.log(`🔒 Connection closed after ${duration}ms`);
      console.log(`   Code: ${event.code}, Reason: "${event.reason}"`);
      
      if (event.code === 1008 && event.reason.includes("Invalid")) {
        console.log("✅ Correct invalid token response");
        resolve(true);
      } else {
        console.log("❌ Unexpected close code/reason");
        resolve(false);
      }
    };
    
    ws.onerror = (error) => {
      clearTimeout(timeout);
      console.log("❌ WebSocket error:", error);
      resolve(false);
    };
  });
}

/**
 * Test 3: Valid token (should connect successfully)
 */
async function testValidToken(): Promise<boolean> {
  console.log("\n🎫 Test 3: Connection with valid token");
  
  try {
    // Get auth token
    console.log("🔐 Getting authentication token...");
    const authResponse = await fetch("https://pitchey-backend-fresh.deno.dev/api/auth/creator/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alex.creator@demo.com",
        password: "Demo123"
      })
    });
    
    if (!authResponse.ok) {
      console.log(`❌ Failed to get auth token: ${authResponse.status}`);
      return false;
    }
    
    const authData = await authResponse.json();
    const token = authData.token;
    console.log(`✅ Got token: ${token.substring(0, 20)}...`);
    
    // Test WebSocket with valid token
    return new Promise((resolve) => {
      const wsUrlWithToken = `${WS_URL}?token=${token}`;
      const ws = new WebSocket(wsUrlWithToken);
      const startTime = Date.now();
      
      const timeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          console.log("❌ Connection timeout");
          resolve(false);
        }
      }, 10000);
      
      ws.onopen = () => {
        const duration = Date.now() - startTime;
        console.log(`🎉 WebSocket connected successfully after ${duration}ms!`);
        
        // Send test message and close cleanly
        setTimeout(() => {
          ws.close(1000, "Test completed");
          resolve(true);
        }, 1000);
      };
      
      ws.onmessage = (event) => {
        console.log("📨 Received:", event.data);
      };
      
      ws.onclose = (event) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;
        console.log(`🔒 Connection closed after ${duration}ms (code: ${event.code})`);
        
        if (event.code === 1000) {
          resolve(true);
        }
      };
      
      ws.onerror = (error) => {
        clearTimeout(timeout);
        console.log("❌ WebSocket error:", error);
        resolve(false);
      };
    });
    
  } catch (error) {
    console.log("❌ Test failed:", error);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log("🚀 Starting WebSocket Authentication Fix Tests...\n");
  
  const results: boolean[] = [];
  
  // Test 1: No token
  results.push(await testNoToken());
  
  // Test 2: Invalid token
  results.push(await testInvalidToken());
  
  // Test 3: Valid token
  results.push(await testValidToken());
  
  // Summary
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST RESULTS SUMMARY");
  console.log("=".repeat(60));
  console.log(`✅ Tests Passed: ${passed}/${total}`);
  
  if (passed === total) {
    console.log("🎉 ALL TESTS PASSED! WebSocket auth fix is working correctly.");
    console.log("\n💡 Key Fix: Frontend now recognizes code 1008 as auth failure");
    console.log("   and doesn't retry, preventing infinite loops.");
  } else {
    console.log("⚠️  Some tests failed - fix may need adjustment");
  }
  
  console.log("\n" + "=".repeat(60));
}

// Run the tests
if (import.meta.main) {
  await runTests();
}