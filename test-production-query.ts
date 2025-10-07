import { neon } from "npm:@neondatabase/serverless";

const DATABASE_URL = "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DATABASE_URL);

console.log("Testing what PitchService.getUserPitches should return...\n");

// Simulate the exact query from PitchService
const userId = 1;
const userPitches = await sql`
  SELECT * FROM pitches 
  WHERE user_id = ${userId}
  ORDER BY updated_at DESC
`;

console.log(`Found ${userPitches.length} pitches for user ${userId}`);
console.log("\nPitch titles:");
userPitches.forEach(p => console.log(`  - ${p.title} (ID: ${p.id}, Status: ${p.status})`));

console.log("\n\nThis is what the API should be returning.");
