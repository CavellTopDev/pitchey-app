// Test the pitch service directly to isolate the issue
import { PitchService } from "./src/services/pitch.service.ts";

async function testPitchService() {
  console.log("🧪 Testing PitchService.getPublicPitchesWithUserType directly...");
  
  try {
    const pitches = await PitchService.getPublicPitchesWithUserType(3);
    console.log("✅ Service returned:", pitches.length, "pitches");
    
    if (pitches.length > 0) {
      console.log("First pitch:", JSON.stringify(pitches[0], null, 2));
    }
    
  } catch (error) {
    console.error("❌ Error testing pitch service:", error);
  }
  
  process.exit(0);
}

testPitchService();