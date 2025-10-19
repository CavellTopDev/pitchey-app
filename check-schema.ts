import { db } from './src/db/client.ts';
import { sql } from 'npm:drizzle-orm';

try {
  console.log('Checking database schema...');
  
  // Check for credit-related tables
  const tables = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE '%credit%'
  `);
  console.log('Credit-related tables:', tables.rows);
  
  // Check user_credits table structure if it exists
  const userCreditsColumns = await db.execute(sql`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'user_credits'
  `);
  console.log('user_credits columns:', userCreditsColumns.rows);
  
  // Check credit_transactions table structure if it exists
  const creditTransColumns = await db.execute(sql`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'credit_transactions'
  `);
  console.log('credit_transactions columns:', creditTransColumns.rows);
  
} catch (error) {
  console.error('Error checking schema:', error);
}