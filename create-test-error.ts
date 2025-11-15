#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Create Test Error for Sentry Validation
 * Sends requests that should trigger telemetry initialization and error tracking
 */

const BACKEND_URL = "https://pitchey-backend-fresh-rcd8mdn10tbe.deno.dev";

async function testSentryInitialization(): Promise<void> {
  console.log("🧪 Testing Sentry Integration...\n");
  
  // Test 1: Check health endpoint
  console.log("1. ✅ Checking health endpoint telemetry status:");
  try {
    const healthResponse = await fetch(`${BACKEND_URL}/api/health`);
    const health = await healthResponse.json();
    
    console.log(`   Environment: ${health.data.telemetry.environment}`);
    console.log(`   Initialized: ${health.data.telemetry.initialized}`);
    console.log(`   Sentry Configured: ${health.data.telemetry.config.sentryConfigured}`);
    
  } catch (error) {
    console.error("   ❌ Error checking health:", error.message);
  }
  
  // Test 2: Make several API calls to trigger telemetry initialization
  console.log("\n2. 🚀 Making API calls to trigger telemetry initialization:");
  
  const endpoints = [
    "/api/pitches/featured",
    "/api/auth/status", 
    "/api/pitches/trending",
    "/api/user/profile"
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`);
      console.log(`   📡 ${endpoint}: ${response.status}`);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.log(`   ❌ ${endpoint}: Network error`);
    }
  }
  
  // Test 3: Try to access a non-existent endpoint (should create 404 error)
  console.log("\n3. 🔍 Testing error tracking (404 errors):");
  
  const errorEndpoints = [
    "/api/test-sentry-error",
    "/api/nonexistent/endpoint",
    "/api/trigger/error"
  ];
  
  for (const endpoint of errorEndpoints) {
    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`);
      console.log(`   📡 ${endpoint}: ${response.status} (Expected 404)`);
    } catch (error) {
      console.log(`   📡 ${endpoint}: Network error (as expected)`);
    }
  }
  
  // Test 4: Check health endpoint again to see if telemetry is now initialized
  console.log("\n4. 🔍 Checking if telemetry is now initialized after API activity:");
  
  try {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    const healthResponse = await fetch(`${BACKEND_URL}/api/health`);
    const health = await healthResponse.json();
    
    console.log(`   Environment: ${health.data.telemetry.environment}`);
    console.log(`   Initialized: ${health.data.telemetry.initialized}`);
    
    if (health.data.telemetry.initialized) {
      console.log("   ✅ Sentry telemetry is now initialized!");
      console.log(`   📊 Sample Rate: ${health.data.telemetry.config.sampleRate}`);
      console.log(`   🔧 Service: ${health.data.telemetry.config.serviceName}`);
    } else {
      console.log("   ⚠️  Sentry telemetry still not initialized");
    }
    
  } catch (error) {
    console.error("   ❌ Error checking health:", error.message);
  }
}

async function testFrontendTelemetry(): Promise<void> {
  console.log("\n🌐 Frontend Telemetry Check:");
  console.log("   ✅ Frontend deployed to: https://pitchey.pages.dev");
  console.log("   📝 To validate frontend Sentry:");
  console.log("   1. Open browser dev tools");
  console.log("   2. Navigate to https://pitchey.pages.dev");
  console.log("   3. Look for Sentry initialization logs in console");
  console.log("   4. Check Network tab for Sentry requests");
}

// Run tests
console.log("🚀 Starting Sentry Integration Validation\n");
console.log("=" .repeat(50));

await testSentryInitialization();
await testFrontendTelemetry();

console.log("\n" + "=" .repeat(50));
console.log("\n✅ Test completed! Next steps:");
console.log("📊 1. Check Sentry dashboard: https://sentry.io/organizations/");
console.log("🔍 2. Look for new events and performance data");
console.log("📈 3. Verify error tracking is capturing 404s");
console.log("🌐 4. Test frontend error tracking in browser");
console.log("⚙️  5. Set up alert rules and team notifications");

console.log("\n📋 Expected Sentry Events:");
console.log("   • Performance transactions for API requests");
console.log("   • 404 error events for non-existent endpoints");
console.log("   • Frontend page loads and user interactions");
console.log("   • Structured logs with context information");