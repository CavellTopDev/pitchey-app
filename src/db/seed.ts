import { db } from "./client.ts";
import { users, pitches } from "./schema.ts";
import * as bcrypt from "bcrypt";

async function seed() {
  console.log("Seeding database...");
  
  // Create demo users expected by tests
  const hashedPassword = await bcrypt.hash("Demo123");
  
  const [creator] = await db.insert(users).values({
    email: "alex.creator@demo.com",
    username: "alex.creator",
    passwordHash: hashedPassword,
    userType: "creator",
    emailVerified: true,
  }).returning();
  
  const [production] = await db.insert(users).values({
    email: "stellar.production@demo.com",
    username: "stellar.production",
    passwordHash: hashedPassword,
    userType: "production",
    companyName: "Stellar Pictures",
    emailVerified: true,
    companyVerified: true,
  }).returning();
  
  const [investor] = await db.insert(users).values({
    email: "sarah.investor@demo.com",
    username: "sarah.investor",
    passwordHash: hashedPassword,
    userType: "investor",
    emailVerified: true,
  }).returning();
  
  // Create demo pitches for creator
  const genres = ["drama", "comedy", "thriller", "scifi", "horror"];
  const formats = ["feature", "tv", "webseries"];
  
  for (let i = 0; i < 10; i++) {
    await db.insert(pitches).values({
      userId: creator.id,
      title: `Demo Pitch ${i + 1}`,
      logline: `Compelling logline for demo pitch ${i + 1}.`,
      genre: genres[i % genres.length] as any,
      format: formats[i % formats.length] as any,
      shortSynopsis: "Short synopsis for demo pitch.",
      longSynopsis: "Detailed demo synopsis with characters and themes.",
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