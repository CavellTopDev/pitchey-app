import { db } from "./src/db/client.ts";
import { users, pitches } from "./src/db/schema.ts";
import { eq } from "npm:drizzle-orm@0.35.3";
import bcrypt from "npm:bcryptjs@2.4.3";

console.log("🌱 Seeding demo users in production database...");

async function seedDemoUsers() {
  try {
    // Hash the demo password
    const hashedPassword = await bcrypt.hash("Demo123", 10);
    
    // Demo users data
    const demoUsers = [
      {
        id: 1,
        email: "alex.creator@demo.com",
        username: "alexcreator",
        password: hashedPassword,
        userType: "creator" as const,
        firstName: "Alex",
        lastName: "Creator",
        bio: "Award-winning screenwriter with 10+ years of experience",
        profileImageUrl: "/avatars/alex.jpg",
        companyName: "Creative Studios",
        position: "Screenwriter",
        emailVerified: true,
        subscriptionTier: "premium" as const,
        isActive: true,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date()
      },
      {
        id: 2,
        email: "sarah.investor@demo.com",
        username: "sarahinvestor",
        password: hashedPassword,
        userType: "investor" as const,
        firstName: "Sarah",
        lastName: "Investor",
        bio: "Film financing specialist with focus on indie productions",
        profileImageUrl: "/avatars/sarah.jpg",
        companyName: "Venture Films Capital",
        position: "Managing Partner",
        emailVerified: true,
        subscriptionTier: "professional" as const,
        isActive: true,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date()
      },
      {
        id: 3,
        email: "stellar.production@demo.com",
        username: "stellarproduction",
        password: hashedPassword,
        userType: "production" as const,
        firstName: "Stellar",
        lastName: "Productions",
        bio: "Leading production company specializing in feature films",
        profileImageUrl: "/avatars/stellar.jpg",
        companyName: "Stellar Productions",
        position: "Head of Development",
        emailVerified: true,
        subscriptionTier: "enterprise" as const,
        isActive: true,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date()
      }
    ];

    // Insert or update each demo user
    for (const user of demoUsers) {
      // Check if user exists
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, user.email))
        .limit(1);

      if (existing.length > 0) {
        console.log(`✅ User ${user.email} already exists (ID: ${existing[0].id})`);
        // Update the user to ensure correct ID
        await db
          .update(users)
          .set(user)
          .where(eq(users.email, user.email));
        console.log(`📝 Updated user ${user.email}`);
      } else {
        // Insert new user with specific ID
        await db.insert(users).values(user);
        console.log(`✨ Created user ${user.email} (ID: ${user.id})`);
      }
    }

    // Create some demo pitches for testing
    const demoPitches = [
      {
        id: 1,
        userId: 1, // Alex Creator's pitch
        title: "The Last Sunset",
        logline: "A retired detective must solve one final case to save his daughter",
        genre: "thriller",
        format: "feature",
        status: "published" as const,
        shortSynopsis: "When a retired detective's daughter is kidnapped by a serial killer he failed to catch years ago, he must come out of retirement for one last case.",
        viewCount: 150,
        isFeatured: true,
        thumbnailUrl: "/thumbnails/last-sunset.jpg",
        createdAt: new Date("2024-06-01"),
        updatedAt: new Date()
      },
      {
        id: 2,
        userId: 1, // Alex Creator's second pitch
        title: "Quantum Dreams",
        logline: "A scientist discovers how to enter people's dreams",
        genre: "scifi",
        format: "series",
        status: "published" as const,
        shortSynopsis: "A quantum physicist accidentally discovers a way to enter and manipulate people's dreams, but soon realizes someone else is already there.",
        viewCount: 230,
        isFeatured: false,
        thumbnailUrl: "/thumbnails/quantum-dreams.jpg",
        createdAt: new Date("2024-07-01"),
        updatedAt: new Date()
      }
    ];

    // Insert demo pitches
    for (const pitch of demoPitches) {
      const existing = await db
        .select()
        .from(pitches)
        .where(eq(pitches.id, pitch.id))
        .limit(1);

      if (existing.length > 0) {
        console.log(`✅ Pitch "${pitch.title}" already exists`);
        // Update the pitch
        await db
          .update(pitches)
          .set(pitch)
          .where(eq(pitches.id, pitch.id));
        console.log(`📝 Updated pitch "${pitch.title}"`);
      } else {
        await db.insert(pitches).values(pitch);
        console.log(`✨ Created pitch "${pitch.title}"`);
      }
    }

    console.log("\n✅ Demo users and pitches seeded successfully!");
    
    // Verify the seeding
    const userCount = await db.select().from(users);
    const pitchCount = await db.select().from(pitches);
    
    console.log(`\n📊 Database now contains:`);
    console.log(`   - ${userCount.length} users`);
    console.log(`   - ${pitchCount.length} pitches`);

  } catch (error) {
    console.error("❌ Error seeding demo users:", error);
    throw error;
  }
}

// Run the seeding
await seedDemoUsers();
await db.$client.end();
console.log("🔌 Database connection closed");