// Simple test script to create a pitch for NDA testing
import { db } from "./src/db/client.ts";
import { pitches, users } from "./src/db/schema.ts";
import { eq } from "drizzle-orm";

async function createTestPitch() {
  try {
    // Get the creator user (alex.creator@demo.com)
    const [creator] = await db.select().from(users)
      .where(eq(users.email, 'alex.creator@demo.com'))
      .limit(1);

    if (!creator) {
      console.error('Creator not found');
      return;
    }

    console.log('Found creator:', creator.email, 'ID:', creator.id);

    // Create a test pitch
    const [newPitch] = await db.insert(pitches).values({
      title: "Test Movie Pitch for NDA",
      tagline: "A thrilling test adventure",
      logline: "A test movie for NDA workflow testing",
      synopsis: "This is a test movie pitch created specifically to test the NDA workflow functionality.",
      budget: 1000000,
      genre: "Action",
      targetAudience: "18-35",
      requiresNDA: true,
      visibility: "public",
      userId: creator.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    console.log('Test pitch created successfully!');
    console.log('Pitch ID:', newPitch.id);
    console.log('Title:', newPitch.title);
    console.log('Requires NDA:', newPitch.requiresNDA);

  } catch (error) {
    console.error('Error creating test pitch:', error);
  } finally {
    Deno.exit(0);
  }
}

if (import.meta.main) {
  createTestPitch();
}