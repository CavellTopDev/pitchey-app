import { neon } from 'npm:@neondatabase/serverless@0.9.5';

const connectionString = Deno.env.get('DATABASE_URL') || 
  "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

const neonClient = neon(connectionString);

console.log('🧪 Testing the specific UNIQUE constraint addition...');

try {
  // Test just the UNIQUE constraint addition part
  const result = await neonClient(`
    DO $$ BEGIN
     ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_event_id_unique" UNIQUE ("event_id");
    EXCEPTION
     WHEN duplicate_object THEN null;
    END $$;
  `);
  
  console.log('✅ UNIQUE constraint statement executed successfully');
  console.log('Result:', result);

} catch (error: any) {
  if (error.message.includes('already exists') || error.message.includes('duplicate')) {
    console.log('⏭️  Constraint already exists - this is expected behavior');
  } else {
    console.error('❌ Error testing constraint:', error.message);
    throw error;
  }
}

console.log('🎯 Migration syntax test complete!');