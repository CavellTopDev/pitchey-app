import { neon } from "npm:@neondatabase/serverless";

const sql = neon("postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require");

const columns = await sql`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'nda_requests'
  ORDER BY ordinal_position
`;

console.log("NDA Requests table columns:");
columns.forEach(c => console.log(`  - ${c.column_name}: ${c.data_type}`));

// Add missing columns
console.log("\nAdding missing nda_type column...");
await sql`ALTER TABLE nda_requests ADD COLUMN IF NOT EXISTS nda_type VARCHAR(20) DEFAULT 'basic'`;
console.log("✅ Added nda_type column");
