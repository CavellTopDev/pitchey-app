// Check the actual database schema vs Drizzle schema
import { db } from "./src/db/client.ts";
import { sql } from "npm:drizzle-orm@0.35.3";

async function checkDatabaseSchema() {
  console.log("🔍 Checking actual database schema...");
  
  try {
    // Get the table structure
    console.log("1. Getting pitches table structure:");
    const tableInfo = await db.execute(sql`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'pitches' 
      ORDER BY ordinal_position
    `);
    
    console.log("Pitches table columns:");
    tableInfo.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Get actual data from the table
    console.log("\n2. Sample pitch data from database:");
    const sampleData = await db.execute(sql`
      SELECT id, title, logline, genre, status, user_id, created_at, updated_at, published_at
      FROM pitches 
      WHERE status = 'published'
      LIMIT 1
    `);
    
    console.log("Sample data:", sampleData.rows);
    
    // Count all pitches  
    console.log("\n3. Pitch count by status:");
    const statusCount = await db.execute(sql`
      SELECT status, COUNT(*) as count 
      FROM pitches 
      GROUP BY status
    `);
    
    console.log("Status counts:", statusCount.rows);
    
  } catch (error) {
    console.error("❌ Error checking database schema:", error);
  }
  
  process.exit(0);
}

checkDatabaseSchema();