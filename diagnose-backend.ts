#!/usr/bin/env -S deno run --allow-net

console.log("🔍 Diagnosing backend deployment issues...\n");

const BACKEND_URL = "https://pitchey-backend-htgjw78pyxs0.deno.dev";

try {
  // Test 1: Check if backend returns ANY pitches
  console.log("1️⃣ Testing basic API response:");
  const response = await fetch(`${BACKEND_URL}/api/public/pitches`);
  const data = await response.json();
  
  console.log(`Status: ${response.status}`);
  console.log(`Pitches found: ${data.pitches?.length || 0}`);
  
  if (data.pitches && data.pitches.length > 0) {
    const firstPitch = data.pitches[0];
    console.log(`First pitch: "${firstPitch.title}" by ${firstPitch.creator?.username}`);
    console.log(`UserType: ${firstPitch.creator?.userType}`);
    console.log(`Pitch ID: ${firstPitch.id}`);
  }
  
  // Test 2: Check if debug info exists (indicates new code)
  console.log("\n2️⃣ Checking for debug info (indicates new deployment):");
  if (data.debug) {
    console.log("✅ Debug object found:", JSON.stringify(data.debug, null, 2));
    console.log("🎉 BACKEND IS RUNNING NEW CODE!");
  } else {
    console.log("❌ No debug object - backend is running OLD CODE");
  }
  
  // Test 3: Check if we can find Stellar Productions by ID
  console.log("\n3️⃣ Testing specific pitch by ID (Stellar Productions):");
  try {
    const pitchResponse = await fetch(`${BACKEND_URL}/api/public/pitch/4`);
    if (pitchResponse.ok) {
      const pitchData = await pitchResponse.json();
      if (pitchData.pitch) {
        console.log(`✅ Pitch ID 4: "${pitchData.pitch.title}"`);
        console.log(`Creator: ${pitchData.pitch.creator?.username} (${pitchData.pitch.creator?.userType})`);
        
        if (pitchData.pitch.creator?.userType === "production") {
          console.log("🎉 INDIVIDUAL ENDPOINTS HAVE CORRECT DATA!");
        } else {
          console.log("❌ Individual endpoint also has wrong userType");
        }
      }
    } else {
      console.log(`❌ Pitch ID 4 not found (${pitchResponse.status})`);
    }
  } catch (e) {
    console.log("❌ Error fetching individual pitch:", e.message);
  }
  
  // Test 4: Check pitch IDs in list vs database
  console.log("\n4️⃣ Checking if API shows expected pitch IDs:");
  if (data.pitches) {
    const pitchIds = data.pitches.map(p => p.id).sort((a, b) => b - a);
    console.log(`API pitch IDs: [${pitchIds.slice(0, 5).join(', ')}...]`);
    console.log(`Expected Stellar IDs: [10, 9, 8, 4] (from database)`);
    
    const hasStellarIds = [10, 9, 8, 4].some(id => pitchIds.includes(id));
    if (hasStellarIds) {
      console.log("✅ Some Stellar pitch IDs found in API");
    } else {
      console.log("❌ NO Stellar pitch IDs found - WRONG DATABASE or QUERY");
    }
  }
  
  console.log("\n📊 DIAGNOSIS COMPLETE");
  
} catch (error) {
  console.error("❌ Error:", error);
}