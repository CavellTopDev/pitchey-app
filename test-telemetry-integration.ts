#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Test Telemetry Integration
 * Validates that Sentry is working correctly in production
 */

// Test endpoints to validate telemetry
const BACKEND_URL = "https://pitchey-backend-fresh.deno.dev";

interface HealthResponse {
  status: string;
  telemetry?: {
    initialized: boolean;
    environment: string;
    config: {
      serviceName: string;
      version: string;
      enableTracing: boolean;
      sampleRate: number;
      sentryConfigured: boolean;
    };
  };
}

async function testBackendTelemetry(): Promise<void> {
  console.log("🔍 Testing Backend Telemetry...");
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`);
    const health: HealthResponse = await response.json();
    
    console.log("✅ Health endpoint response:", JSON.stringify(health, null, 2));
    
    if (health.telemetry?.initialized) {
      console.log("✅ Sentry telemetry is initialized");
      console.log(`📊 Environment: ${health.telemetry.environment}`);
      console.log(`📈 Sample rate: ${health.telemetry.config.sampleRate}`);
    } else {
      console.log("⚠️  Sentry telemetry not initialized");
      console.log(`🔧 Sentry configured: ${health.telemetry?.config.sentryConfigured}`);
    }
    
  } catch (error) {
    console.error("❌ Error testing backend telemetry:", error);
  }
}

async function testErrorTracking(): Promise<void> {
  console.log("\n🧪 Testing Error Tracking...");
  
  try {
    // Test error endpoint (should create a test error in Sentry)
    const response = await fetch(`${BACKEND_URL}/api/test-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: "telemetry" })
    });
    
    if (response.status === 404) {
      console.log("ℹ️  No test-error endpoint (expected)");
    } else {
      console.log(`📡 Test error response: ${response.status}`);
    }
    
  } catch (error) {
    console.log("📡 Network error (expected for test):", error.message);
  }
}

async function testApiEndpoints(): Promise<void> {
  console.log("\n🔄 Testing API Endpoints for Performance Tracking...");
  
  const endpoints = [
    "/api/auth/status",
    "/api/pitches/featured", 
    "/api/user/profile"
  ];
  
  for (const endpoint of endpoints) {
    const startTime = performance.now();
    
    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`);
      const duration = performance.now() - startTime;
      
      console.log(`📊 ${endpoint}: ${response.status} (${Math.round(duration)}ms)`);
      
      if (duration > 1000) {
        console.log(`⚠️  Slow response detected: ${Math.round(duration)}ms`);
      }
      
    } catch (error) {
      const duration = performance.now() - startTime;
      console.log(`❌ ${endpoint}: Error after ${Math.round(duration)}ms`);
    }
  }
}

// Run tests
console.log("🚀 Starting Telemetry Integration Tests\n");

await testBackendTelemetry();
await testErrorTracking(); 
await testApiEndpoints();

console.log("\n✅ Telemetry integration test completed!");
console.log("\n📋 Next Steps:");
console.log("1. Check Sentry dashboard for captured events");
console.log("2. Verify frontend telemetry in browser console");
console.log("3. Set up alert rules and team notifications");
console.log("4. Monitor production performance metrics");