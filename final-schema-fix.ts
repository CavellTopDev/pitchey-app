import { neon } from "@neondatabase/serverless";

const sql = neon("postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require");

console.log("Adding final engagement columns...");

const queries = [
  "ALTER TABLE pitches ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0",
  "ALTER TABLE pitches ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0",
  "ALTER TABLE pitches ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0",
  "ALTER TABLE pitches ADD COLUMN IF NOT EXISTS bookmark_count INTEGER DEFAULT 0"
];

for (const query of queries) {
  await sql(query);
  console.log("✅ " + query.split(" ")[5]);
}

console.log("\n✅ All columns added successfully!");
