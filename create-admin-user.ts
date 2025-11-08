// Script to create admin user by updating existing user
import { db } from "./src/db/client.ts";
import { users } from "./src/db/schema.ts";
import { eq } from "npm:drizzle-orm@0.35.3";
import { hash } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

async function createAdminUser() {
  console.log("Creating admin user...");
  
  try {
    // Hash the password
    const hashedPassword = await hash("Demo123456");
    
    // Check if admin user already exists
    const existingAdmin = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, "admin@demo.com"))
      .limit(1);
    
    if (existingAdmin.length > 0) {
      console.log("Admin user already exists");
      return;
    }
    
    // Update sarah.investor@demo.com to be an admin (as backup admin)
    const adminResult = await db.update(users)
      .set({
        email: "admin@demo.com",
        username: "admin",
        userType: "admin",
        firstName: "System",
        lastName: "Administrator",
        companyName: "Pitchey Platform",
        passwordHash: hashedPassword,
        updatedAt: new Date()
      })
      .where(eq(users.email, "sarah.investor@demo.com"))
      .returning({ id: users.id, email: users.email });
    
    if (adminResult.length > 0) {
      console.log(`✅ Created admin user: admin@demo.com (ID: ${adminResult[0].id})`);
    } else {
      console.log("❌ Failed to create admin user");
    }
    
  } catch (error) {
    console.error("Error creating admin user:", error);
  }
  
  // List current users
  console.log("\nCurrent users:");
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
  
  allUsers.forEach(user => {
    console.log(`- ${user.email} (${user.userType}) - ${user.firstName} ${user.lastName}`);
  });
}

if (import.meta.main) {
  await createAdminUser();
  console.log("\nAdmin user setup complete!");
  Deno.exit(0);
}