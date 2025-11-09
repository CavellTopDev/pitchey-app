#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read

import { neon } from "npm:@neondatabase/serverless";

const sql = neon("postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require");

async function fixUserIds() {
  console.log("🔧 Fixing User IDs to match JWT tokens");
  console.log("======================================");

  try {
    // First, check current user IDs
    const users = await sql`SELECT id, email FROM users ORDER BY id`;
    console.log("\nCurrent users:");
    users.forEach(u => console.log(`  ID ${u.id}: ${u.email}`));

    // Update the sequence to start at 1001
    console.log("\n📝 Updating user IDs to match JWT tokens...");
    
    // Update alex.creator@demo.com to ID 1001
    await sql`UPDATE users SET id = 1001 WHERE email = 'alex.creator@demo.com'`;
    
    // Update sarah.investor@demo.com to ID 1002
    await sql`UPDATE users SET id = 1002 WHERE email = 'sarah.investor@demo.com'`;
    
    // Update stellar.production@demo.com to ID 1003
    await sql`UPDATE users SET id = 1003 WHERE email = 'stellar.production@demo.com'`;
    
    // Reset the sequence
    await sql`ALTER SEQUENCE users_id_seq RESTART WITH 1004`;
    
    // Update pitches to use the correct user ID
    await sql`UPDATE pitches SET user_id = 1001 WHERE user_id IN (SELECT id FROM users WHERE email = 'alex.creator@demo.com')`;
    
    // Verify the changes
    const updatedUsers = await sql`SELECT id, email, user_type FROM users ORDER BY id`;
    console.log("\n✅ Updated users:");
    updatedUsers.forEach(u => console.log(`  ID ${u.id}: ${u.email} (${u.user_type})`));
    
    const pitchCount = await sql`SELECT COUNT(*) as count FROM pitches WHERE user_id = 1001`;
    console.log(`\n✅ Pitches for creator (ID 1001): ${pitchCount[0].count}`);
    
    console.log("\n🎉 User IDs fixed successfully!");
    console.log("Now the JWT tokens will match the database IDs.");

  } catch (error) {
    console.error("❌ Error fixing user IDs:", error);
    throw error;
  }
}

// Run fix
await fixUserIds();
Deno.exit(0);