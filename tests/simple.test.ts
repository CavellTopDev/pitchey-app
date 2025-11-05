import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { db } from "@/db/client.ts";
import { users, pitches } from "@/db/schema.ts";
import { PitchService } from "@/services/pitch.service.ts";

Deno.test("Simple Tests", async (t) => {
  
  await t.step("Database connection works", async () => {
    const result = await db.select().from(users).limit(1);
    assertEquals(result.length > 0, true);
  });
  
  await t.step("Can retrieve pitches", async () => {
    const result = await db.select().from(pitches).limit(5);
    assertEquals(result.length > 0, true);
  });
  
  await t.step("PitchService.getTopPitches works", async () => {
    const topPitches = await PitchService.getTopPitches(3);
    assertEquals(Array.isArray(topPitches), true);
    assertEquals(topPitches.length <= 3, true);
  });
});