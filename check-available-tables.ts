/**
 * Check available tables in Neon database
 */

import { neon } from '@neondatabase/serverless';

async function checkTables() {
  try {
    console.log('🔍 Checking available tables in Neon database...');
    
    const connectionString = 'postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
    const sql = neon(connectionString);
    
    // Get all tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    console.log(`\n📋 Found ${tables.length} tables:`);
    tables.forEach((table: any) => {
      console.log(`  - ${table.table_name}`);
    });
    
    // Check specific tables our endpoint needs
    const neededTables = [
      'pitches', 
      'users', 
      'pitch_characters', 
      'pitch_documents', 
      'pitch_views', 
      'nda_requests', 
      'investments', 
      'watchlist',
      'analytics_events'
    ];
    
    console.log('\n🔍 Checking required tables:');
    
    for (const tableName of neededTables) {
      const found = tables.some((t: any) => t.table_name === tableName);
      console.log(`  ${found ? '✅' : '❌'} ${tableName}`);
      
      if (!found) {
        console.log(`    Missing table: ${tableName}`);
      }
    }
    
    // Check pitches table structure specifically
    console.log('\n🏗️ Checking pitches table structure:');
    try {
      const pitchColumns = await sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'pitches'
        ORDER BY ordinal_position
      `;
      
      console.log(`Found ${pitchColumns.length} columns in pitches table:`);
      pitchColumns.forEach((col: any) => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
    } catch (error) {
      console.error('❌ Error checking pitches table:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  }
}

if (import.meta.main) {
  await checkTables();
}