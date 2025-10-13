#!/usr/bin/env -S deno run --allow-net --allow-env

import { neon } from "npm:@neondatabase/serverless";

const DATABASE_URL = Deno.env.get("DATABASE_URL");
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not found");
  Deno.exit(1);
}

const sql = neon(DATABASE_URL);

console.log("🔍 Debugging user ID mismatch issue...\n");

try {
  // Check all users in the database
  console.log("📋 All users in database:");
  const allUsers = await sql`SELECT id, email, username, user_type FROM users ORDER BY id`;
  
  allUsers.forEach((user: any) => {
    console.log(`  ID: ${user.id} | Email: ${user.email} | Username: ${user.username} | Type: ${user.user_type}`);
  });
  
  console.log("\n📋 All pitches and their user IDs:");
  const allPitches = await sql`
    SELECT p.id, p.title, p.user_id, u.email, u.username 
    FROM pitches p 
    LEFT JOIN users u ON p.user_id = u.id 
    ORDER BY p.id
  `;
  
  allPitches.forEach((pitch: any) => {
    console.log(`  Pitch ID: ${pitch.id} | Title: ${pitch.title} | User ID: ${pitch.user_id} | User: ${pitch.email || 'NOT FOUND'}`);
  });
  
  // Check specifically for alex.creator@demo.com
  console.log("\n🎯 Focus on alex.creator@demo.com:");
  const alexData = await sql`
    SELECT u.id, u.email, u.username, u.user_type, 
           COUNT(p.id) as pitch_count
    FROM users u 
    LEFT JOIN pitches p ON u.id = p.user_id
    WHERE u.email = 'alex.creator@demo.com'
    GROUP BY u.id, u.email, u.username, u.user_type
  `;
  
  if (alexData.length > 0) {
    const alex = alexData[0];
    console.log(`  Alex Creator User ID: ${alex.id}`);
    console.log(`  Pitch Count: ${alex.pitch_count}`);
    
    // Get specific pitches for Alex
    const alexPitches = await sql`
      SELECT id, title, status FROM pitches WHERE user_id = ${alex.id}
    `;
    console.log(`  Alex's Pitches:`);
    alexPitches.forEach((pitch: any) => {
      console.log(`    - ID: ${pitch.id} | Title: ${pitch.title} | Status: ${pitch.status}`);
    });
  } else {
    console.log("  ❌ alex.creator@demo.com not found in database!");
  }
  
  // Check for orphaned pitches (pitches with user IDs that don't exist)
  console.log("\n🔍 Checking for orphaned pitches:");
  const orphanedPitches = await sql`
    SELECT p.id, p.title, p.user_id 
    FROM pitches p 
    LEFT JOIN users u ON p.user_id = u.id 
    WHERE u.id IS NULL
  `;
  
  if (orphanedPitches.length > 0) {
    console.log("  ❌ Found orphaned pitches:");
    orphanedPitches.forEach((pitch: any) => {
      console.log(`    - Pitch ID: ${pitch.id} | Title: ${pitch.title} | User ID: ${pitch.user_id} (user not found)`);
    });
  } else {
    console.log("  ✅ No orphaned pitches found");
  }

} catch (error) {
  console.error("❌ Error:", error);
}