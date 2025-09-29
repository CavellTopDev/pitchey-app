import { db } from "./src/db/client.ts";
import { sql } from "drizzle-orm";
import { pitchViews } from "./src/db/schema.ts";

async function checkPitchViews() {
  try {
    // Check table structure
    const columns = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'pitch_views'
    `);
    
    console.log("Table columns:", columns.rows);
    
    // Count existing views
    const viewCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM pitch_views
    `);
    
    console.log("Total views in table:", viewCount.rows[0]);
    
    // Get sample data
    const sampleData = await db.execute(sql`
      SELECT * FROM pitch_views LIMIT 5
    `);
    
    console.log("Sample data:", sampleData.rows);
    
  } catch (error) {
    console.error("Error checking pitch_views:", error);
  }
}

checkPitchViews();