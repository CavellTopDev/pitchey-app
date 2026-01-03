#!/usr/bin/env deno run --allow-net --allow-read --allow-env

import { neon } from "https://esm.sh/@neondatabase/serverless@0.9.0";

const DATABASE_URL = Deno.env.get("DATABASE_URL") || 
  "postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-a9pr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

console.log("🔄 Applying real-time tables migration...");

try {
  const sql = neon(DATABASE_URL);
  
  // Read migration file
  const migrationSQL = await Deno.readTextFile("src/db/migrations/add-realtime-tables.sql");
  
  // Split the SQL into individual statements
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  console.log(`📝 Found ${statements.length} SQL statements to execute`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const statement of statements) {
    try {
      // Skip comments
      if (statement.startsWith('--') || statement.length === 0) continue;
      
      console.log(`\n🔧 Executing: ${statement.substring(0, 50)}...`);
      await sql(statement + ';');
      successCount++;
      console.log(`✅ Success`);
    } catch (error) {
      errorCount++;
      console.error(`❌ Error: ${error.message}`);
      
      // Continue with other statements even if one fails
      if (error.message.includes('already exists')) {
        console.log(`ℹ️  Table/index already exists, continuing...`);
      }
    }
  }
  
  console.log(`\n📊 Migration Summary:`);
  console.log(`✅ Successful statements: ${successCount}`);
  console.log(`❌ Failed statements: ${errorCount}`);
  
  // Verify tables were created
  console.log("\n🔍 Verifying tables...");
  
  const tables = ['user_presence', 'realtime_messages', 'user_channels'];
  for (const table of tables) {
    try {
      const result = await sql`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_name = ${table}
      `;
      
      if (result[0]?.count > 0) {
        console.log(`✅ Table ${table} exists`);
      } else {
        console.log(`❌ Table ${table} not found`);
      }
    } catch (error) {
      console.error(`❌ Error checking table ${table}: ${error.message}`);
    }
  }
  
  console.log("\n🎉 Migration complete!");
  
} catch (error) {
  console.error("❌ Migration failed:", error);
  Deno.exit(1);
}