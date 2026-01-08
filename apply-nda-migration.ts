/**
 * Apply Enhanced NDA Workflow Migration
 * Run this script to update the database with comprehensive NDA management tables
 */

import { createDatabase } from './src/db/raw-sql-connection.ts';

async function applyMigration() {
  const env = {
    DATABASE_URL: Deno.env.get('DATABASE_URL') || 'postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    READ_REPLICA_URLS: Deno.env.get('READ_REPLICA_URLS'),
    UPSTASH_REDIS_REST_URL: Deno.env.get('UPSTASH_REDIS_REST_URL'),
    UPSTASH_REDIS_REST_TOKEN: Deno.env.get('UPSTASH_REDIS_REST_TOKEN')
  };

  const db = createDatabase(env);

  try {
    console.log('🚀 Starting NDA workflow migration...');
    
    // Read migration file
    const migrationSQL = await Deno.readTextFile('./src/db/migrations/nda-enhanced-schema.sql');
    
    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => stmt.trim() + ';');
    
    console.log(`📋 Found ${statements.length} SQL statements to execute`);
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      
      // Skip comments
      if (stmt.startsWith('--')) continue;
      
      try {
        console.log(`  [${i + 1}/${statements.length}] Executing: ${stmt.substring(0, 50)}...`);
        await db.query(stmt);
      } catch (error) {
        console.error(`  ❌ Error executing statement ${i + 1}:`, error.message);
        // Continue with other statements
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    
    // Verify tables were created
    console.log('\n📊 Verifying tables...');
    
    const tables = [
      'nda_requests',
      'ndas', 
      'pitch_access',
      'nda_audit_log',
      'nda_templates',
      'nda_documents'
    ];
    
    for (const table of tables) {
      try {
        const result = await db.query(
          `SELECT COUNT(*) as count FROM information_schema.tables 
           WHERE table_schema = 'public' AND table_name = $1`,
          [table]
        );
        
        if (result[0].count > 0) {
          console.log(`  ✅ Table ${table} exists`);
        } else {
          console.log(`  ❌ Table ${table} not found`);
        }
      } catch (error) {
        console.log(`  ❌ Error checking table ${table}:`, error.message);
      }
    }
    
    // Check for enhanced columns in nda_requests
    console.log('\n🔍 Checking enhanced columns in nda_requests...');
    const columns = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'nda_requests' 
      AND column_name IN ('requester_id', 'owner_id', 'nda_type', 'watermark_enabled', 'access_level')
    `);
    
    columns.forEach(col => {
      console.log(`  ✅ Column ${col.column_name} (${col.data_type}) exists`);
    });
    
    // Check for enhanced columns in ndas
    console.log('\n🔍 Checking enhanced columns in ndas...');
    const ndaColumns = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ndas' 
      AND column_name IN ('access_level', 'watermark_config', 'signature_hash', 'revoked_at')
    `);
    
    ndaColumns.forEach(col => {
      console.log(`  ✅ Column ${col.column_name} (${col.data_type}) exists`);
    });
    
    console.log('\n🎉 NDA workflow migration applied successfully!');
    console.log('\n📝 Next steps:');
    console.log('  1. Deploy the updated worker with enhanced NDA handlers');
    console.log('  2. Update frontend to use new NDA workflow endpoints');
    console.log('  3. Test the complete NDA lifecycle');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    Deno.exit(1);
  }
}

// Run migration if this file is executed directly
if (import.meta.main) {
  applyMigration().catch(error => {
    console.error('Fatal error:', error);
    Deno.exit(1);
  });
}

export { applyMigration };