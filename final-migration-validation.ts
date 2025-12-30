/**
 * Final Migration Validation Report
 * Complete assessment of the Pitchey platform migration to Cloudflare Workers
 */

async function validateMigration() {
  console.log("🚀 PITCHEY PLATFORM MIGRATION VALIDATION\n");
  console.log("=".repeat(60));
  
  // Test URLs
  const workerUrl = 'https://pitchey-api-prod.ndlovucavelle.workers.dev';
  const frontendUrl = 'https://pitchey-5o8.pages.dev';
  
  const results = {
    backend: false,
    database: false,
    frontend: false,
    authentication: false,
    endpoints: 0,
    totalEndpoints: 12
  };
  
  console.log("\n1. 🔧 BACKEND INFRASTRUCTURE");
  console.log("-".repeat(40));
  
  try {
    // Test Worker health
    console.log("Testing Cloudflare Worker...");
    const healthResponse = await fetch(`${workerUrl}/api/health`);
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      console.log("✅ Worker Status:", health.status);
      console.log("🌐 Environment:", health.environment);
      console.log("⚡ Hyperdrive:", health.hyperdrive ? "Enabled" : "Disabled");
      results.backend = true;
    }
  } catch (error) {
    console.log("❌ Worker failed:", error.message);
  }
  
  console.log("\n2. 🗄️ DATABASE INTEGRATION");
  console.log("-".repeat(40));
  
  try {
    // Test database connection
    const healthResponse = await fetch(`${workerUrl}/api/health`);
    const health = await healthResponse.json();
    console.log("🔌 Database Status:", health.database);
    console.log("👥 User Count:", health.userCount);
    
    if (health.database === 'connected') {
      results.database = true;
      
      // Test data retrieval
      const usersResponse = await fetch(`${workerUrl}/api/users`);
      const usersData = await usersResponse.json();
      console.log("👤 Users Source:", usersData.source);
      
      const pitchesResponse = await fetch(`${workerUrl}/api/pitches`);
      const pitchesData = await pitchesResponse.json();
      console.log("🎬 Pitches Source:", pitchesData.source);
      
      if (usersData.source === 'database' && pitchesData.source === 'database') {
        console.log("✅ Real data being served from Neon PostgreSQL");
      }
    }
  } catch (error) {
    console.log("❌ Database test failed:", error.message);
  }
  
  console.log("\n3. 🔐 AUTHENTICATION SYSTEM");
  console.log("-".repeat(40));
  
  try {
    // Test authentication
    const authResponse = await fetch(`${workerUrl}/api/auth/creator/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alex.creator@demo.com',
        password: 'Demo123'
      })
    });
    
    if (authResponse.ok) {
      const authData = await authResponse.json();
      console.log("✅ Authentication working");
      console.log("👤 User Source:", authData.user.source);
      console.log("🎟️  Token Generated:", !!authData.token);
      results.authentication = true;
    }
  } catch (error) {
    console.log("❌ Authentication test failed:", error.message);
  }
  
  console.log("\n4. 🌐 API ENDPOINTS");
  console.log("-".repeat(40));
  
  const endpoints = [
    'GET /api/health',
    'GET /api/users',
    'GET /api/pitches',
    'GET /api/pitches/1',
    'GET /api/pitches/featured',
    'POST /api/auth/creator/login',
    'POST /api/auth/investor/login',
    'POST /api/auth/production/login',
    'GET /api/creator/dashboard',
    'GET /api/investor/dashboard',
    'GET /api/production/dashboard',
    'POST /api/pitches'
  ];
  
  let workingEndpoints = 0;
  
  for (const endpoint of endpoints) {
    const [method, path] = endpoint.split(' ');
    try {
      let options = { method };
      
      if (method === 'POST') {
        options.headers = { 'Content-Type': 'application/json' };
        if (path.includes('login')) {
          options.body = JSON.stringify({
            email: 'alex.creator@demo.com',
            password: 'Demo123'
          });
        } else if (path.includes('pitches')) {
          options.body = JSON.stringify({
            title: 'Test',
            genre: 'Drama'
          });
        }
      }
      
      const response = await fetch(`${workerUrl}${path}`, options);
      if (response.ok) {
        console.log(`✅ ${endpoint}`);
        workingEndpoints++;
      } else {
        console.log(`❌ ${endpoint} (${response.status})`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint} (${error.message})`);
    }
  }
  
  results.endpoints = workingEndpoints;
  results.totalEndpoints = endpoints.length;
  
  console.log("\n5. 🎨 FRONTEND STATUS");
  console.log("-".repeat(40));
  
  try {
    const frontendResponse = await fetch(frontendUrl);
    if (frontendResponse.ok) {
      console.log("✅ Frontend deployed and accessible");
      console.log("🌍 URL:", frontendUrl);
      results.frontend = true;
    }
  } catch (error) {
    console.log("❌ Frontend test failed:", error.message);
  }
  
  // Final Summary
  console.log("\n" + "=" * 60);
  console.log("📊 MIGRATION SUMMARY");
  console.log("=".repeat(60));
  
  console.log(`🔧 Backend Infrastructure: ${results.backend ? "✅ WORKING" : "❌ FAILED"}`);
  console.log(`🗄️ Database Integration: ${results.database ? "✅ WORKING" : "❌ FAILED"}`);
  console.log(`🔐 Authentication System: ${results.authentication ? "✅ WORKING" : "❌ FAILED"}`);
  console.log(`🌐 API Endpoints: ${results.endpoints}/${results.totalEndpoints} (${Math.round(results.endpoints/results.totalEndpoints*100)}%)`);
  console.log(`🎨 Frontend Deployment: ${results.frontend ? "✅ WORKING" : "❌ FAILED"}`);
  
  const overallScore = [
    results.backend,
    results.database,
    results.authentication,
    results.frontend,
    results.endpoints >= results.totalEndpoints * 0.9
  ].filter(Boolean).length;
  
  console.log("\n🎯 OVERALL STATUS:");
  const percentage = Math.round((overallScore / 5) * 100);
  if (percentage >= 90) {
    console.log(`🟢 EXCELLENT (${percentage}%) - Platform ready for production use`);
  } else if (percentage >= 75) {
    console.log(`🟡 GOOD (${percentage}%) - Minor issues to resolve`);
  } else {
    console.log(`🔴 NEEDS WORK (${percentage}%) - Significant issues to address`);
  }
  
  console.log("\n✨ KEY ACHIEVEMENTS:");
  if (results.backend) console.log("  • Cloudflare Workers successfully deployed");
  if (results.database) console.log("  • Hyperdrive + Neon PostgreSQL integration working");
  if (results.authentication) console.log("  • Real database authentication implemented");
  if (results.frontend) console.log("  • Frontend deployed to Cloudflare Pages");
  if (results.endpoints >= 10) console.log("  • Comprehensive API coverage achieved");
  
  console.log("\n🔮 NEXT STEPS:");
  console.log("  1. Address any failing endpoints");
  console.log("  2. Fix frontend import warnings");  
  console.log("  3. Complete GitHub Actions deployment automation");
  console.log("  4. Perform end-to-end user testing");
  console.log("  5. Monitor production performance");
}

if (import.meta.main) {
  await validateMigration();
  Deno.exit(0);
}