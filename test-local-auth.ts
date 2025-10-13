#!/usr/bin/env -S deno run --allow-net --allow-env

// Test script to verify local authentication fix

const LOCAL_URL = "http://localhost:8002";

console.log("🧪 Testing LOCAL authentication fix...\n");

async function testLocalAuth() {
  try {
    console.log("1️⃣ Testing Creator Login on LOCAL server...");
    
    // Test creator login
    const loginResponse = await fetch(`${LOCAL_URL}/api/auth/creator/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alex.creator@demo.com",
        password: "Demo123"
      })
    });

    if (!loginResponse.ok) {
      console.error("❌ Creator login failed:", await loginResponse.text());
      return;
    }

    const loginData = await loginResponse.json();
    console.log("✅ Creator login successful!");
    console.log(`   User ID: ${loginData.user.id}`);
    console.log(`   Email: ${loginData.user.email}`);
    console.log(`   User Type: ${loginData.user.userType}`);
    
    if (loginData.user.id === 1) {
      console.log("🎉 SUCCESS! User ID is correct (1)");
    } else {
      console.error(`❌ WRONG USER ID! Expected 1, got ${loginData.user.id}`);
      return;
    }
    
    const token = loginData.token;

    console.log("\n2️⃣ Testing Managed Pitches with LOCAL server...");
    
    // Test managed pitches
    const managedPitchesResponse = await fetch(`${LOCAL_URL}/api/creator/pitches`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!managedPitchesResponse.ok) {
      console.error("❌ Managed pitches request failed:", await managedPitchesResponse.text());
      return;
    }

    const managedPitchesData = await managedPitchesResponse.json();
    console.log("✅ Managed pitches request successful!");
    console.log(`   Found ${managedPitchesData.data?.pitches?.length || 0} managed pitches`);
    
    if (managedPitchesData.data?.pitches && managedPitchesData.data.pitches.length > 0) {
      console.log("🎉 SUCCESS! Managed pitches are now showing:");
      managedPitchesData.data.pitches.forEach((pitch: any) => {
        console.log(`     - ${pitch.title} (ID: ${pitch.id}, Status: ${pitch.status})`);
      });
    } else {
      console.log("   ⚠️ No managed pitches found - but that might be expected if using database auth");
    }

  } catch (error) {
    console.error("❌ Test failed with error:", error);
  }
}

testLocalAuth();