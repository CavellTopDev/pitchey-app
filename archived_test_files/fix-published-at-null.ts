// Fix null publishedAt values that are breaking Drizzle ORDER BY
import { db } from "./src/db/client.ts";
import { sql } from "npm:drizzle-orm@0.35.3";

async function fixPublishedAtNull() {
  console.log("🔧 Fixing null publishedAt values...");
  
  try {
    // Update published pitches to have publishedAt = createdAt when null
    console.log("Setting publishedAt = createdAt for published pitches with null publishedAt...");
    
    const result = await db.execute(sql`
      UPDATE pitches 
      SET published_at = created_at 
      WHERE status = 'published' AND published_at IS NULL
    `);
    
    console.log(`✅ Updated publishedAt for published pitches`);
    
    // Verify the fix
    console.log("🧪 Verifying the fix...");
    const verification = await db.execute(sql`
      SELECT id, title, status, created_at, published_at
      FROM pitches 
      WHERE status = 'published'
      LIMIT 3
    `);
    
    console.log("Sample published pitches after fix:");
    verification.rows.forEach(row => {
      console.log(`  - ID ${row.id}: "${row.title}" (published: ${row.published_at})`);
    });
    
  } catch (error) {
    console.error("❌ Error fixing publishedAt:", error);
  }
  
  process.exit(0);
}

fixPublishedAtNull();