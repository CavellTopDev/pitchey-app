import { setupTestDB, assertEquals } from "./setup.ts";
import { PitchService } from "@/services/pitch.service.ts";
import { db } from "@/db/client.ts";
import { users, pitches } from "@/db/schema.ts";

Deno.test("Pitch Service Tests", async (t) => {
  await setupTestDB();
  
  // Get existing users from seeded data
  const allUsers = await db.select().from(users);
  const creator = allUsers.find(u => u.userType === 'creator');
  const viewer = allUsers.find(u => u.userType === 'production');
  
  await t.step("should create a pitch", async () => {
    const pitch = await PitchService.create(creator!.id, {
      title: "Test Pitch",
      logline: "A test pitch logline",
      genre: "drama",
      format: "feature",
    });
    
    assertEquals(pitch.title, "Test Pitch");
    assertEquals(pitch.status, "draft");
  });
  
  await t.step("should retrieve pitch with access control", async () => {
    const allPitches = await db.select().from(pitches);
    const firstPitch = allPitches[0];
    
    const pitch = await PitchService.getPitch(firstPitch.id, viewer!.id);
    assertEquals(pitch?.requiresNda, true);
  });
});