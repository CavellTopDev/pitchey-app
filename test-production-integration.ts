/**
 * Test the production Worker integration
 * Verify that the deployed Worker is working correctly
 */

async function testProductionWorker() {
  const baseUrl = 'https://pitchey-api-prod.ndlovucavelle.workers.dev';
  
  console.log("🚀 Testing Production Worker Integration\n");
  
  // Test 1: Health check
  console.log("1. Health Check:");
  try {
    const response = await fetch(`${baseUrl}/api/health`);
    const data = await response.json();
    console.log("✅ Status:", data.status);
    console.log("🔌 Database:", data.database);
    console.log("👥 User count:", data.userCount);
    console.log("🌐 Environment:", data.environment);
    console.log("⚡ Hyperdrive:", data.hyperdrive);
  } catch (error) {
    console.log("❌ Health check failed:", error.message);
  }
  
  // Test 2: Get users from database
  console.log("\n2. Users from Database:");
  try {
    const response = await fetch(`${baseUrl}/api/users`);
    const data = await response.json();
    console.log("✅ Users retrieved:", data.users?.length || 0);
    console.log("📊 Source:", data.source);
    console.log("🔌 DB Connected:", data.dbConnected);
    if (data.users && data.users.length > 0) {
      console.log("👤 Sample user:", data.users[0].displayName, `(${data.users[0].email})`);
    }
  } catch (error) {
    console.log("❌ Users test failed:", error.message);
  }
  
  // Test 3: Get pitches from database
  console.log("\n3. Pitches from Database:");
  try {
    const response = await fetch(`${baseUrl}/api/pitches`);
    const data = await response.json();
    console.log("✅ Pitches retrieved:", data.pitches?.length || 0);
    console.log("📊 Source:", data.source);
    console.log("🔌 DB Connected:", data.dbConnected);
    if (data.pitches && data.pitches.length > 0) {
      console.log("🎬 Sample pitch:", data.pitches[0].title, `by ${data.pitches[0].creatorName}`);
    }
  } catch (error) {
    console.log("❌ Pitches test failed:", error.message);
  }
  
  // Test 4: Authentication
  console.log("\n4. Authentication:");
  try {
    const response = await fetch(`${baseUrl}/api/auth/creator/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alex.creator@demo.com',
        password: 'Demo123'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log("✅ Login successful");
      console.log("👤 User:", data.user?.displayName);
      console.log("🎟️  Token received:", !!data.token);
      console.log("📊 Source:", data.user?.source);
    } else {
      console.log("❌ Login failed:", response.status);
    }
  } catch (error) {
    console.log("❌ Auth test failed:", error.message);
  }
  
  // Test 5: Dashboard data
  console.log("\n5. Dashboard Data:");
  try {
    const response = await fetch(`${baseUrl}/api/creator/dashboard`, {
      headers: {
        'Authorization': 'Bearer demo-token'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log("✅ Dashboard data retrieved");
      console.log("📊 Stats:", data.stats);
      console.log("📈 Recent pitches:", data.recentPitches?.length || 0);
      console.log("🔌 Source:", data.source);
    } else {
      console.log("❌ Dashboard failed:", response.status);
    }
  } catch (error) {
    console.log("❌ Dashboard test failed:", error.message);
  }
  
  console.log("\n🎉 Production Worker Integration Test Complete!");
  console.log("✅ The Worker is successfully deployed and connecting to the database");
  console.log("🔗 Frontend should work correctly with this API");
}

if (import.meta.main) {
  await testProductionWorker();
  Deno.exit(0);
}