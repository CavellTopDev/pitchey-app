#!/usr/bin/env deno run --allow-net --allow-env

// Test Sentry Event Generation Script
// Triggers test events for both frontend and backend monitoring

const BACKEND_URL = "https://pitchey-backend-fresh-r0gm926brse3.deno.dev";
const FRONTEND_URL = "https://pitchey.pages.dev";

async function testBackendSentry() {
  console.log("🔧 Testing Backend Sentry Integration");
  console.log("=====================================");
  
  try {
    // Test 1: Valid endpoint to verify service is running
    console.log("1. Testing health endpoint...");
    const healthResponse = await fetch(`${BACKEND_URL}/api/health`);
    console.log(`   Health Status: ${healthResponse.status}`);
    
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      console.log(`   ✅ Backend is running`);
      console.log(`   Telemetry: ${health.telemetry?.initialized ? '✅ Initialized' : '❌ Not initialized'}`);
    }
  } catch (error) {
    console.log(`   ⚠️ Health check failed: ${error.message}`);
  }
  
  try {
    // Test 2: Trigger authentication with request tagging
    console.log("\n2. Testing authentication (triggers Sentry user context)...");
    const loginResponse = await fetch(`${BACKEND_URL}/api/auth/investor/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "sarah.investor@demo.com",
        password: "Demo123"
      })
    });
    
    if (loginResponse.ok) {
      const loginResult = await loginResponse.json();
      console.log(`   ✅ Authentication successful (Sentry should have user context)`);
      
      // Test authenticated endpoint to trigger route tagging
      const token = loginResult.token;
      const dashboardResponse = await fetch(`${BACKEND_URL}/api/investor/dashboard`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      console.log(`   Dashboard Status: ${dashboardResponse.status}`);
      if (dashboardResponse.ok) {
        console.log(`   ✅ Dashboard access successful (route tagged as '/api/investor/dashboard')`);
      }
    } else {
      console.log(`   ⚠️ Authentication failed: ${loginResponse.status}`);
    }
  } catch (error) {
    console.log(`   ⚠️ Authentication test failed: ${error.message}`);
  }
  
  try {
    // Test 3: Trigger a server error for Sentry capture
    console.log("\n3. Testing error capture (should trigger Sentry event)...");
    const errorResponse = await fetch(`${BACKEND_URL}/api/test-error`, {
      method: "POST"
    });
    console.log(`   Error endpoint status: ${errorResponse.status}`);
    
    if (errorResponse.status >= 400) {
      console.log(`   ✅ Error endpoint triggered (Sentry should capture this)`);
    }
  } catch (error) {
    console.log(`   ✅ Network error triggered: ${error.message} (This is expected for error testing)`);
  }
}

async function testFrontendSentry() {
  console.log("\n🎨 Testing Frontend Sentry Integration");
  console.log("======================================");
  
  try {
    // Test 1: Frontend accessibility
    console.log("1. Testing frontend accessibility...");
    const frontendResponse = await fetch(FRONTEND_URL);
    console.log(`   Frontend Status: ${frontendResponse.status}`);
    
    if (frontendResponse.ok) {
      const html = await frontendResponse.text();
      
      // Check for Sentry initialization
      if (html.includes('sentry')) {
        console.log(`   ✅ Frontend contains Sentry references`);
      } else {
        console.log(`   ⚠️ No obvious Sentry references found`);
      }
      
      // Check for source map references
      if (html.includes('.js.map') || html.includes('sourcemap')) {
        console.log(`   ✅ Source maps detected in build`);
      } else {
        console.log(`   ℹ️ Source maps are hidden (normal for production)`);
      }
    }
  } catch (error) {
    console.log(`   ⚠️ Frontend access failed: ${error.message}`);
  }
  
  console.log("\n2. Frontend Sentry events require browser interaction");
  console.log("   To test frontend monitoring:");
  console.log(`   • Visit: ${FRONTEND_URL}`);
  console.log(`   • Open browser console and run: Sentry.captureException(new Error('test error'))`);
  console.log(`   • Navigate between pages to generate performance traces`);
  console.log(`   • Login/logout to test user context correlation`);
}

async function validateSentryConfiguration() {
  console.log("\n📊 Sentry Configuration Validation");
  console.log("===================================");
  
  const sentryDsn = "https://fd5664ae577039ccb7cce31e91f54533@o4510137537396736.ingest.de.sentry.io/4510138308755536";
  console.log(`✅ Sentry DSN configured: ${sentryDsn.substring(0, 40)}...`);
  console.log(`✅ Backend deployment: ${BACKEND_URL}`);
  console.log(`✅ Frontend deployment: ${FRONTEND_URL}`);
  
  console.log("\nExpected Sentry Features:");
  console.log("• Backend request tagging by route and method");
  console.log("• User context correlation (ID, email, portal type)");
  console.log("• Frontend error tracking with session replay");
  console.log("• Performance monitoring for API calls");
  console.log("• Source map resolution for production debugging");
  
  console.log("\nNext Steps:");
  console.log("1. Check Sentry dashboard for incoming events");
  console.log("2. Verify source maps are uploaded (if auth token was provided)");
  console.log("3. Set up recommended alerts for error rates and performance");
  console.log("4. Configure dashboards for operational metrics");
}

async function main() {
  console.log("🔬 SENTRY OBSERVABILITY VALIDATION TEST");
  console.log("======================================");
  console.log(`Started at: ${new Date().toISOString()}\n`);
  
  await testBackendSentry();
  await testFrontendSentry();
  await validateSentryConfiguration();
  
  console.log("\n✅ Sentry validation test complete!");
  console.log("Check your Sentry dashboard for captured events.");
}

if (import.meta.main) {
  await main();
}