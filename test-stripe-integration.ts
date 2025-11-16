// Test Stripe Integration
// Run with: deno run --allow-net --allow-env test-stripe-integration.ts

// Test the Stripe service and payment endpoints
async function testStripeIntegration() {
  console.log("🧪 Testing Stripe Payment Integration");
  console.log("=====================================");

  // Check environment variables
  console.log("\n📋 Environment Check:");
  const requiredEnvVars = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET"
  ];

  const optionalEnvVars = [
    "STRIPE_PRICE_CREATOR_BASIC",
    "STRIPE_PRICE_CREATOR_PRO", 
    "STRIPE_PRICE_INVESTOR",
    "STRIPE_PRICE_PRODUCTION"
  ];

  let envErrors = 0;
  for (const envVar of requiredEnvVars) {
    const value = Deno.env.get(envVar);
    if (value) {
      console.log(`✅ ${envVar}: ${value.substring(0, 20)}...`);
    } else {
      console.log(`❌ ${envVar}: Missing (REQUIRED)`);
      envErrors++;
    }
  }

  for (const envVar of optionalEnvVars) {
    const value = Deno.env.get(envVar);
    if (value) {
      console.log(`✅ ${envVar}: ${value.substring(0, 20)}...`);
    } else {
      console.log(`⚠️  ${envVar}: Missing (Optional - using default)`);
    }
  }

  if (envErrors > 0) {
    console.log(`\n❌ ${envErrors} required environment variables missing.`);
    console.log("Please copy .env.stripe.example to .env.local and add your Stripe keys.");
    return false;
  }

  // Test Stripe Service Import
  console.log("\n📦 Module Import Test:");
  try {
    const { stripeService, SUBSCRIPTION_TIERS } = await import("./src/services/stripe-service.ts");
    console.log("✅ Stripe service imported successfully");
    console.log(`✅ Found ${SUBSCRIPTION_TIERS.length} subscription tiers`);
    
    // List subscription tiers
    console.log("\n💰 Subscription Tiers:");
    for (const tier of SUBSCRIPTION_TIERS) {
      console.log(`   ${tier.name}: $${tier.price}/${tier.interval} (${tier.userType})`);
    }
    
    return true;
  } catch (error) {
    console.log("❌ Failed to import Stripe service:", error.message);
    return false;
  }
}

// Test API endpoints
async function testAPIEndpoints() {
  console.log("\n🌐 API Endpoints Test:");
  const baseURL = "http://localhost:8001";
  
  const endpoints = [
    { method: "GET", path: "/api/payments/subscription-tiers" },
    { method: "GET", path: "/api/payments/subscription-status" },
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint.method} ${endpoint.path}...`);
      const response = await fetch(`${baseURL}${endpoint.path}`, {
        method: endpoint.method,
        headers: {
          "Content-Type": "application/json"
        }
      });

      if (response.ok) {
        console.log(`✅ ${endpoint.method} ${endpoint.path}: ${response.status}`);
      } else if (response.status === 401) {
        console.log(`⚠️  ${endpoint.method} ${endpoint.path}: ${response.status} (Authentication required - expected)`);
      } else {
        console.log(`⚠️  ${endpoint.method} ${endpoint.path}: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint.method} ${endpoint.path}: ${error.message}`);
    }
  }
}

// Test database connection
async function testDatabaseConnection() {
  console.log("\n🗄️  Database Connection Test:");
  try {
    const { db } = await import("./src/db/index.ts");
    console.log("✅ Database connection imported successfully");
    
    // Try to query a simple table
    const { users } = await import("./src/db/schema.ts");
    const userCount = await db.select().from(users).limit(1);
    console.log("✅ Database query executed successfully");
    
    return true;
  } catch (error) {
    console.log("❌ Database connection failed:", error.message);
    return false;
  }
}

// Run tests
async function runTests() {
  console.log("🚀 Starting Stripe Integration Tests...\n");
  
  const results = {
    environment: await testStripeIntegration(),
    database: await testDatabaseConnection(),
    api: true // API test requires server to be running
  };

  console.log("\n📊 Test Results Summary:");
  console.log("========================");
  console.log(`Environment: ${results.environment ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`Database: ${results.database ? "✅ PASS" : "❌ FAIL"}`);
  
  if (results.environment && results.database) {
    console.log("\n🎉 Core integration tests passed!");
    console.log("\n📝 Next Steps:");
    console.log("1. Start the server: PORT=8001 deno run --allow-all working-server.ts");
    console.log("2. Test API endpoints manually or with a REST client");
    console.log("3. Set up Stripe webhooks in your Stripe Dashboard");
    console.log("4. Test payment flows in your frontend application");
    
    console.log("\n🔧 Configuration Files Created:");
    console.log("- .env.stripe.example (copy to .env.local)");
    console.log("- STRIPE_PAYMENT_INTEGRATION.md (full documentation)");
    console.log("- src/services/stripe-service.ts (Stripe service)");
    console.log("- src/routes/payments.ts (payment API routes)");
    
    // Test API if server is running
    console.log("\n🌐 Testing API endpoints...");
    await testAPIEndpoints();
    
  } else {
    console.log("\n❌ Some tests failed. Please check the errors above.");
  }
}

// Run the tests
if (import.meta.main) {
  runTests();
}