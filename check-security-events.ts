import { drizzle } from 'npm:drizzle-orm/postgres-js';
import postgres from 'npm:postgres';

const sql = postgres(Deno.env.get('DATABASE_URL') || 'postgresql://postgres:password@localhost:5432/pitchey');
const db = drizzle(sql);

console.log('🔍 Checking security_events table structure...');
try {
  const result = await sql`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'security_events' 
    ORDER BY ordinal_position
  `;
  console.log('📋 Security Events table structure:');
  console.table(result);
  
  if (result.some(col => col.column_name === 'event_status')) {
    console.log('✅ event_status column EXISTS in security_events table');
  } else {
    console.log('❌ event_status column MISSING from security_events table');
    console.log('🔧 Creating event_status column...');
    await sql`ALTER TABLE security_events ADD COLUMN IF NOT EXISTS event_status varchar(20) NOT NULL DEFAULT 'unknown'`;
    console.log('✅ event_status column added successfully');
  }
} catch (error) {
  console.error('❌ Error checking table structure:', error.message);
}

await sql.end();