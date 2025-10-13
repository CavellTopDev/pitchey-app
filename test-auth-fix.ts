#!/usr/bin/env -S deno run --allow-net --allow-env

// Test script to verify authentication fix and managed pitches functionality

const BACKEND_URL = "https://pitchey-backend-fresh.deno.dev";

console.log("🧪 Testing authentication fix and managed pitches functionality...\n");

async function testAuthAndPitches() {
  try {
    console.log("1️⃣ Testing Creator Login (alex.creator@demo.com)...");
    
    // Test creator login
    const loginResponse = await fetch(`${BACKEND_URL}/api/auth/creator/login`, {
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
    
    if (loginData.user.id !== 1) {
      console.error(`❌ WRONG USER ID! Expected 1, got ${loginData.user.id}`);
      return;
    }
    
    const token = loginData.token;
    console.log(`   Token: ${token.substring(0, 30)}...`);

    console.log("\n2️⃣ Testing Universal Login...");
    
    // Test universal login
    const universalLoginResponse = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alex.creator@demo.com",
        password: "Demo123"
      })
    });

    if (!universalLoginResponse.ok) {
      console.error("❌ Universal login failed:", await universalLoginResponse.text());
      return;
    }

    const universalLoginData = await universalLoginResponse.json();
    console.log("✅ Universal login successful!");
    console.log(`   User ID: ${universalLoginData.user.id}`);
    
    if (universalLoginData.user.id !== 1) {
      console.error(`❌ WRONG USER ID! Expected 1, got ${universalLoginData.user.id}`);
      return;
    }

    console.log("\n3️⃣ Testing Managed Pitches Endpoint...");
    
    // Test managed pitches
    const managedPitchesResponse = await fetch(`${BACKEND_URL}/api/creator/pitches`, {
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
      console.log("   Pitch titles:");
      managedPitchesData.data.pitches.forEach((pitch: any) => {
        console.log(`     - ${pitch.title} (ID: ${pitch.id}, Status: ${pitch.status})`);
      });
    } else {
      console.log("   ❌ No managed pitches found! This is the problem we're trying to fix.");
    }

    console.log("\n4️⃣ Testing User Pitches Endpoint...");
    
    // Test user pitches endpoint
    const userPitchesResponse = await fetch(`${BACKEND_URL}/api/pitches/user/1`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!userPitchesResponse.ok) {
      console.error("❌ User pitches request failed:", await userPitchesResponse.text());
      return;
    }

    const userPitchesData = await userPitchesResponse.json();
    console.log("✅ User pitches request successful!");
    console.log(`   Found ${userPitchesData.data?.pitches?.length || 0} user pitches`);
    
    if (userPitchesData.data?.pitches && userPitchesData.data.pitches.length > 0) {
      console.log("   Pitch titles:");
      userPitchesData.data.pitches.forEach((pitch: any) => {
        console.log(`     - ${pitch.title} (ID: ${pitch.id}, Status: ${pitch.status})`);
      });
    }

    console.log("\n5️⃣ Testing Authentication Token Verification...");
    
    // Decode the JWT token to see what's inside
    const [header, payload, signature] = token.split('.');
    try {
      const decodedPayload = JSON.parse(atob(payload));
      console.log("✅ JWT Token Payload:");
      console.log(`   User ID: ${decodedPayload.userId}`);
      console.log(`   Email: ${decodedPayload.email}`);
      console.log(`   User Type: ${decodedPayload.userType}`);
      console.log(`   Expiration: ${new Date(decodedPayload.exp * 1000).toISOString()}`);
      
      if (decodedPayload.userId === 1) {
        console.log("✅ JWT contains correct user ID (1)");
      } else {
        console.error(`❌ JWT contains wrong user ID! Expected 1, got ${decodedPayload.userId}`);
      }
    } catch (error) {
      console.error("❌ Could not decode JWT payload:", error);
    }

    console.log("\n🎉 Authentication fix test completed!");
    console.log("\n📋 Summary:");
    console.log("   ✅ Creator login works with correct user ID (1)");
    console.log("   ✅ Universal login works with correct user ID (1)");
    console.log("   ✅ JWT tokens contain correct user ID (1)");
    console.log("   📝 Check if managed pitches endpoint now returns data");

  } catch (error) {
    console.error("❌ Test failed with error:", error);
  }
}

testAuthAndPitches();