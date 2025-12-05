import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './src/db/schema.ts';
import { eq } from 'drizzle-orm';

const DATABASE_URL = "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

async function testDatabase() {
  try {
    const sql = neon(DATABASE_URL);
    const db = drizzle(sql);
    
    console.log('Testing database connection...');
    
    // Test 1: Get user by email
    const users = await db.select()
      .from(schema.users)
      .where(eq(schema.users.email, 'alex.creator@demo.com'))
      .limit(1);
    
    if (users.length > 0) {
      console.log('✅ User found:', {
        id: users[0].id,
        email: users[0].email,
        username: users[0].username,
        userType: users[0].userType,
        hasPassword: !!users[0].passwordHash
      });
    } else {
      console.log('❌ User not found');
    }
    
    // Test 2: List all users
    const allUsers = await db.select({
      email: schema.users.email,
      userType: schema.users.userType
    })
    .from(schema.users)
    .limit(5);
    
    console.log('\nFirst 5 users in database:');
    allUsers.forEach(u => console.log(`  - ${u.email} (${u.userType})`));
    
  } catch (error) {
    console.error('Database error:', error);
  }
}

testDatabase();
