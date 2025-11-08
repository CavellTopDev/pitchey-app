import { neon } from 'npm:@neondatabase/serverless@0.9.5';

const connectionString = Deno.env.get('DATABASE_URL') || 
  "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

const neonClient = neon(connectionString);

console.log('🔍 Checking analytics_events table structure...');

try {
  // Check if the table exists
  const tableExists = await neonClient(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'analytics_events';
  `);
  
  const tableCount = Array.isArray(tableExists) ? tableExists.length : 
                     (tableExists.rows ? tableExists.rows.length : 0);
                     
  if (tableCount === 0) {
    console.log('❌ analytics_events table does not exist');
    
    // Check what tables do exist
    const allTables = await neonClient(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('📋 Existing tables:');
    const tables = Array.isArray(allTables) ? allTables : (allTables.rows || []);
    tables.forEach((row: any) => {
      console.log(`  - ${row.table_name}`);
    });
  } else {
    console.log('✅ analytics_events table exists');
    
    // Check the column structure
    const columns = await neonClient(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'analytics_events'
      ORDER BY ordinal_position;
    `);
    
    console.log('📊 analytics_events columns:');
    const cols = Array.isArray(columns) ? columns : (columns.rows || []);
    cols.forEach((col: any) => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });
    
    // Check existing constraints
    const constraints = await neonClient(`
      SELECT constraint_name, constraint_type 
      FROM information_schema.table_constraints 
      WHERE table_schema = 'public' 
      AND table_name = 'analytics_events';
    `);
    
    console.log('🔐 analytics_events constraints:');
    const constraintList = Array.isArray(constraints) ? constraints : (constraints.rows || []);
    constraintList.forEach((constraint: any) => {
      console.log(`  - ${constraint.constraint_name}: ${constraint.constraint_type}`);
    });
  }
} catch (error: any) {
  console.error('❌ Error checking table:', error.message);
}