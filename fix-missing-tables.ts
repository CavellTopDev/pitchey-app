import { db } from './src/db/client.ts';
import { sql } from "npm:drizzle-orm@0.35.3";

console.log('=== FIXING MISSING DATABASE TABLES ===');

try {
  // Add world_description column to pitches table
  console.log('Adding world_description column to pitches...');
  await db.execute(sql`ALTER TABLE pitches ADD COLUMN IF NOT EXISTS world_description TEXT`);
  console.log('✅ world_description column added');

  // Create info_requests table
  console.log('Creating info_requests table...');
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS info_requests (
      id SERIAL PRIMARY KEY,
      nda_id INTEGER NOT NULL REFERENCES ndas(id) ON DELETE CASCADE,
      pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
      requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      request_type VARCHAR(50) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      priority VARCHAR(20) DEFAULT 'medium',
      status VARCHAR(50) DEFAULT 'pending',
      response TEXT,
      response_at TIMESTAMP,
      requested_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  console.log('✅ info_requests table created');

  // Create info_request_attachments table
  console.log('Creating info_request_attachments table...');
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS info_request_attachments (
      id SERIAL PRIMARY KEY,
      info_request_id INTEGER NOT NULL REFERENCES info_requests(id) ON DELETE CASCADE,
      file_name VARCHAR(255) NOT NULL,
      file_url TEXT NOT NULL,
      file_type VARCHAR(50),
      file_size INTEGER,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      uploaded_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  console.log('✅ info_request_attachments table created');

  // Create indexes for performance
  console.log('Creating indexes...');
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_info_requests_nda_id ON info_requests(nda_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_info_requests_pitch_id ON info_requests(pitch_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_info_requests_requester_id ON info_requests(requester_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_info_requests_owner_id ON info_requests(owner_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_info_requests_status ON info_requests(status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_info_request_attachments_request_id ON info_request_attachments(info_request_id)`);
  console.log('✅ Indexes created');

  // Verify the fix
  console.log('\n=== VERIFICATION ===');
  
  const infoRequestsCheck = await db.execute(sql`SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = 'info_requests'`);
  console.log('info_requests table exists:', Number(infoRequestsCheck[0]?.count) > 0);

  const infoAttachmentsCheck = await db.execute(sql`SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = 'info_request_attachments'`);
  console.log('info_request_attachments table exists:', Number(infoAttachmentsCheck[0]?.count) > 0);

  const worldDescCheck = await db.execute(sql`SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name = 'pitches' AND column_name = 'world_description'`);
  console.log('world_description column exists:', Number(worldDescCheck[0]?.count) > 0);

  // Also try direct table queries
  try {
    const infoRequestsTest = await db.execute(sql`SELECT 1 FROM info_requests LIMIT 1`);
    console.log('info_requests table directly accessible: true');
  } catch (e) {
    console.log('info_requests table directly accessible: false -', e.message);
  }

  try {
    const attachmentsTest = await db.execute(sql`SELECT 1 FROM info_request_attachments LIMIT 1`);
    console.log('info_request_attachments table directly accessible: true');
  } catch (e) {
    console.log('info_request_attachments table directly accessible: false -', e.message);
  }

  console.log('\n✅ Database schema fixes completed successfully!');

} catch (error) {
  console.error('❌ Database fix failed:', error);
  console.error('Error details:', error.message);
}

Deno.exit(0);