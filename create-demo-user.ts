import { db } from "./src/db/index.ts";
import { users } from "./src/db/schema.ts";
import bcrypt from "bcryptjs";

async function createDemoUser() {
  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash("Demo123", 10);
    
    // Create the demo creator user
    const [createdUser] = await db.insert(users).values({
      email: "alex.creator@demo.com",
      username: "alexcreator",
      password: hashedPassword,
      userType: "creator",
      companyName: "Independent Films",
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    console.log("✅ Demo user created:", createdUser);
    
  } catch (error: any) {
    if (error.code === '23505') {
      console.log("ℹ️ Demo user already exists");
    } else {
      console.error("❌ Error creating demo user:", error);
    }
  } finally {
    process.exit();
  }
}

createDemoUser();
