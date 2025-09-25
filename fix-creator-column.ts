import { neon } from "npm:@neondatabase/serverless";

const sql = neon("postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require");

console.log("Fixing creator_id column...");

// First check if creator_id exists
const columns = await sql`
  SELECT column_name 
  FROM information_schema.columns 
  WHERE table_name = 'pitches' AND column_name = 'creator_id'
`;

if (columns.length === 0) {
  console.log("Adding creator_id column...");
  
  // Add creator_id column and copy user_id values
  await sql`ALTER TABLE pitches ADD COLUMN IF NOT EXISTS creator_id INTEGER`;
  await sql`UPDATE pitches SET creator_id = user_id WHERE creator_id IS NULL`;
  await sql`ALTER TABLE pitches ADD CONSTRAINT fk_creator_id FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE`;
  
  console.log("✅ Added creator_id column and migrated data");
} else {
  console.log("✅ creator_id column already exists");
}

// Verify
const test = await sql`
  SELECT p.id, p.title, p.creator_id, u.username
  FROM pitches p
  LEFT JOIN users u ON p.creator_id = u.id
  LIMIT 1
`;

console.log("\n✅ Verification successful:");
console.log(test[0]);
