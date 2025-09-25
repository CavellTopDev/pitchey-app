import { neon } from "npm:@neondatabase/serverless";

const sql = neon("postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require");

const pitches = await sql`
  SELECT id, title, status, visibility 
  FROM pitches 
  LIMIT 10
`;

console.log("Existing pitches:");
pitches.forEach(p => {
  console.log(`  ID ${p.id}: "${p.title}" - status: ${p.status}, visibility: ${p.visibility}`);
});

// Update pitches to have proper status
console.log("\nUpdating pitch statuses...");
await sql`
  UPDATE pitches 
  SET status = 'published' 
  WHERE status IN ('In Development', 'active', 'draft') 
    AND visibility = 'public'
`;

const updated = await sql`
  SELECT COUNT(*) as count 
  FROM pitches 
  WHERE status = 'published'
`;

console.log(`✅ ${updated[0].count} pitches now have 'published' status`);
