#!/usr/bin/env -S deno run --allow-env --allow-net

import { db } from "./src/db/client.ts";
import { pitches, users } from "./src/db/schema.ts";
import { eq } from "npm:drizzle-orm@0.35.3";

console.log("Removing investor pitches from public marketplace...");

try {
  // Find Sarah Investor's user ID
  const sarahUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "sarah.investor@demo.com"))
    .limit(1);
  
  if (sarahUser.length === 0) {
    console.log("Sarah Investor user not found");
    Deno.exit(1);
  }
  
  const userId = sarahUser[0].id;
  console.log(`Found Sarah Investor user ID: ${userId}`);
  
  // Delete all pitches from Sarah Investor
  const deletedPitches = await db
    .delete(pitches)
    .where(eq(pitches.userId, userId))
    .returning({ id: pitches.id, title: pitches.title });
  
  console.log(`Deleted ${deletedPitches.length} investor pitches:`);
  deletedPitches.forEach(pitch => {
    console.log(`- ID: ${pitch.id} - ${pitch.title}`);
  });
  
  console.log("\n✅ Investor pitches removed from public marketplace");
  console.log("Now only Stellar Productions (production) pitches should show with PURPLE glow");
  
} catch (error) {
  console.error("Error:", error);
}