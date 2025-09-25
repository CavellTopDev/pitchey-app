import { neon } from "npm:@neondatabase/serverless";

const sql = neon("postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require");

const columns = await sql`
  SELECT column_name 
  FROM information_schema.columns 
  WHERE table_name = 'pitches' 
  AND column_name LIKE '%user%' OR column_name LIKE '%creator%' OR column_name LIKE '%owner%'
  ORDER BY ordinal_position
`;

console.log("User/Creator related columns in pitches table:");
columns.forEach(c => console.log(`  - ${c.column_name}`));

// Check actual data
const sample = await sql`
  SELECT * FROM pitches LIMIT 1
`;

const keys = Object.keys(sample[0]).filter(k => k.includes('user') || k.includes('creator') || k.includes('owner'));
console.log("\nActual user/creator columns with data:");
keys.forEach(k => console.log(`  - ${k}: ${sample[0][k]}`));
