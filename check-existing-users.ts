import { neon } from "npm:@neondatabase/serverless";

const DATABASE_URL = "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DATABASE_URL);

console.log("🔍 Checking existing users...");

try {
  const users = await sql`SELECT id, email, username, user_type, company_name FROM users ORDER BY id`;
  console.log("👥 Existing users:", users);
  
  const pitches = await sql`SELECT id, user_id, title, status FROM pitches ORDER BY id`;
  console.log("🎬 Existing pitches:", pitches);
  
} catch (error) {
  console.error("❌ Error:", error);
}