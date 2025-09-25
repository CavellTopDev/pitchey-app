#!/usr/bin/env -S deno run --allow-net

console.log("Testing what the backend is actually returning...");

try {
  const response = await fetch("https://pitchey-backend-htgjw78pyxs0.deno.dev/api/public/pitches");
  const data = await response.json();
  
  console.log(`Response status: ${response.status}`);
  console.log(`Number of pitches: ${data.pitches?.length || 0}`);
  
  if (data.pitches && data.pitches.length > 0) {
    console.log("\nFirst 3 pitches:");
    data.pitches.slice(0, 3).forEach((pitch, i) => {
      console.log(`${i + 1}. "${pitch.title}" by ${pitch.creator?.username} (userType: ${pitch.creator?.userType})`);
    });
    
    // Look for Stellar Productions specifically
    const stellarPitches = data.pitches.filter(p => 
      p.creator?.username === "stellarproduction" || 
      p.creator?.companyName?.includes("Stellar")
    );
    
    console.log(`\nStellar Productions pitches found: ${stellarPitches.length}`);
    stellarPitches.forEach(pitch => {
      console.log(`- "${pitch.title}" userType: ${pitch.creator?.userType}`);
    });
  }
  
  // Check for debug info
  if (data.debug) {
    console.log("\nDebug info:", JSON.stringify(data.debug, null, 2));
  }
  
} catch (error) {
  console.error("Error:", error);
}