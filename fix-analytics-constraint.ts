import { neon } from 'npm:@neondatabase/serverless@0.9.5';

const connectionString = Deno.env.get('DATABASE_URL') || 
  "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

const neonClient = neon(connectionString);

console.log('🔧 Fixing analytics_events.event_id unique constraint...');

try {
  // Add unique constraint to analytics_events.event_id
  await neonClient('ALTER TABLE analytics_events ADD CONSTRAINT analytics_events_event_id_unique UNIQUE(event_id);');
  console.log('✅ Successfully added unique constraint to analytics_events.event_id');
} catch (error: any) {
  if (error.message.includes('already exists') || error.message.includes('duplicate key name')) {
    console.log('⏭️  Unique constraint already exists, skipping');
  } else {
    console.error('❌ Error adding unique constraint:', error.message);
    throw error;
  }
}

console.log('🔍 Verifying constraint was added...');
try {
  const result = await neonClient(`
    SELECT constraint_name, constraint_type 
    FROM information_schema.table_constraints 
    WHERE table_name = 'analytics_events' 
    AND constraint_type = 'UNIQUE'
    AND constraint_name = 'analytics_events_event_id_unique';
  `);
  
  if (result.rows.length > 0) {
    console.log('✅ Unique constraint verified successfully');
  } else {
    console.log('⚠️  Constraint not found in information_schema');
  }
} catch (error: any) {
  console.warn('⚠️  Could not verify constraint:', error.message);
}

console.log('🎯 Ready to retry migrations!');