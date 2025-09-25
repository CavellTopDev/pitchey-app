import { neon } from "npm:@neondatabase/serverless";

const sql = neon("postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require");

console.log("Syncing user columns...");

// Ensure user_id has proper foreign key constraint
try {
  // Check if foreign key exists
  const constraints = await sql`
    SELECT constraint_name 
    FROM information_schema.table_constraints 
    WHERE table_name = 'pitches' 
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%user_id%'
  `;
  
  if (constraints.length === 0) {
    console.log("Adding foreign key constraint for user_id...");
    await sql`
      ALTER TABLE pitches 
      ADD CONSTRAINT fk_user_id 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    `;
    console.log("✅ Added foreign key constraint");
  } else {
    console.log("✅ Foreign key already exists");
  }
  
  // Ensure both columns have same data
  await sql`UPDATE pitches SET creator_id = user_id WHERE creator_id != user_id OR creator_id IS NULL`;
  
  console.log("✅ Columns synchronized");
  
  // Test the relation query
  const test = await sql`
    SELECT 
      p.id,
      p.title,
      p.user_id,
      p.creator_id,
      u.username
    FROM pitches p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.status = 'published'
    LIMIT 1
  `;
  
  console.log("\n✅ Test successful:");
  console.log(test[0]);
  
} catch (error) {
  console.error("Error:", error.message);
}
