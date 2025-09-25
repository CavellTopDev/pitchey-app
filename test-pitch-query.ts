import { neon } from "npm:@neondatabase/serverless";

const sql = neon("postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require");

console.log("Testing pitch query...\n");

try {
  // Simple query first
  const simple = await sql`
    SELECT id, title, status 
    FROM pitches 
    WHERE status = 'published' 
    LIMIT 5
  `;
  console.log(`✅ Simple query successful: Found ${simple.length} published pitches`);
  
  // Complex query with joins (similar to what the service might be doing)
  const complex = await sql`
    SELECT 
      p.id,
      p.title,
      p.status,
      p.genre,
      p.creator_id,
      u.username,
      u.company_name
    FROM pitches p
    LEFT JOIN users u ON p.creator_id = u.id
    WHERE p.status = 'published'
    LIMIT 5
  `;
  console.log(`✅ Complex query with joins successful: Found ${complex.length} pitches`);
  
  if (complex.length > 0) {
    console.log("\nSample pitch:");
    console.log(complex[0]);
  }
  
} catch (error) {
  console.error("❌ Query failed:", error.message);
  console.error("This is likely the error causing the API to fail");
}
