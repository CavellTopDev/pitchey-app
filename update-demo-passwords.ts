import { neon } from "@neondatabase/serverless";
import * as bcrypt from "bcryptjs";

const DATABASE_URL = "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

async function updateDemoPasswords() {
  const sql = neon(DATABASE_URL);
  
  console.log("🔐 Updating demo account passwords with bcrypt hashes...");
  
  // Hash the demo password
  const passwordHash = await bcrypt.hash("Demo123", 10);
  console.log("Generated bcrypt hash:", passwordHash);
  
  // Update demo accounts
  const demoEmails = [
    "alex.creator@demo.com",
    "sarah.investor@demo.com", 
    "stellar.production@demo.com"
  ];
  
  for (const email of demoEmails) {
    const result = await sql`
      UPDATE users 
      SET password_hash = ${passwordHash}
      WHERE email = ${email}
      RETURNING id, email
    `;
    
    if (result.length > 0) {
      console.log(`✅ Updated password for ${email}`);
    } else {
      console.log(`⚠️ User ${email} not found`);
    }
  }
  
  console.log("\n✨ Demo passwords updated successfully!");
  console.log("Demo accounts can now login with password: Demo123");
}

updateDemoPasswords().catch(console.error);