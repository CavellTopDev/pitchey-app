#!/usr/bin/env -S deno run --allow-net --allow-env

// Test to debug which authentication path is being used

const BACKEND_URL = "https://pitchey-backend-fresh.deno.dev";

console.log("🔍 Debugging authentication paths...\n");

async function testAuthPaths() {
  try {
    console.log("1️⃣ Testing Creator-Specific Login Endpoint...");
    
    // Test creator-specific login
    const creatorLoginResponse = await fetch(`${BACKEND_URL}/api/auth/creator/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alex.creator@demo.com",
        password: "Demo123"
      })
    });

    console.log(`Status: ${creatorLoginResponse.status}`);
    
    if (creatorLoginResponse.ok) {
      const creatorData = await creatorLoginResponse.json();
      console.log("✅ Creator login successful!");
      console.log(`   User ID: ${creatorData.user.id}`);
      console.log(`   Email: ${creatorData.user.email}`);
      console.log(`   Source: Creator-specific endpoint`);
      
      // Decode JWT to see what's inside
      const [header, payload, signature] = creatorData.token.split('.');
      const decodedPayload = JSON.parse(atob(payload));
      console.log(`   JWT User ID: ${decodedPayload.userId}`);
    } else {
      console.error("❌ Creator login failed:", await creatorLoginResponse.text());
    }

    console.log("\n2️⃣ Testing Universal Login Endpoint...");
    
    // Test universal login
    const universalLoginResponse = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alex.creator@demo.com",
        password: "Demo123"
      })
    });

    console.log(`Status: ${universalLoginResponse.status}`);
    
    if (universalLoginResponse.ok) {
      const universalData = await universalLoginResponse.json();
      console.log("✅ Universal login successful!");
      console.log(`   User ID: ${universalData.user.id}`);
      console.log(`   Email: ${universalData.user.email}`);
      console.log(`   Source: Universal endpoint`);
      
      // Decode JWT to see what's inside
      const [header, payload, signature] = universalData.token.split('.');
      const decodedPayload = JSON.parse(atob(payload));
      console.log(`   JWT User ID: ${decodedPayload.userId}`);
    } else {
      console.error("❌ Universal login failed:", await universalLoginResponse.text());
    }

    console.log("\n3️⃣ Testing with Wrong Password to See Database Behavior...");
    
    // Test with wrong password to see if it tries database auth
    const wrongPasswordResponse = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alex.creator@demo.com",
        password: "WrongPassword123"
      })
    });

    console.log(`Status: ${wrongPasswordResponse.status}`);
    console.log("Response:", await wrongPasswordResponse.text());

  } catch (error) {
    console.error("❌ Test failed with error:", error);
  }
}

testAuthPaths();