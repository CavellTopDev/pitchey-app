#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Comprehensive Telemetry Testing
 * Tests various error scenarios to validate Sentry integration
 */

const BACKEND_URL = "https://pitchey-backend-fresh.deno.dev";

interface TestScenario {
  name: string;
  description: string;
  request: () => Promise<Response>;
  expectedStatus: number[];
  shouldTriggerSentry: boolean;
}

// Test scenarios to validate telemetry
const TEST_SCENARIOS: TestScenario[] = [
  {
    name: "404 Not Found",
    description: "Test 404 error tracking for non-existent endpoints", 
    request: () => fetch(`${BACKEND_URL}/api/nonexistent/endpoint`),
    expectedStatus: [404, 401], // Could be 401 if auth middleware runs first
    shouldTriggerSentry: true
  },
  {
    name: "Invalid JSON Request",
    description: "Test malformed request handling",
    request: () => fetch(`${BACKEND_URL}/api/auth/creator/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid json data"
    }),
    expectedStatus: [400, 422],
    shouldTriggerSentry: true
  },
  {
    name: "Method Not Allowed", 
    description: "Test unsupported HTTP methods",
    request: () => fetch(`${BACKEND_URL}/api/health`, { method: "DELETE" }),
    expectedStatus: [405, 404],
    shouldTriggerSentry: false
  },
  {
    name: "Large Request Body",
    description: "Test request size limits",
    request: () => fetch(`${BACKEND_URL}/api/auth/creator/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "test123",
        largeData: "x".repeat(10000) // 10KB of data
      })
    }),
    expectedStatus: [400, 401, 422],
    shouldTriggerSentry: false
  },
  {
    name: "Rate Limiting",
    description: "Test rapid requests to trigger rate limiting",
    request: () => fetch(`${BACKEND_URL}/api/pitches/featured`),
    expectedStatus: [200, 429],
    shouldTriggerSentry: false
  },
  {
    name: "Authentication Failure",
    description: "Test invalid authentication tokens",
    request: () => fetch(`${BACKEND_URL}/api/user/profile`, {
      headers: { "Authorization": "Bearer invalid_token_12345" }
    }),
    expectedStatus: [401, 403],
    shouldTriggerSentry: false
  },
  {
    name: "SQL Injection Attempt",
    description: "Test security filtering for malicious input",
    request: () => fetch(`${BACKEND_URL}/api/pitches/search?q=' OR 1=1 --`),
    expectedStatus: [200, 400],
    shouldTriggerSentry: false
  },
  {
    name: "XSS Prevention",
    description: "Test XSS input sanitization",
    request: () => fetch(`${BACKEND_URL}/api/pitches/search?q=<script>alert('xss')</script>`),
    expectedStatus: [200, 400],
    shouldTriggerSentry: false
  }
];

async function runTestScenario(scenario: TestScenario): Promise<{
  name: string;
  success: boolean;
  status: number;
  responseTime: number;
  sentryTriggered: boolean;
  error?: string;
}> {
  console.log(`🧪 Testing: ${scenario.name}`);
  console.log(`   ${scenario.description}`);
  
  const startTime = performance.now();
  
  try {
    const response = await scenario.request();
    const responseTime = performance.now() - startTime;
    
    const success = scenario.expectedStatus.includes(response.status);
    const statusEmoji = success ? "✅" : "❌";
    
    console.log(`   ${statusEmoji} Status: ${response.status} (${Math.round(responseTime)}ms)`);
    
    if (scenario.shouldTriggerSentry && success) {
      console.log(`   📤 Expected to trigger Sentry event`);
    }
    
    return {
      name: scenario.name,
      success,
      status: response.status,
      responseTime: Math.round(responseTime),
      sentryTriggered: scenario.shouldTriggerSentry && success
    };
    
  } catch (error) {
    const responseTime = performance.now() - startTime;
    
    console.log(`   ❌ Network Error: ${error.message} (${Math.round(responseTime)}ms)`);
    
    return {
      name: scenario.name,
      success: false,
      status: 0,
      responseTime: Math.round(responseTime),
      sentryTriggered: false,
      error: error.message
    };
  }
}

