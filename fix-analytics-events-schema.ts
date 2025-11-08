import { neon } from 'npm:@neondatabase/serverless@0.9.5';

const connectionString = Deno.env.get('DATABASE_URL') || 
  "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

const neonClient = neon(connectionString);

console.log('🔧 Fixing analytics_events schema to match migration expectations...');

try {
  // Add missing event_id column with UUID and unique constraint
  console.log('1️⃣ Adding event_id column to analytics_events...');
  await neonClient(`
    ALTER TABLE analytics_events 
    ADD COLUMN IF NOT EXISTS event_id UUID DEFAULT gen_random_uuid() NOT NULL;
  `);
  console.log('✅ Added event_id column');

  // Add unique constraint to event_id
  console.log('2️⃣ Adding unique constraint to event_id...');
  await neonClient(`
    ALTER TABLE analytics_events 
    ADD CONSTRAINT analytics_events_event_id_unique UNIQUE(event_id);
  `);
  console.log('✅ Added unique constraint');

} catch (error: any) {
  if (error.message.includes('already exists')) {
    console.log('⏭️  Schema elements already exist, skipping');
  } else {
    console.error('❌ Error fixing schema:', error.message);
    throw error;
  }
}

console.log('🔍 Verifying schema fix...');
try {
  const columns = await neonClient(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'analytics_events'
    AND column_name = 'event_id';
  `);
  
  const cols = Array.isArray(columns) ? columns : (columns.rows || []);
  if (cols.length > 0) {
    console.log('✅ event_id column verified:', cols[0]);
  } else {
    console.log('❌ event_id column not found');
  }

  const constraints = await neonClient(`
    SELECT constraint_name, constraint_type 
    FROM information_schema.table_constraints 
    WHERE table_schema = 'public' 
    AND table_name = 'analytics_events'
    AND constraint_name = 'analytics_events_event_id_unique';
  `);
  
  const constraintList = Array.isArray(constraints) ? constraints : (constraints.rows || []);
  if (constraintList.length > 0) {
    console.log('✅ Unique constraint verified');
  } else {
    console.log('❌ Unique constraint not found');
  }
} catch (error: any) {
  console.warn('⚠️  Could not verify schema:', error.message);
}

console.log('🎯 Schema fix complete! Migration should now succeed.');