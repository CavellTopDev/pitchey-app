#!/usr/bin/env deno run --allow-all

async function testAPIEndpoints() {
  console.log("🔍 Testing Critical API Endpoints...");
  
  const baseUrl = "http://localhost:8001";
  let creatorToken = "";
  let investorToken = "";
  let productionToken = "";
  
  // Test 1: Authentication endpoints
  console.log("\n🔐 Testing Authentication Endpoints...");
  
  try {
    // Creator login
    console.log("Testing creator login...");
    const creatorAuth = await fetch(`${baseUrl}/api/auth/creator/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alex.creator@demo.com",
        password: "Demo123"
      })
    });
    
    if (creatorAuth.ok) {
      const data = await creatorAuth.json();
      creatorToken = data.token;
      console.log("✅ Creator login successful");
    } else {
      console.log("❌ Creator login failed:", await creatorAuth.text());
    }
    
    // Investor login
    console.log("Testing investor login...");
    const investorAuth = await fetch(`${baseUrl}/api/auth/investor/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "sarah.investor@demo.com",
        password: "Demo123"
      })
    });
    
    if (investorAuth.ok) {
      const data = await investorAuth.json();
      investorToken = data.token;
      console.log("✅ Investor login successful");
    } else {
      console.log("❌ Investor login failed:", await investorAuth.text());
    }
    
    // Production login
    console.log("Testing production login...");
    const productionAuth = await fetch(`${baseUrl}/api/auth/production/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "stellar.production@demo.com",
        password: "Demo123"
      })
    });
    
    if (productionAuth.ok) {
      const data = await productionAuth.json();
      productionToken = data.token;
      console.log("✅ Production login successful");
    } else {
      console.log("❌ Production login failed:", await productionAuth.text());
    }
    
  } catch (error) {
    console.error("❌ Authentication test failed:", error);
  }
  
  // Test 2: Public endpoints
  console.log("\n🌐 Testing Public Endpoints...");
  
  try {
    // Health check
    const health = await fetch(`${baseUrl}/health`);
    console.log(`Health check: ${health.ok ? "✅" : "❌"} (${health.status})`);
    
    // Public pitches
    const publicPitches = await fetch(`${baseUrl}/api/pitches/public`);
    if (publicPitches.ok) {
      const data = await publicPitches.json();
      console.log(`✅ Public pitches: ${data.data?.length || 0} pitches found`);
    } else {
      console.log("❌ Public pitches failed:", publicPitches.status);
    }
    
    // Browse endpoint
    const browse = await fetch(`${baseUrl}/api/browse?page=1&limit=5`);
    if (browse.ok) {
      const data = await browse.json();
      console.log(`✅ Browse endpoint: ${data.data?.pitches?.length || 0} pitches found`);
    } else {
      console.log("❌ Browse endpoint failed:", browse.status);
    }
    
  } catch (error) {
    console.error("❌ Public endpoints test failed:", error);
  }
  
  // Test 3: Creator-specific endpoints
  if (creatorToken) {
    console.log("\n👨‍🎨 Testing Creator Endpoints...");
    
    try {
      // Creator dashboard
      const dashboard = await fetch(`${baseUrl}/api/dashboard/creator`, {
        headers: { "Authorization": `Bearer ${creatorToken}` }
      });
      
      if (dashboard.ok) {
        const data = await dashboard.json();
        console.log("✅ Creator dashboard:", {
          pitches: data.data?.pitches?.length || 0,
          stats: !!data.data?.stats
        });
      } else {
        console.log("❌ Creator dashboard failed:", dashboard.status);
      }
      
      // Get creator pitches
      const pitches = await fetch(`${baseUrl}/api/pitches/mine`, {
        headers: { "Authorization": `Bearer ${creatorToken}` }
      });
      
      if (pitches.ok) {
        const data = await pitches.json();
        console.log(`✅ Creator pitches: ${data.data?.length || 0} pitches`);
      } else {
        console.log("❌ Creator pitches failed:", pitches.status);
      }
      
    } catch (error) {
      console.error("❌ Creator endpoints test failed:", error);
    }
  }
  
  // Test 4: Investor-specific endpoints
  if (investorToken) {
    console.log("\n💰 Testing Investor Endpoints...");
    
    try {
      // Investor dashboard
      const dashboard = await fetch(`${baseUrl}/api/dashboard/investor`, {
        headers: { "Authorization": `Bearer ${investorToken}` }
      });
      
      if (dashboard.ok) {
        const data = await dashboard.json();
        console.log("✅ Investor dashboard:", {
          hasWatchlist: !!data.data?.watchlist,
          hasMetrics: !!data.data?.metrics
        });
      } else {
        console.log("❌ Investor dashboard failed:", dashboard.status);
      }
      
      // Browse for investment
      const investorBrowse = await fetch(`${baseUrl}/api/browse/investor`, {
        headers: { "Authorization": `Bearer ${investorToken}` }
      });
      
      if (investorBrowse.ok) {
        const data = await investorBrowse.json();
        console.log(`✅ Investor browse: ${data.data?.pitches?.length || 0} pitches`);
      } else {
        console.log("❌ Investor browse failed:", investorBrowse.status);
      }
      
    } catch (error) {
      console.error("❌ Investor endpoints test failed:", error);
    }
  }
  
  // Test 5: Production-specific endpoints
  if (productionToken) {
    console.log("\n🎬 Testing Production Endpoints...");
    
    try {
      // Production dashboard
      const dashboard = await fetch(`${baseUrl}/api/dashboard/production`, {
        headers: { "Authorization": `Bearer ${productionToken}` }
      });
      
      if (dashboard.ok) {
        const data = await dashboard.json();
        console.log("✅ Production dashboard:", {
          hasProjects: !!data.data?.projects,
          hasMetrics: !!data.data?.metrics
        });
      } else {
        console.log("❌ Production dashboard failed:", dashboard.status);
      }
      
    } catch (error) {
      console.error("❌ Production endpoints test failed:", error);
    }
  }
  
  // Test 6: NDA endpoints
  console.log("\n📋 Testing NDA Endpoints...");
  
  if (creatorToken && investorToken) {
    try {
      // Get NDA requests as creator
      const ndaRequests = await fetch(`${baseUrl}/api/nda/requests`, {
        headers: { "Authorization": `Bearer ${creatorToken}` }
      });
      
      if (ndaRequests.ok) {
        const data = await ndaRequests.json();
        console.log(`✅ NDA requests: ${data.data?.length || 0} requests`);
      } else {
        console.log("❌ NDA requests failed:", ndaRequests.status);
      }
      
    } catch (error) {
      console.error("❌ NDA endpoints test failed:", error);
    }
  }
  
  // Test 7: Search endpoints
  console.log("\n🔍 Testing Search Endpoints...");
  
  try {
    const search = await fetch(`${baseUrl}/api/search?q=test&type=pitches`);
    
    if (search.ok) {
      const data = await search.json();
      console.log(`✅ Search: ${data.data?.results?.length || 0} results`);
    } else {
      console.log("❌ Search failed:", search.status);
    }
    
  } catch (error) {
    console.error("❌ Search endpoints test failed:", error);
  }
  
  // Test 8: Rate limiting
  console.log("\n⏱️ Testing Rate Limiting...");
  
  try {
    const requests = [];
    for (let i = 0; i < 5; i++) {
      requests.push(fetch(`${baseUrl}/health`));
    }
    
    const responses = await Promise.all(requests);
    const successCount = responses.filter(r => r.ok).length;
    console.log(`✅ Rate limiting test: ${successCount}/5 requests succeeded`);
    
  } catch (error) {
    console.error("❌ Rate limiting test failed:", error);
  }
  
  console.log("\n🎯 API endpoint tests completed!");
}

// Run the test
if (import.meta.main) {
  await testAPIEndpoints();
}