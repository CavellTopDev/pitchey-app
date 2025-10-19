import { db } from './src/db/client.ts';
import { sql } from "npm:drizzle-orm";

console.log('=== CHECKING USER TABLE SCHEMA ===');

try {
  const userColumns = await db.execute(sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    ORDER BY ordinal_position
  `);

  console.log('Users table columns:');
  userColumns.forEach(col => {
    console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}) default: ${col.column_default}`);
  });

} catch (error) {
  console.error('Schema check failed:', error.message);
}

Deno.exit(0);