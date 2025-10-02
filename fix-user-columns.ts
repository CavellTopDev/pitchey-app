#!/usr/bin/env -S deno run --allow-env --allow-net

import { neon } from "npm:@neondatabase/serverless";

const DATABASE_URL = "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DATABASE_URL);

console.log("🔧 FIXING USER TABLE COLUMNS");
console.log("============================\n");

async function fixUserColumns() {
  try {
    // Check current columns
    console.log("Checking current user table columns...");
    const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `;
    
    console.log("Current columns:");
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    // Add missing columns if they don't exist
    const requiredColumns = [
      { name: 'email_verification_token', sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255)' },
      { name: 'email_verified', sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false' },
      { name: 'last_login_at', sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP' },
      { name: 'company_number', sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS company_number VARCHAR(255)' }
    ];
    
    for (const column of requiredColumns) {
      const exists = columns.some(c => c.column_name === column.name);
      if (!exists) {
        console.log(`\nAdding missing column: ${column.name}`);
        await sql(column.sql);
        console.log(`✅ Added ${column.name}`);
      } else {
        console.log(`✅ ${column.name} already exists`);
      }
    }
    
    console.log("\n✅ User table columns fixed successfully!");
    
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
}

// Run the script
await fixUserColumns();
Deno.exit(0);