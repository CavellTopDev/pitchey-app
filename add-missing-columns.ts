import { neon } from "npm:@neondatabase/serverless";

const connectionString = "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";
const sql = neon(connectionString);

console.log("Adding missing columns...");

try {
  // Add visibility_settings column
  await sql`
    ALTER TABLE pitches 
    ADD COLUMN IF NOT EXISTS visibility_settings jsonb DEFAULT '{}'::jsonb
  `;
  console.log("✅ Added visibility_settings column");
  
  // Add enhanced_info_unlocked column  
  await sql`
    ALTER TABLE pitches 
    ADD COLUMN IF NOT EXISTS enhanced_info_unlocked jsonb DEFAULT '{}'::jsonb
  `;
  console.log("✅ Added enhanced_info_unlocked column");
  
  // Add any other potentially missing columns
  await sql`
    ALTER TABLE pitches 
    ADD COLUMN IF NOT EXISTS team_info jsonb DEFAULT '[]'::jsonb
  `;
  console.log("✅ Added team_info column");
  
  console.log("✅ All missing columns added!");
  
} catch (error) {
  console.error("Error:", error);
}
