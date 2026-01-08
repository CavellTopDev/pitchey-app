/**
 * Apply Enhanced NDA Workflow Migration - Simple Version
 */

import { neon } from 'npm:@neondatabase/serverless@1.0.2';

const DATABASE_URL = 'postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function applyMigration() {
  const sql = neon(DATABASE_URL);
  
  try {
    console.log('🚀 Starting NDA workflow migration...\n');
    
    // Add missing columns to nda_requests table
    console.log('📋 Updating nda_requests table...');
    
    await sql`ALTER TABLE nda_requests 
      ADD COLUMN IF NOT EXISTS requester_id INTEGER REFERENCES users(id)`;
    
    await sql`ALTER TABLE nda_requests 
      ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id)`;
    
    await sql`ALTER TABLE nda_requests 
      ADD COLUMN IF NOT EXISTS nda_type VARCHAR(50) DEFAULT 'standard'`;
    
    await sql`ALTER TABLE nda_requests 
      ADD COLUMN IF NOT EXISTS requested_access VARCHAR(50) DEFAULT 'standard'`;
    
    await sql`ALTER TABLE nda_requests 
      ADD COLUMN IF NOT EXISTS access_level VARCHAR(50)`;
    
    await sql`ALTER TABLE nda_requests 
      ADD COLUMN IF NOT EXISTS request_message TEXT`;
    
    await sql`ALTER TABLE nda_requests 
      ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP`;
    
    await sql`ALTER TABLE nda_requests 
      ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id)`;
    
    await sql`ALTER TABLE nda_requests 
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT`;
    
    await sql`ALTER TABLE nda_requests 
      ADD COLUMN IF NOT EXISTS custom_terms TEXT`;
    
    await sql`ALTER TABLE nda_requests 
      ADD COLUMN IF NOT EXISTS watermark_enabled BOOLEAN DEFAULT true`;
    
    await sql`ALTER TABLE nda_requests 
      ADD COLUMN IF NOT EXISTS download_enabled BOOLEAN DEFAULT false`;
    
    await sql`ALTER TABLE nda_requests 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`;
    
    console.log('  ✅ nda_requests table updated');
    
    // Note: investor_id column doesn't exist - requester_id is already present
    // No update needed
    
    // Add missing columns to ndas table
    console.log('📋 Updating ndas table...');
    
    await sql`ALTER TABLE ndas 
      ADD COLUMN IF NOT EXISTS access_level VARCHAR(50) DEFAULT 'standard'`;
    
    await sql`ALTER TABLE ndas 
      ADD COLUMN IF NOT EXISTS watermark_enabled BOOLEAN DEFAULT true`;
    
    await sql`ALTER TABLE ndas 
      ADD COLUMN IF NOT EXISTS watermark_config JSONB`;
    
    await sql`ALTER TABLE ndas 
      ADD COLUMN IF NOT EXISTS download_enabled BOOLEAN DEFAULT false`;
    
    await sql`ALTER TABLE ndas 
      ADD COLUMN IF NOT EXISTS signature_hash VARCHAR(64)`;
    
    await sql`ALTER TABLE ndas 
      ADD COLUMN IF NOT EXISTS signer_ip VARCHAR(45)`;
    
    await sql`ALTER TABLE ndas 
      ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP`;
    
    await sql`ALTER TABLE ndas 
      ADD COLUMN IF NOT EXISTS revoked_by INTEGER REFERENCES users(id)`;
    
    await sql`ALTER TABLE ndas 
      ADD COLUMN IF NOT EXISTS revocation_reason TEXT`;
    
    await sql`ALTER TABLE ndas 
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`;
    
    await sql`ALTER TABLE ndas 
      ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id)`;
    
    console.log('  ✅ ndas table updated');
    
    // Create pitch_access table
    console.log('📋 Creating pitch_access table...');
    
    await sql`CREATE TABLE IF NOT EXISTS pitch_access (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
      access_level VARCHAR(50) NOT NULL DEFAULT 'basic',
      granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      granted_via VARCHAR(50) DEFAULT 'nda',
      expires_at TIMESTAMP,
      revoked_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, pitch_id)
    )`;
    
    console.log('  ✅ pitch_access table created');
    
    // Create NDA audit log table
    console.log('📋 Creating nda_audit_log table...');
    
    await sql`CREATE TABLE IF NOT EXISTS nda_audit_log (
      id SERIAL PRIMARY KEY,
      nda_id INTEGER REFERENCES ndas(id),
      nda_request_id INTEGER REFERENCES nda_requests(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      action VARCHAR(100) NOT NULL,
      metadata JSONB,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;
    
    console.log('  ✅ nda_audit_log table created');
    
    // Create NDA templates table
    console.log('📋 Creating nda_templates table...');
    
    await sql`CREATE TABLE IF NOT EXISTS nda_templates (
      id SERIAL PRIMARY KEY,
      creator_id INTEGER NOT NULL REFERENCES users(id),
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'standard',
      content TEXT NOT NULL,
      variables JSONB,
      is_default BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;
    
    console.log('  ✅ nda_templates table created');
    
    // Create NDA documents table
    console.log('📋 Creating nda_documents table...');
    
    await sql`CREATE TABLE IF NOT EXISTS nda_documents (
      id SERIAL PRIMARY KEY,
      nda_id INTEGER NOT NULL REFERENCES ndas(id),
      template_id INTEGER REFERENCES nda_templates(id),
      document_url TEXT,
      document_hash VARCHAR(64),
      watermarked_url TEXT,
      watermark_data JSONB,
      generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      signed_document_url TEXT,
      signed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;
    
    console.log('  ✅ nda_documents table created');
    
    // Create indexes
    console.log('📋 Creating indexes...');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_nda_requests_requester ON nda_requests(requester_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_nda_requests_owner ON nda_requests(owner_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_nda_requests_pitch ON nda_requests(pitch_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_nda_requests_status ON nda_requests(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_ndas_signer ON ndas(signer_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_ndas_pitch ON ndas(pitch_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_ndas_status ON ndas(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pitch_access_user ON pitch_access(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pitch_access_pitch ON pitch_access(pitch_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_nda_audit_nda ON nda_audit_log(nda_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_nda_audit_user ON nda_audit_log(user_id)`;
    
    console.log('  ✅ Indexes created');
    
    // Verify tables
    console.log('\n📊 Verifying tables...');
    
    const tables = ['nda_requests', 'ndas', 'pitch_access', 'nda_audit_log', 'nda_templates', 'nda_documents'];
    
    for (const table of tables) {
      const result = await sql`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = ${table}
      `;
      
      if (result[0].count > 0) {
        console.log(`  ✅ Table ${table} exists`);
      } else {
        console.log(`  ❌ Table ${table} not found`);
      }
    }
    
    console.log('\n🎉 NDA workflow migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('  1. Update the worker endpoints to use enhanced NDA handlers');
    console.log('  2. Build frontend NDA management UI components');
    console.log('  3. Test the complete NDA lifecycle');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    Deno.exit(1);
  }
}

// Run migration
if (import.meta.main) {
  applyMigration().catch(error => {
    console.error('Fatal error:', error);
    Deno.exit(1);
  });
}

export { applyMigration };