#!/usr/bin/env -S deno run --allow-net --allow-env

// Test script to check what data the backend returns for pitches

const backendUrl = "https://pitchey-backend.deno.dev";

async function checkPitchData() {
  console.log("Checking pitch data from backend...\n");

  // First, login with a test account
  const loginResponse = await fetch(`${backendUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "warner@pitchey.com",
      password: "test123456"
    })
  });

  if (!loginResponse.ok) {
    console.error("Failed to login:", await loginResponse.text());
    return;
  }

  const loginData = await loginResponse.json();
  const token = loginData.token;
  console.log("✅ Logged in successfully\n");

  // Now fetch pitches
  const pitchesResponse = await fetch(`${backendUrl}/api/pitches`, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  if (!pitchesResponse.ok) {
    console.error("Failed to fetch pitches:", await pitchesResponse.text());
    return;
  }

  const pitchesData = await pitchesResponse.json();
  console.log(`Found ${pitchesData.pitches?.length || 0} pitches\n`);

  // Check the structure of each pitch
  if (pitchesData.pitches && pitchesData.pitches.length > 0) {
    console.log("Sample pitch data structure:");
    const samplePitch = pitchesData.pitches[0];
    
    console.log("\nPitch ID:", samplePitch.id);
    console.log("Title:", samplePitch.title);
    console.log("User ID:", samplePitch.userId);
    console.log("User Type (pitch level):", samplePitch.userType);
    
    if (samplePitch.creator) {
      console.log("\n✅ Creator object found:");
      console.log("  - ID:", samplePitch.creator.id);
      console.log("  - Username:", samplePitch.creator.username);
      console.log("  - Company Name:", samplePitch.creator.companyName);
      console.log("  - User Type:", samplePitch.creator.userType);
    } else {
      console.log("\n❌ No creator object found!");
    }

    // Check a few more pitches to see variety
    console.log("\n--- Checking all pitches for user types ---");
    pitchesData.pitches.forEach((pitch: any) => {
      const creatorInfo = pitch.creator ? 
        `${pitch.creator.username || pitch.creator.companyName} (${pitch.creator.userType})` : 
        "NO CREATOR";
      console.log(`${pitch.id}: ${pitch.title} - Creator: ${creatorInfo}`);
    });
  }
}

checkPitchData().catch(console.error);