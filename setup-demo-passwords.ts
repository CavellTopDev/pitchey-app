/**
 * Setup demo account passwords for Better Auth
 * Uses bcrypt to hash passwords
 */

import { hash } from "@node-rs/bcrypt";
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = "postgresql://neondb_owner:npg_YibeIGRuv40J@ep-long-dew-ab2wcez1-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

async function setupDemoPasswords() {
  const sql = neon(DATABASE_URL);
  
  // Hash the demo password
  const passwordHash = await hash("Demo123", 10);
  
  console.log("Setting up demo account passwords...");
  
  // Update all demo accounts with the hashed password
  const demoEmails = [
    'alex.creator@demo.com',
    'sarah.investor@demo.com', 
    'stellar.production@demo.com'
  ];
  
  for (const email of demoEmails) {
    await sql`
      UPDATE users 
      SET password_hash = ${passwordHash}
      WHERE email = ${email}
    `;
    console.log(`✓ Updated password for ${email}`);
  }
  
  // Also create accounts table entries for credential provider
  for (const email of demoEmails) {
    const user = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (user.length > 0) {
      const userId = user[0].id;
      
      // Check if account already exists
      const existing = await sql`
        SELECT id FROM account 
        WHERE user_id = ${userId} AND provider_id = 'credential'
      `;
      
      if (existing.length === 0) {
        await sql`
          INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
          VALUES (
            ${crypto.randomUUID()},
            ${email},
            'credential',
            ${userId},
            ${passwordHash},
            NOW(),
            NOW()
          )
        `;
        console.log(`✓ Created credential account for ${email}`);
      }
    }
  }
  
  console.log("\n✅ Demo passwords setup complete!");
  console.log("Demo accounts can now log in with password: Demo123");
}

setupDemoPasswords().catch(console.error);