import { neon } from "npm:@neondatabase/serverless";

const sql = neon("postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require");

try {
  // Check if pitches table has all required fields
  const columns = await sql`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'pitches'
    ORDER BY ordinal_position
  `;
  
  console.log("Pitches table columns:");
  columns.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable})`));
  
  // Try to insert a test pitch directly
  console.log("\nTrying direct insert...");
  const [pitch] = await sql`
    INSERT INTO pitches (
      user_id, title, logline, genre, format, status, 
      short_synopsis, created_at, updated_at
    ) VALUES (
      1001, 'Direct Test', 'Testing direct database insert', 
      'Drama', 'feature', 'draft', 'Test synopsis',
      NOW(), NOW()
    ) RETURNING id, title
  `;
  
  console.log("✅ Direct insert successful! Pitch ID:", pitch.id);
  
  // Clean up
  await sql`DELETE FROM pitches WHERE id = ${pitch.id}`;
  console.log("Cleaned up test pitch");
  
} catch (error) {
  console.error("❌ Database error:", error.message);
}
