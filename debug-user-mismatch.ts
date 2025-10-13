import { neon } from "npm:@neondatabase/serverless";

const DATABASE_URL = "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DATABASE_URL);

console.log("🔍 Debugging user ID mismatch...");

try {
  // Check all users
  const users = await sql`SELECT id, email, username, user_type FROM users ORDER BY id`;
  console.log("\n👥 Database users:", users);
  
  // Check pitches by user_id
  const pitches = await sql`SELECT id, user_id, title, status FROM pitches ORDER BY user_id, id`;
  console.log("\n🎬 All pitches by user_id:", pitches);
  
  // Specifically look for pitches where user_id = 1 (matching alex.creator@demo.com from original DB)
  const userOnePitches = await sql`SELECT * FROM pitches WHERE user_id = 1`;
  console.log("\n🎯 Pitches for user_id=1:", userOnePitches);
  
  // Check if there's a user with ID 1001
  const user1001 = await sql`SELECT * FROM users WHERE id = 1001`;
  console.log("\n🔍 User with ID 1001:", user1001);
  
  // Check if email matches
  const alexCreator = await sql`SELECT * FROM users WHERE email = 'alex.creator@demo.com'`;
  console.log("\n📧 Alex creator user:", alexCreator);
  
} catch (error) {
  console.error("❌ Error:", error);
}