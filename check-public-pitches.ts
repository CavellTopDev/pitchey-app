#!/usr/bin/env -S deno run --allow-env --allow-net

import { db } from "./src/db/client.ts";
import { pitches, users } from "./src/db/schema.ts";
import { eq, desc } from "npm:drizzle-orm@0.35.3";

console.log("Checking what's in the public pitches query...");

try {
  // Replicate the exact query from getNewPitches
  const results = await db
    .select({
      id: pitches.id,
      title: pitches.title,
      status: pitches.status,
      publishedAt: pitches.publishedAt,
      userId: pitches.userId,
      // User info
      creatorId: users.id,
      creatorUsername: users.username,
      creatorEmail: users.email,
      creatorUserType: users.userType
    })
    .from(pitches)
    .leftJoin(users, eq(pitches.userId, users.id))
    .where(eq(pitches.status, "published"))
    .orderBy(desc(pitches.publishedAt))
    .limit(20);
  
  console.log(`Found ${results.length} published pitches:`);
  
  results.forEach((p, index) => {
    console.log(`${index + 1}. ID:${p.id} "${p.title}" by ${p.creatorUsername} (${p.creatorEmail}) - userType: ${p.creatorUserType} - published: ${p.publishedAt}`);
  });
  
  // Specifically check for demo accounts
  console.log("\n--- Demo account pitches ---");
  const demoPitches = results.filter(p => 
    p.creatorEmail === "stellar.production@demo.com" || 
    p.creatorEmail === "sarah.investor@demo.com"
  );
  
  console.log(`Found ${demoPitches.length} demo pitches in public list`);
  demoPitches.forEach(p => {
    console.log(`- ${p.title} by ${p.creatorUsername} (${p.creatorUserType}) - ${p.publishedAt}`);
  });
  
} catch (error) {
  console.error("Error:", error);
}