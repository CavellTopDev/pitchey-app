import { neon } from "npm:@neondatabase/serverless";

const sql = neon("postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require");

console.log("🔧 Completing NDA tables schema...\n");

// Check if we need to recreate the ndas table with proper structure
const ndasColumns = await sql`
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'ndas'
`;

if (ndasColumns.length === 0 || !ndasColumns.find(c => c.column_name === 'signer_id')) {
  console.log("Recreating ndas table with proper schema...");
  
  await sql`DROP TABLE IF EXISTS ndas CASCADE`;
  
  await sql`
    CREATE TABLE ndas (
      id SERIAL PRIMARY KEY,
      pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
      signer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      nda_type VARCHAR(20) DEFAULT 'basic',
      nda_text TEXT,
      signature_data JSONB,
      access_granted BOOLEAN DEFAULT false,
      access_level VARCHAR(20) DEFAULT 'basic',
      expires_at TIMESTAMP,
      signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(pitch_id, signer_id)
    )
  `;
  console.log("✅ Created ndas table");
}

// Verify nda_requests has all needed columns
console.log("\nVerifying nda_requests table...");
const requestCols = [
  "ALTER TABLE nda_requests ADD COLUMN IF NOT EXISTS nda_type VARCHAR(20) DEFAULT 'basic'",
  "ALTER TABLE nda_requests ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE nda_requests ADD COLUMN IF NOT EXISTS custom_nda_url TEXT"
];

for (const query of requestCols) {
  await sql(query);
}
console.log("✅ nda_requests table verified");

console.log("\n✅ NDA schema complete!");
