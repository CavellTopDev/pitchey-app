#!/usr/bin/env -S deno run --allow-env --allow-net

// Test script to verify userType is included in getNewPitches response
import { PitchService } from "./src/services/pitch.service.ts";

console.log("Testing getNewPitches with userType...");

try {
  const pitches = await PitchService.getNewPitches(5);
  
  console.log(`Found ${pitches.length} pitches`);
  
  pitches.forEach((pitch, index) => {
    console.log(`\nPitch ${index + 1}:`);
    console.log(`  Title: ${pitch.title}`);
    console.log(`  Creator: ${JSON.stringify(pitch.creator, null, 2)}`);
    
    if (pitch.creator?.userType) {
      console.log(`  ✓ UserType found: ${pitch.creator.userType}`);
    } else {
      console.log(`  ✗ UserType missing!`);
    }
  });
  
} catch (error) {
  console.error("Error:", error);
}