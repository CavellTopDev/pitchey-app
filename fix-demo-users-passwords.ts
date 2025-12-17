// Fix demo users by setting proper password hashes
import { db } from "./src/db/client.ts";
import { users } from "./src/db/schema.ts";
import { eq } from "drizzle-orm";

const demoPassword = "Demo123";

// Simple password hashing function (matches the one in working-server.ts)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

console.log("Fixing demo users with proper password hashes...");

try {
  const hashedPassword = await hashPassword(demoPassword);
  console.log("Generated password hash:", hashedPassword);

  // Update all demo users
  const demoEmails = [
    "alex.creator@demo.com",
    "sarah.investor@demo.com", 
    "stellar.production@demo.com"
  ];

  for (const email of demoEmails) {
    const result = await db.update(users)
      .set({ passwordHash: hashedPassword })
      .where(eq(users.email, email))
      .returning({ id: users.id, email: users.email });
    
    if (result.length > 0) {
      console.log(`✅ Updated password for ${email} (ID: ${result[0].id})`);
    } else {
      console.log(`❌ User not found: ${email}`);
    }
  }

  console.log("\n✅ Demo users fixed! All demo users now have password: Demo123");
  
  // Verify the fix
  console.log("\nVerifying fix...");
  const demoUsers = await db.select()
    .from(users)
    .where(eq(users.email, "alex.creator@demo.com"));
  
  if (demoUsers.length > 0 && demoUsers[0].passwordHash) {
    console.log("✅ Verification successful - alex.creator@demo.com has password hash");
  } else {
    console.log("❌ Verification failed");
  }

} catch (error) {
  console.error("Error fixing demo users:", error);
  Deno.exit(1);
}