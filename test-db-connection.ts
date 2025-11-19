/**
 * Simple database connection test to diagnose issues
 */

import { neon } from '@neondatabase/serverless';

const databaseUrl = 'postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';

async function testDatabaseConnection() {
  try {
    console.log('Testing database connection...');
    const sql = neon(databaseUrl);
    
    // Test basic connection
    const connectionTest = await sql`SELECT NOW() as current_time`;
    console.log('✅ Database connected successfully:', connectionTest[0]?.current_time);
    
    // Check if pitches table exists
    const tableCheck = await sql`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'pitches' 
      ORDER BY ordinal_position;
    `;
    
    if (tableCheck.length > 0) {
      console.log('✅ Pitches table exists with columns:');
      tableCheck.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log('❌ Pitches table does not exist');
    }
    
    // Check if users table exists
    const usersCheck = await sql`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `;
    
    if (usersCheck.length > 0) {
      console.log('✅ Users table exists with columns:');
      usersCheck.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log('❌ Users table does not exist');
    }
    
    // Try a simple query to see what happens
    const simpleQuery = await sql`SELECT COUNT(*) as total FROM pitches`;
    console.log('✅ Simple count query:', simpleQuery[0]?.total, 'pitches in database');
    
    // Try getting a few sample pitches
    const samplePitches = await sql`
      SELECT id, title, genre, status, visibility 
      FROM pitches 
      LIMIT 3;
    `;
    console.log('✅ Sample pitches:', samplePitches);
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
  }
}

testDatabaseConnection();