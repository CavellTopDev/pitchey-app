import { db } from "./client.ts";
import { users, pitches } from "./schema.ts";
import * as bcrypt from "npm:bcrypt";

async function seed() {
  console.log("Seeding database...");
  
  // Create test users
  const hashedPassword = await bcrypt.hash("password123");
  
  const [creator] = await db.insert(users).values({
    email: "creator@test.com",
    username: "testcreator",
    passwordHash: hashedPassword,
    userType: "creator",
    emailVerified: true,
  }).returning();
  
  const [production] = await db.insert(users).values({
    email: "production@test.com",
    username: "testproduction",
    passwordHash: hashedPassword,
    userType: "production",
    companyName: "Test Productions Ltd",
    emailVerified: true,
    companyVerified: true,
  }).returning();
  
  const [investor] = await db.insert(users).values({
    email: "investor@test.com",
    username: "testinvestor",
    passwordHash: hashedPassword,
    userType: "investor",
    emailVerified: true,
  }).returning();
  
  // Create test pitches
  const genres = ["drama", "comedy", "thriller", "scifi", "horror"];
  const formats = ["feature", "tv", "webseries"];
  
  for (let i = 0; i < 20; i++) {
    await db.insert(pitches).values({
      userId: creator.id,
      title: `Test Pitch ${i + 1}`,
      logline: `This is an exciting logline for test pitch ${i + 1} that will capture your imagination.`,
      genre: genres[i % genres.length] as any,
      format: formats[i % formats.length] as any,
      shortSynopsis: "A compelling short synopsis that reveals just enough to intrigue viewers.",
      longSynopsis: "A detailed synopsis that fully explains the story, characters, and themes...",
      status: "published",
      publishedAt: new Date(),
      viewCount: Math.floor(Math.random() * 1000),
      likeCount: Math.floor(Math.random() * 100),
      ndaCount: Math.floor(Math.random() * 50),
    });
  }
  
  console.log("Seeding complete!");
}

if (import.meta.main) {
  await seed();
  Deno.exit(0);
}