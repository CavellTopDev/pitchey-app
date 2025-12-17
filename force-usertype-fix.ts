#!/usr/bin/env -S deno run --allow-env --allow-net

// Force update userType for Stellar Productions pitches to show PURPLE glow
import { db } from "./src/db/client.ts";
import { pitches } from "./src/db/schema.ts";
import { eq } from "drizzle-orm";

console.log("Force updating Stellar Productions pitches to show PURPLE glow...");

try {
  // Update pitches to have explicit userType field set to "production"
  const updated = await db
    .update(pitches)
    .set({ 
      userType: "production"
    })
    .where(eq(pitches.userId, 3)) // Stellar Productions user ID
    .returning({ id: pitches.id, title: pitches.title });

  console.log(`Updated ${updated.length} Stellar Productions pitches:`);
  updated.forEach(pitch => {
    console.log(`- ID: ${pitch.id} - ${pitch.title} -> userType: production (PURPLE glow)`);
  });
  
  console.log("\n✅ Stellar Productions pitches should now show PURPLE glow in public marketplace!");
  
} catch (error) {
  console.error("Error:", error);
}