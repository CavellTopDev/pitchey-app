// Create second test pitch for NDA rejection testing
import { db } from "./src/db/client.ts";
import { pitches } from "./src/db/schema.ts";

async function createSecondPitch() {
  try {
    const [newPitch] = await db.insert(pitches).values({
      title: "Rejection Test Pitch",
      userId: 1,
      logline: "For testing NDA rejection",
      synopsis: "Test pitch for rejection workflow",
      genre: "Drama",
      budget: 500000,
      visibility: "public",
      requiresNDA: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    
    console.log('Created pitch ID:', newPitch.id);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    Deno.exit(0);
  }
}

if (import.meta.main) {
  createSecondPitch();
}