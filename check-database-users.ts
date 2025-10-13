#!/usr/bin/env -S deno run --allow-net --allow-env

import { neon } from "npm:@neondatabase/serverless";

const DATABASE_URL = Deno.env.get("DATABASE_URL");
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not found");
  Deno.exit(1);
}

const sql = neon(DATABASE_URL);

console.log("🔍 Checking database users...\n");

try {
  // Check if there are users with both ID ranges
  const allUsers = await sql`
    SELECT id, email, username, user_type, created_at 
    FROM users 
    WHERE id IN (1, 2, 3, 1001, 1002, 1003) 
    ORDER BY id
  `;
  
  console.log("Users found in database:");
  allUsers.forEach((user: any) => {
    console.log(`  ID: ${user.id} | Email: ${user.email} | Username: ${user.username} | Type: ${user.user_type}`);
  });
  
  // Specifically check for duplicate emails
  console.log("\n🔍 Checking for duplicate emails:");
  const duplicateEmails = await sql`
    SELECT email, COUNT(*) as count, array_agg(id) as user_ids
    FROM users 
    WHERE email IN ('alex.creator@demo.com', 'sarah.investor@demo.com', 'stellar.production@demo.com')
    GROUP BY email
    HAVING COUNT(*) > 1
  `;
  
  if (duplicateEmails.length > 0) {
    console.log("❌ Found duplicate emails:");
    duplicateEmails.forEach((dup: any) => {
      console.log(`  Email: ${dup.email} appears ${dup.count} times with IDs: ${dup.user_ids}`);
    });
  } else {
    console.log("✅ No duplicate emails found");
  }
  
  // Check user with highest ID to see if there are users with IDs > 1000
  const highestId = await sql`SELECT MAX(id) as max_id FROM users`;
  console.log(`\n📊 Highest user ID in database: ${highestId[0]?.max_id}`);
  
} catch (error) {
  console.error("❌ Error:", error);
}