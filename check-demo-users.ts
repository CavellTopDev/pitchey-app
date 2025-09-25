#!/usr/bin/env -S deno run --allow-env --allow-net

// Check demo user userTypes in database
import { db } from "./src/db/client.ts";
import { users, pitches } from "./src/db/schema.ts";
import { eq, or } from "npm:drizzle-orm";

console.log("Checking demo user userTypes...");

try {
  const demoUsers = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      userType: users.userType,
      companyName: users.companyName
    })
    .from(users)
    .where(or(
      eq(users.email, "stellar.production@demo.com"),
      eq(users.email, "sarah.investor@demo.com")
    ));
  
  console.log("Demo users found:", demoUsers.length);
  
  demoUsers.forEach(user => {
    console.log(`\nUser: ${user.username}`);
    console.log(`Email: ${user.email}`);
    console.log(`UserType: ${user.userType}`);
    console.log(`Company: ${user.companyName}`);
  });
  
  // Also check their pitches
  console.log("\n--- Checking pitches from demo users ---");
  
  const demoPitches = await db
    .select({
      id: pitches.id,
      title: pitches.title,
      userId: pitches.userId,
      status: pitches.status,
      creatorId: users.id,
      creatorEmail: users.email,
      creatorUserType: users.userType
    })
    .from(pitches)
    .leftJoin(users, eq(pitches.userId, users.id))
    .where(or(
      eq(users.email, "stellar.production@demo.com"),
      eq(users.email, "sarah.investor@demo.com")
    ));
    
  console.log(`\nFound ${demoPitches.length} pitches from demo accounts:`);
  demoPitches.forEach(pitch => {
    console.log(`- ${pitch.title} (${pitch.status}) by ${pitch.creatorEmail} (${pitch.creatorUserType})`);
  });
  
} catch (error) {
  console.error("Error:", error);
}