async function testRapidRequests(): Promise<void> {
  console.log("\n🚀 Testing Rate Limiting (10 rapid requests):");
  
  const promises = Array(10).fill(0).map((_, i) => 
    fetch(`${BACKEND_URL}/api/pitches/featured?_test=${i}`)
      .then(r => ({ index: i, status: r.status, ok: r.ok }))
      .catch(e => ({ index: i, status: 0, ok: false, error: e.message }))
  );
  
  const results = await Promise.all(promises);
  
  let successCount = 0;
  let rateLimited = 0;
  
  for (const result of results) {
    if (result.status === 200) successCount++;
    if (result.status === 429) rateLimited++;
    
    const emoji = result.status === 200 ? "✅" : result.status === 429 ? "⏸️" : "❌";
    console.log(`   ${emoji} Request ${result.index + 1}: ${result.status}`);
  }
  
  console.log(`   📊 Success: ${successCount}, Rate Limited: ${rateLimited}, Failed: ${results.length - successCount - rateLimited}`);
}

async function testTelemetryEndpoints(): Promise<void> {
  console.log("\n🔍 Testing Telemetry Integration:");
  
  // Test health endpoint telemetry status
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`);
    const health = await response.json();
    
    console.log(`   ✅ Health endpoint: ${response.status}`);
    console.log(`   📊 Telemetry initialized: ${health.data?.telemetry?.initialized || false}`);
    console.log(`   🏷️  Environment: ${health.data?.telemetry?.environment || 'unknown'}`);
    console.log(`   ⚙️  Sentry configured: ${health.data?.telemetry?.config?.sentryConfigured || false}`);
    
    if (health.data?.telemetry?.initialized) {
      console.log(`   🎯 Sample rate: ${health.data.telemetry.config.sampleRate}`);
    }
    
  } catch (error) {
    console.log(`   ❌ Failed to check telemetry status: ${error.message}`);
  }
}

async function runAllTests(): Promise<void> {
  console.log("🧪 Starting Comprehensive Telemetry Testing\n");
  console.log("=" .repeat(60));
  
  const results: any[] = [];
  
  // Run individual test scenarios
  for (const scenario of TEST_SCENARIOS) {
    const result = await runTestScenario(scenario);
    results.push(result);
    console.log(); // Add spacing between tests
    
    // Small delay between tests to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Run rapid request test
  await testRapidRequests();
  
  // Check telemetry status
  await testTelemetryEndpoints();
  
  console.log("\n" + "=" .repeat(60));
  console.log("📊 Test Summary");
  console.log("=" .repeat(60));
  
  const successfulTests = results.filter(r => r.success).length;
  const sentryEvents = results.filter(r => r.sentryTriggered).length;
  const avgResponseTime = Math.round(results.reduce((sum, r) => sum + r.responseTime, 0) / results.length);
  
  console.log(`✅ Successful Tests: ${successfulTests}/${results.length}`);
  console.log(`📤 Expected Sentry Events: ${sentryEvents}`);
  console.log(`⚡ Average Response Time: ${avgResponseTime}ms`);
  
  console.log("\n🔍 Test Results by Category:");
  for (const result of results) {
    const emoji = result.success ? "✅" : "❌";
    const sentryIcon = result.sentryTriggered ? "📤" : "";
    console.log(`   ${emoji} ${result.name}: ${result.status} (${result.responseTime}ms) ${sentryIcon}`);
  }
  
  console.log("\n📋 Next Steps:");
  console.log("1. Check Sentry dashboard for new events from these tests");
  console.log("2. Verify error events have proper context and tags"); 
  console.log("3. Confirm performance transactions are being tracked");
  console.log("4. Review alert rules trigger appropriately");
  
  if (sentryEvents > 0) {
    console.log(`\n🎯 Expected ${sentryEvents} new events in Sentry dashboard`);
    console.log("   Events should include error context, user agents, and telemetry data");
  }
}

// Run comprehensive testing
await runAllTests();