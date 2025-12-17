import { db } from './src/db/client.ts';
import { sql } from "drizzle-orm";

console.log('=== CHECKING DATABASE STATE ===');

try {
  // Check if nda_requests table exists
  const ndaRequestsResult = await db.execute(sql`SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'nda_requests'`);
  console.log('nda_requests table exists:', ndaRequestsResult[0]?.count > 0);

  // Check if info_requests table exists
  const infoRequestsResult = await db.execute(sql`SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'info_requests'`);
  console.log('info_requests table exists:', infoRequestsResult[0]?.count > 0);

  // Check if info_request_attachments table exists
  const infoAttachmentsResult = await db.execute(sql`SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'info_request_attachments'`);
  console.log('info_request_attachments table exists:', infoAttachmentsResult[0]?.count > 0);

  // Check if world_description column exists in pitches table
  const worldDescResult = await db.execute(sql`SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'pitches' AND column_name = 'world_description'`);
  console.log('world_description column exists in pitches:', worldDescResult[0]?.count > 0);

  // List all tables
  console.log('\n=== ALL TABLES ===');
  try {
    const tablesResult = await db.execute(sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`);
    console.log('Tables found:', tablesResult.length);
    if (Array.isArray(tablesResult)) {
      tablesResult.forEach(row => console.log(row.table_name || row));
    } else {
      console.log('Tables result:', tablesResult);
    }
  } catch (tableError) {
    console.error('Error listing tables:', tableError.message);
  }

  // Check pitches table structure
  console.log('\n=== PITCHES TABLE COLUMNS ===');
  try {
    const pitchColumnsResult = await db.execute(sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'pitches' ORDER BY ordinal_position`);
    if (Array.isArray(pitchColumnsResult)) {
      pitchColumnsResult.forEach(row => console.log(`${row.column_name}: ${row.data_type}`));
    } else {
      console.log('Pitch columns result:', pitchColumnsResult);
    }
  } catch (columnError) {
    console.error('Error checking pitch columns:', columnError.message);
  }

} catch (error) {
  console.error('Database check failed:', error);
  console.error('Error details:', error.message);
}

Deno.exit(0);