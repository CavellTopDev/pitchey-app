#!/usr/bin/env deno run --allow-net --allow-env

// Test Redis Cache in Production
console.log("🔧 TESTING REDIS/UPSTASH CACHE IN PRODUCTION");
console.log("============================================");

const BACKEND_URL = "https://pitchey-backend-fresh-g5yb71mj848k.deno.dev";

// Test 1: Health endpoint to check cache status
console.log("\n1. Testing health endpoint for cache status...");
try {
  const response = await fetch(`${BACKEND_URL}/api/health`);
  if (response.ok) {
    const health = await response.json();
    console.log("✅ Health endpoint successful");
    console.log(`   Cache enabled: ${health.cache?.enabled || 'unknown'}`);
    console.log(`   Redis status: ${health.cache?.status || 'unknown'}`);
    console.log(`   Telemetry: ${health.telemetry?.initialized ? 'initialized' : 'not initialized'}`);
  } else {
    console.log(`⚠️ Health endpoint failed: ${response.status}`);
    const text = await response.text();
    console.log(`   Error: ${text.substring(0, 200)}...`);
  }
} catch (error) {
  console.log(`❌ Health endpoint error: ${error.message}`);
}

// Test 2: Try to access a cached endpoint
console.log("\n2. Testing cached endpoint (dashboard stats)...");
try {
  const response = await fetch(`${BACKEND_URL}/api/dashboard/stats`);
  console.log(`   Dashboard stats status: ${response.status}`);
  
  if (response.ok) {
    const data = await response.json();
    console.log("✅ Dashboard stats successful (should be cached)");
    console.log(`   Response keys: ${Object.keys(data).join(', ')}`);
  } else {
    console.log(`⚠️ Dashboard stats failed: ${response.status}`);
  }
} catch (error) {
  console.log(`❌ Dashboard stats error: ${error.message}`);
}

// Test 3: Try authentication to check Redis session handling
console.log("\n3. Testing authentication (Redis session)...");
try {
  const response = await fetch(`${BACKEND_URL}/api/auth/investor/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "sarah.investor@demo.com", 
      password: "Demo123"
    })
  });
  
  console.log(`   Auth status: ${response.status}`);
  
  if (response.ok) {
    const auth = await response.json();
    console.log("✅ Authentication successful");
    console.log(`   Token received: ${auth.token ? 'yes' : 'no'}`);
  } else {
    console.log(`⚠️ Authentication failed: ${response.status}`);
  }
} catch (error) {
  console.log(`❌ Authentication error: ${error.message}`);
}

console.log("\n🎯 CACHE ANALYSIS SUMMARY");
console.log("========================");
console.log("Expected with Redis/Upstash enabled:");
console.log("• Health check should show cache: { enabled: true, status: 'healthy' }");
console.log("• Dashboard endpoints should return faster on subsequent calls");
console.log("• WebSocket Redis pub/sub should be functional");
console.log("• Session management should use Redis for storage");

if (import.meta.main) {
  // Run the test
}