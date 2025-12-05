import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './src/db/schema.ts';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';

const DATABASE_URL = "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

async function checkPassword() {
  try {
    const sql = neon(DATABASE_URL);
    const db = drizzle(sql);
    
    const users = await db.select()
      .from(schema.users)
      .where(eq(schema.users.email, 'alex.creator@demo.com'))
      .limit(1);
    
    if (users.length > 0) {
      const user = users[0];
      console.log('User found:', user.email);
      console.log('Password hash:', user.passwordHash);
      
      // Test password verification
      const testPassword = "Demo123";
      const valid = await bcrypt.compare(testPassword, user.passwordHash);
      console.log('Password "Demo123" is valid:', valid);
      
      // Try with wrong password
      const invalid = await bcrypt.compare("wrong", user.passwordHash);
      console.log('Password "wrong" is valid:', invalid);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkPassword();
