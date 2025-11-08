#!/usr/bin/env -S deno run --allow-env --allow-net

import { db } from "./src/db/client.ts";
import { pitches, users } from "./src/db/schema.ts";
import { eq, or } from "npm:drizzle-orm@0.35.3";

console.log("Getting pitch IDs from demo accounts...");

try {
  const demoPitches = await db
    .select({
      id: pitches.id,
      title: pitches.title,
      status: pitches.status,
      creatorEmail: users.email,
      creatorUserType: users.userType
    })
    .from(pitches)
    .leftJoin(users, eq(pitches.userId, users.id))
    .where(or(
      eq(users.email, "stellar.production@demo.com"),
      eq(users.email, "sarah.investor@demo.com")
    ));
    
  console.log("Demo pitch IDs:");
  demoPitches.forEach(pitch => {
    console.log(`ID: ${pitch.id} - ${pitch.title} (${pitch.status}) - ${pitch.creatorUserType}`);
  });
  
} catch (error) {
  console.error("Error:", error);
}