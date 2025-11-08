#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * WebSocket Integration Test Script
 * Tests the WebSocket server integration with the main backend
 */

// We'll use environment variables directly instead of loading .env file

const BACKEND_URL = Deno.env.get("BACKEND_URL") || "http://localhost:8001";
const WS_URL = BACKEND_URL.replace("http", "ws") + "/ws";

console.log("🧪 Starting WebSocket Integration Tests");
console.log(`📡 Backend URL: ${BACKEND_URL}`);
console.log(`🔌 WebSocket URL: ${WS_URL}`);

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration?: number;
}

const results: TestResult[] = [];

/**
 * Test if backend server is running
 */
async function testBackendHealth(): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`);
    const data = await response.json();
    
    if (response.ok && data.status === "healthy") {
      return {
        name: "Backend Health Check",
        passed: true,
        message: `Backend is healthy (v${data.version})`,
        duration: Date.now() - start
      };
    } else {
      return {
        name: "Backend Health Check",
        passed: false,
        message: `Backend unhealthy: ${data.message || "Unknown error"}`,
        duration: Date.now() - start
      };
    }
  } catch (error) {
    return {
      name: "Backend Health Check",
      passed: false,
      message: `Failed to connect to backend: ${error.message}`,
      duration: Date.now() - start
    };
  }
}

/**
 * Test WebSocket health endpoint
 */
async function testWebSocketHealth(): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await fetch(`${BACKEND_URL}/api/ws/health`);
    const data = await response.json();
    
    if (response.ok && data.status) {
      return {
        name: "WebSocket Health Check",
        passed: true,
        message: `WebSocket health: ${data.status}`,
        duration: Date.now() - start
      };
    } else {
      return {
        name: "WebSocket Health Check",
        passed: false,
        message: `WebSocket health check failed: ${JSON.stringify(data)}`,
        duration: Date.now() - start
      };
    }
  } catch (error) {
    return {
      name: "WebSocket Health Check",
      passed: false,
      message: `WebSocket health check error: ${error.message}`,
      duration: Date.now() - start
    };
  }
}

/**
 * Test WebSocket connection without authentication
 */
async function testWebSocketConnectionNoAuth(): Promise<TestResult> {
  const start = Date.now();
  
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(WS_URL);
      
      const timeout = setTimeout(() => {
        ws.close();
        resolve({
          name: "WebSocket Connection (No Auth)",
          passed: false,
          message: "Connection timeout",
          duration: Date.now() - start
        });
      }, 5000);
      
      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve({
          name: "WebSocket Connection (No Auth)",
          passed: false,
          message: "Connection should have been rejected without auth",
          duration: Date.now() - start
        });
      };
      
      ws.onerror = () => {
        clearTimeout(timeout);
        resolve({
          name: "WebSocket Connection (No Auth)",
          passed: true,
          message: "Connection properly rejected without authentication",
          duration: Date.now() - start
        });
      };
      
      ws.onclose = (event) => {
        clearTimeout(timeout);
        if (event.code === 1008) {
          resolve({
            name: "WebSocket Connection (No Auth)",
            passed: true,
            message: "Connection properly rejected with code 1008 (Authentication required)",
            duration: Date.now() - start
          });
        } else {
          resolve({
            name: "WebSocket Connection (No Auth)",
            passed: false,
            message: `Unexpected close code: ${event.code}`,
            duration: Date.now() - start
          });
        }
      };
    } catch (error) {
      resolve({
        name: "WebSocket Connection (No Auth)",
        passed: false,
        message: `Connection error: ${error.message}`,
        duration: Date.now() - start
      });
    }
  });
}

/**
 * Test WebSocket connection with demo credentials
 */
async function testWebSocketConnectionWithAuth(): Promise<TestResult> {
  const start = Date.now();
  
  try {
    // First, get a JWT token using demo credentials
    const loginResponse = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: "alex.creator@demo.com",
        password: "Demo123"
      })
    });
    
    if (!loginResponse.ok) {
      return {
        name: "WebSocket Connection (With Auth)",
        passed: false,
        message: "Failed to get authentication token",
        duration: Date.now() - start
      };
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    
    if (!token) {
      return {
        name: "WebSocket Connection (With Auth)",
        passed: false,
        message: "No token received from login",
        duration: Date.now() - start
      };
    }
    
    // Now test WebSocket connection with token
    return new Promise((resolve) => {
      try {
        const wsUrlWithToken = `${WS_URL}?token=${token}`;
        const ws = new WebSocket(wsUrlWithToken);
        
        const timeout = setTimeout(() => {
          ws.close();
          resolve({
            name: "WebSocket Connection (With Auth)",
            passed: false,
            message: "Connection timeout",
            duration: Date.now() - start
          });
        }, 10000);
        
        ws.onopen = () => {
          clearTimeout(timeout);
          
          // Send a ping message
          ws.send(JSON.stringify({
            type: "ping",
            payload: { timestamp: Date.now() }
          }));
        };
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            if (message.type === "connected") {
              // Connection established successfully
              setTimeout(() => {
                ws.close();
                resolve({
                  name: "WebSocket Connection (With Auth)",
                  passed: true,
                  message: `Connection established successfully. Session ID: ${message.payload?.sessionId}`,
                  duration: Date.now() - start
                });
              }, 1000);
            } else if (message.type === "pong") {
              // Ping-pong successful
              ws.close();
              resolve({
                name: "WebSocket Connection (With Auth)",
                passed: true,
                message: "Connection and ping-pong successful",
                duration: Date.now() - start
              });
            }
          } catch (parseError) {
            ws.close();
            resolve({
              name: "WebSocket Connection (With Auth)",
              passed: false,
              message: `Failed to parse WebSocket message: ${parseError.message}`,
              duration: Date.now() - start
            });
          }
        };
        
        ws.onerror = (error) => {
          clearTimeout(timeout);
          resolve({
            name: "WebSocket Connection (With Auth)",
            passed: false,
            message: `WebSocket error: ${error}`,
            duration: Date.now() - start
          });
        };
        
        ws.onclose = (event) => {
          clearTimeout(timeout);
          if (event.code === 1000) {
            // Normal closure - test passed
            resolve({
              name: "WebSocket Connection (With Auth)",
              passed: true,
              message: "Connection closed normally",
              duration: Date.now() - start
            });
          } else {
            resolve({
              name: "WebSocket Connection (With Auth)",
              passed: false,
              message: `Unexpected close code: ${event.code} - ${event.reason}`,
              duration: Date.now() - start
            });
          }
        };
      } catch (error) {
        resolve({
          name: "WebSocket Connection (With Auth)",
          passed: false,
          message: `Connection error: ${error.message}`,
          duration: Date.now() - start
        });
      }
    });
  } catch (error) {
    return {
      name: "WebSocket Connection (With Auth)",
      passed: false,
      message: `Authentication error: ${error.message}`,
      duration: Date.now() - start
    };
  }
}

/**
 * Test Redis service availability
 */
async function testRedisService(): Promise<TestResult> {
  const start = Date.now();
  
  // We can test this by checking if Redis operations work through the API
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`);
    const data = await response.json();
    
    if (data.redis && data.redis.status) {
      return {
        name: "Redis Service",
        passed: data.redis.status === "healthy",
        message: `Redis status: ${data.redis.status} (enabled: ${data.redis.enabled})`,
        duration: Date.now() - start
      };
    } else {
      return {
        name: "Redis Service",
        passed: false,
        message: "Redis status not available in health check",
        duration: Date.now() - start
      };
    }
  } catch (error) {
    return {
      name: "Redis Service",
      passed: false,
      message: `Redis test failed: ${error.message}`,
      duration: Date.now() - start
    };
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log("\n🚀 Running WebSocket Integration Tests...\n");
  
  // Test 1: Backend Health
  console.log("1. Testing backend health...");
  results.push(await testBackendHealth());
  
  // Test 2: WebSocket Health Endpoint
  console.log("2. Testing WebSocket health endpoint...");
  results.push(await testWebSocketHealth());
  
  // Test 3: Redis Service
  console.log("3. Testing Redis service...");
  results.push(await testRedisService());
  
  // Test 4: WebSocket Connection (No Auth)
  console.log("4. Testing WebSocket connection without auth...");
  results.push(await testWebSocketConnectionNoAuth());
  
  // Test 5: WebSocket Connection (With Auth)
  console.log("5. Testing WebSocket connection with auth...");
  results.push(await testWebSocketConnectionWithAuth());
  
  // Display results
  console.log("\n📊 Test Results:");
  console.log("================");
  
  let passed = 0;
  let failed = 0;
  
  for (const result of results) {
    const status = result.passed ? "✅ PASS" : "❌ FAIL";
    const duration = result.duration ? ` (${result.duration}ms)` : "";
    console.log(`${status} ${result.name}${duration}`);
    console.log(`   ${result.message}`);
    
    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log(`\n📈 Summary: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log("🎉 All tests passed! WebSocket integration is working correctly.");
  } else {
    console.log("⚠️  Some tests failed. Please check the configuration and try again.");
  }
  
  return failed === 0;
}

// Run the tests
if (import.meta.main) {
  const success = await runTests();
  Deno.exit(success ? 0 : 1);
}