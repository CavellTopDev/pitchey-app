import { neon } from "npm:@neondatabase/serverless";

const sql = neon("postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require");

// Check what pitches exist
const allPitches = await sql`
  SELECT id, title, status, visibility, user_id 
  FROM pitches
`;

console.log("All pitches in database:");
allPitches.forEach(p => {
  console.log(`  ID ${p.id}: "${p.title}" - status: ${p.status}, visibility: ${p.visibility}, user_id: ${p.user_id}`);
});

// Test the query that the service would run
console.log("\nTesting service query:");
const servicePitches = await sql`
  SELECT 
    p.id,
    p.title,
    p.status,
    u.username
  FROM pitches p
  LEFT JOIN users u ON p.user_id = u.id
  WHERE p.status = 'published'
  ORDER BY p.created_at DESC
  LIMIT 20
`;

console.log(`Found ${servicePitches.length} published pitches`);
if (servicePitches.length > 0) {
  console.log("Sample:", servicePitches[0]);
}
