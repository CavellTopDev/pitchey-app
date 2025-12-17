// Script to add demo users to PostgreSQL database
import { db } from "./src/db/client.ts";
import { users } from "./src/db/schema.ts";
import { eq } from "drizzle-orm";
import { hash } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// Demo users to create
const demoUsers = [
  {
    email: "alex.creator@demo.com",
    username: "alexcreator",
    password: "Demo123",
    userType: "creator",
    firstName: "Alex",
    lastName: "Filmmaker",
    companyName: "Independent Films",
  },
  {
    email: "sarah.investor@demo.com",
    username: "sarahinvestor",
    password: "Demo123",
    userType: "investor",
    firstName: "Sarah",
    lastName: "Investor",
    companyName: "Venture Capital Films",
  },
  {
    email: "stellar.production@demo.com",
    username: "stellarprod",
    password: "Demo123",
    userType: "production",
    firstName: "Stellar",
    lastName: "Productions",
    companyName: "Stellar Productions",
  },
  {
    email: "admin@demo.com",
    username: "admin",
    password: "Demo123",
    userType: "admin",
    firstName: "System",
    lastName: "Administrator",
    companyName: "Pitchey Platform",
  }
];

async function setupDemoUsers() {
  console.log("Setting up demo users in PostgreSQL...");
  
  for (const user of demoUsers) {
    try {
      // Hash the password
      const hashedPassword = await hash(user.password);
      
      // Check if user exists
      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, user.email))
        .limit(1);
      
      if (existingUser.length > 0) {
        // Update existing user's password
        await db.update(users)
          .set({
            passwordHash: hashedPassword,
            username: user.username,
            userType: user.userType,
            firstName: user.firstName,
            lastName: user.lastName,
            companyName: user.companyName,
            updatedAt: new Date()
          })
          .where(eq(users.email, user.email));
        console.log(`Updated user: ${user.email}`);
      } else {
        // Insert new user
        await db.insert(users).values({
          email: user.email,
          username: user.username,
          passwordHash: hashedPassword,
          userType: user.userType,
          firstName: user.firstName,
          lastName: user.lastName,
          companyName: user.companyName,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`Created user: ${user.email}`);
      }
    } catch (error) {
      console.error(`Error processing user ${user.email}:`, error);
    }
  }
  
  // List all users
  console.log("\nCurrent users in database:");
  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      userType: users.userType,
      firstName: users.firstName,
      lastName: users.lastName
    })
    .from(users)
    .orderBy(users.id);
  
  for (const user of allUsers) {
    console.log(`- ${user.email} (${user.userType}) - ${user.firstName} ${user.lastName}`);
  }
  
  console.log("\nDemo users setup complete!");
}

setupDemoUsers().catch(console.error);