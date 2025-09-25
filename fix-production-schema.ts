// Script to fix production database schema issues
import { neon } from "npm:@neondatabase/serverless";

const connectionString = "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";
const sql = neon(connectionString);

console.log("🔧 Fixing production database schema...\n");

try {
  // Check if pitches table exists and has required columns
  console.log("1. Checking pitches table schema...");
  const pitchColumns = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'pitches'
    ORDER BY ordinal_position
  `;
  
  const columnNames = pitchColumns.map(c => c.column_name);
  console.log(`   Found ${columnNames.length} columns in pitches table`);
  
  // Check for additional_media column
  if (!columnNames.includes('additional_media')) {
    console.log("   ⚠️ Missing additional_media column - adding it...");
    await sql`
      ALTER TABLE pitches 
      ADD COLUMN IF NOT EXISTS additional_media jsonb
    `;
    console.log("   ✅ Added additional_media column");
  } else {
    console.log("   ✅ additional_media column exists");
  }
  
  // Check for other potentially missing columns
  const requiredColumns = [
    { name: 'view_count', type: 'integer', default: 0 },
    { name: 'nda_count', type: 'integer', default: 0 },
    { name: 'investor_interest_count', type: 'integer', default: 0 },
    { name: 'production_interest_count', type: 'integer', default: 0 }
  ];
  
  for (const col of requiredColumns) {
    if (!columnNames.includes(col.name)) {
      console.log(`   ⚠️ Missing ${col.name} column - adding it...`);
      // Use direct SQL strings for DDL operations
      const query = `ALTER TABLE pitches ADD COLUMN IF NOT EXISTS ${col.name} ${col.type} DEFAULT ${col.default}`;
      await sql(query);
      console.log(`   ✅ Added ${col.name} column`);
    }
  }
  
  // Check NDA requests table
  console.log("\n2. Checking nda_requests table...");
  const ndaRequestsExists = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'nda_requests'
    )
  `;
  
  if (!ndaRequestsExists[0].exists) {
    console.log("   ⚠️ nda_requests table doesn't exist - creating it...");
    await sql`
      CREATE TABLE IF NOT EXISTS nda_requests (
        id SERIAL PRIMARY KEY,
        pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
        requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        request_message TEXT,
        company_info JSONB,
        status VARCHAR(20) DEFAULT 'pending',
        responded_at TIMESTAMP,
        rejection_reason TEXT,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log("   ✅ Created nda_requests table");
  } else {
    console.log("   ✅ nda_requests table exists");
  }
  
  // Check NDAs table
  console.log("\n3. Checking ndas table...");
  const ndasExists = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'ndas'
    )
  `;
  
  if (!ndasExists[0].exists) {
    console.log("   ⚠️ ndas table doesn't exist - creating it...");
    await sql`
      CREATE TABLE IF NOT EXISTS ndas (
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
    console.log("   ✅ Created ndas table");
  } else {
    console.log("   ✅ ndas table exists");
  }
  
  // Verify pitch exists for testing
  console.log("\n4. Checking for test pitch data...");
  const pitchCount = await sql`SELECT COUNT(*) as count FROM pitches`;
  console.log(`   Found ${pitchCount[0].count} pitches in database`);
  
  if (pitchCount[0].count === '0') {
    console.log("   ⚠️ No pitches found - creating test pitch...");
    const creator = await sql`
      SELECT id FROM users WHERE email = 'alex.creator@demo.com' LIMIT 1
    `;
    
    if (creator.length > 0) {
      await sql`
        INSERT INTO pitches (
          title, logline, genre, format, budget, budget_amount,
          status, stage, creator_id, user_type, visibility,
          cover_image, short_synopsis, long_synopsis
        ) VALUES (
          'The Last Frontier',
          'A gripping sci-fi thriller about humanity''s final stand on Mars.',
          'Sci-Fi',
          'Feature Film',
          '$5M-$10M',
          7500000,
          'In Development',
          'pre-production',
          ${creator[0].id},
          'creator',
          'public',
          'https://images.unsplash.com/photo-1451187580459-43490279c0fa',
          'When Earth''s last colony on Mars faces extinction...',
          'In 2157, the Mars colony Terra Nova represents humanity''s last hope...'
        )
      `;
      console.log("   ✅ Created test pitch");
    } else {
      console.log("   ⚠️ Creator account not found - skipping test pitch creation");
    }
  }
  
  console.log("\n✅ Production database schema fixes completed!");
  
} catch (error) {
  console.error("❌ Error fixing schema:", error);
  process.exit(1);
}