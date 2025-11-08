// Fix demo users to match hardcoded accounts in server
import { db } from "./src/db/client.ts";
import { users } from "./src/db/schema.ts";
import { eq } from "npm:drizzle-orm@0.35.3";
async function fixDemoUsers() {
  try {
    // The hardcoded demo accounts from working-server.ts
    const demoAccounts = [
      {
        id: 1,
        email: "alex.creator@demo.com",
        username: "alexcreator",
        userType: "creator",
        firstName: "Alex",
        lastName: "Creator",
        companyName: "Independent Films"
      },
      {
        id: 2,
        email: "sarah.investor@demo.com",
        username: "sarahinvestor",
        userType: "investor",
        firstName: "Sarah",
        lastName: "Investor",
        companyName: "Johnson Ventures"
      },
      {
        id: 3,
        email: "stellar.production@demo.com",
        username: "stellarproduction",
        userType: "production",
        firstName: "Stellar",
        lastName: "Production",
        companyName: "Stellar Productions"
      }
    ];

    // Use a simple hash for demo purposes (not secure, just for testing)
    const hashedPassword = "$2a$10$placeholder.hash.for.demo.users.only";

    for (const account of demoAccounts) {
      // Check if user exists
      const [existingUser] = await db.select().from(users)
        .where(eq(users.id, account.id))
        .limit(1);

      if (!existingUser) {
        // Use Drizzle insert (auto-generates ID, but we can try to set it manually after)
        await db.insert(users).values({
          email: account.email,
          username: account.username,
          password: "Demo123", // Legacy password field
          passwordHash: hashedPassword,
          userType: account.userType,
          firstName: account.firstName,
          lastName: account.lastName,
          companyName: account.companyName,
          emailVerified: true,
          createdAt: new Date()
        });
        
        console.log(`Created user ${account.email} with ID ${account.id}`);
      } else {
        console.log(`User ${account.email} already exists with ID ${account.id}`);
      }
    }

    // Reset the sequence to continue from ID 4
    await db.execute("SELECT setval('users_id_seq', 3, true)");
    console.log('Reset user ID sequence to start from 4');

  } catch (error) {
    console.error('Error fixing demo users:', error);
  } finally {
    Deno.exit(0);
  }
}

if (import.meta.main) {
  fixDemoUsers();
}