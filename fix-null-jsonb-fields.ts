// Fix null JSONB fields that are causing Drizzle ORM mapping errors
import { db } from "./src/db/client.ts";
import { sql } from "drizzle-orm";

async function fixNullJsonbFields() {
  console.log("🔧 Fixing null JSONB fields in database...");
  
  try {
    // Update pitches table - fix null additionalMaterials and additionalMedia
    console.log("1. Fixing pitches.additionalMaterials...");
    await db.execute(sql`
      UPDATE pitches 
      SET additional_materials = '[]' 
      WHERE additional_materials IS NULL
    `);
    
    console.log("2. Fixing pitches.additionalMedia...");
    await db.execute(sql`
      UPDATE pitches 
      SET additional_media = '[]' 
      WHERE additional_media IS NULL
    `);

    console.log("3. Fixing pitches.feedback...");
    await db.execute(sql`
      UPDATE pitches 
      SET feedback = '[]' 
      WHERE feedback IS NULL
    `);

    console.log("4. Fixing pitches.metadata...");
    await db.execute(sql`
      UPDATE pitches 
      SET metadata = '{}' 
      WHERE metadata IS NULL
    `);

    // Check users password_history as well
    console.log("5. Fixing users.passwordHistory...");
    await db.execute(sql`
      UPDATE users 
      SET password_history = '[]' 
      WHERE password_history IS NULL
    `);

    // Fix any other potential JSONB null issues
    console.log("6. Checking analytics events...");
    await db.execute(sql`
      UPDATE analytics_events 
      SET event_data = '{}' 
      WHERE event_data IS NULL
    `);

    // Count how many records were affected
    const pitchCount = await db.execute(sql`SELECT COUNT(*) as count FROM pitches WHERE status = 'published'`);
    console.log(`✅ Fixed JSONB fields. Found ${pitchCount.rows?.length || 0} published pitches.`);
    
    console.log("🧪 Testing query after fixes...");
    
    // Test the query that was failing
    const testResult = await db.execute(sql`
      SELECT id, title, logline, genre, additional_materials, additional_media 
      FROM pitches 
      WHERE status = 'published' 
      LIMIT 3
    `);
    
    console.log("Test query results:", testResult.rows);
    
  } catch (error) {
    console.error("❌ Error fixing JSONB fields:", error);
  }
  
  console.log("🏁 JSONB field fixes completed");
  process.exit(0);
}

fixNullJsonbFields();