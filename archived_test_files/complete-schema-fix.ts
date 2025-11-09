import { neon } from "npm:@neondatabase/serverless";

const connectionString = "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";
const sql = neon(connectionString);

console.log("🔧 Complete schema synchronization...\n");

try {
  // Get all columns from schema definition
  const schemaColumns = [
    { name: 'published_at', sql: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
    { name: 'featured', sql: 'BOOLEAN DEFAULT FALSE' },
    { name: 'trending_score', sql: 'INTEGER DEFAULT 0' },
    { name: 'last_activity_at', sql: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
    { name: 'metadata', sql: 'JSONB DEFAULT \'{}\'::jsonb' },
    { name: 'tags', sql: 'TEXT[] DEFAULT ARRAY[]::TEXT[]' },
    { name: 'audience_demographics', sql: 'JSONB DEFAULT \'{}\'::jsonb' },
    { name: 'distribution_strategy', sql: 'TEXT' },
    { name: 'marketing_hooks', sql: 'TEXT[]' },
    { name: 'unique_selling_points', sql: 'TEXT[]' },
    { name: 'comparable_films', sql: 'TEXT[]' },
    { name: 'revenue_projections', sql: 'JSONB DEFAULT \'{}\'::jsonb' },
    { name: 'investment_terms', sql: 'JSONB DEFAULT \'{}\'::jsonb' },
    { name: 'attachments', sql: 'TEXT[]' },
    { name: 'roi_projections', sql: 'TEXT' },
    { name: 'distribution_rights', sql: 'TEXT' }
  ];
  
  // Check existing columns
  const existingColumns = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'pitches'
  `;
  const columnNames = existingColumns.map(c => c.column_name);
  
  // Add missing columns
  for (const col of schemaColumns) {
    if (!columnNames.includes(col.name)) {
      console.log(`Adding ${col.name}...`);
      const query = `ALTER TABLE pitches ADD COLUMN IF NOT EXISTS ${col.name} ${col.sql}`;
      await sql(query);
      console.log(`✅ Added ${col.name}`);
    }
  }
  
  console.log("\n✅ Schema synchronization completed!");
  
  // Test the schema
  console.log("\n📊 Testing schema...");
  const testQuery = await sql`
    SELECT id, title, visibility_settings, published_at, featured 
    FROM pitches 
    LIMIT 1
  `;
  console.log("✅ Schema test successful!");
  
} catch (error) {
  console.error("❌ Error:", error.message);
}
