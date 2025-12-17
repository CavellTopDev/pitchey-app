import { drizzle } from "drizzle-orm";
import postgres from "npm:postgres@^3.4.0";
import { users, pitches } from './src/db/schema.ts';
import { eq } from "drizzle-orm";

const DATABASE_URL = Deno.env.get('DATABASE_URL');
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = postgres(DATABASE_URL);
const db = drizzle(sql);

async function fixDemoUserIds() {
  console.log('🔧 Fixing demo user ID mismatches...');
  
  try {
    // Check current users
    console.log('\n1. Current users in database:');
    const currentUsers = await db.select().from(users);
    currentUsers.forEach(user => {
      console.log(`   ID: ${user.id}, Email: ${user.email}, Type: ${user.userType}`);
    });
    
    // Check current pitches and their user IDs
    console.log('\n2. Current pitches and their user IDs:');
    const currentPitches = await db.select().from(pitches);
    currentPitches.forEach(pitch => {
      console.log(`   Pitch ID: ${pitch.id}, Title: "${pitch.title}", User ID: ${pitch.userId}`);
    });
    
    // Update demo users to have the correct IDs that match pitches
    console.log('\n3. Updating demo user IDs...');
    
    // Update alex.creator@demo.com to have ID 1 (matches pitch user IDs 1)
    await db.update(users)
      .set({ id: 1 })
      .where(eq(users.email, 'alex.creator@demo.com'));
    console.log('   ✅ Updated alex.creator@demo.com to ID 1');
    
    // Update sarah.investor@demo.com to have ID 2 (matches pitch user ID 2)
    await db.update(users)
      .set({ id: 2 })
      .where(eq(users.email, 'sarah.investor@demo.com'));
    console.log('   ✅ Updated sarah.investor@demo.com to ID 2');
    
    // Update stellar.production@demo.com to have ID 3 (matches pitch user ID 3)
    await db.update(users)
      .set({ id: 3 })
      .where(eq(users.email, 'stellar.production@demo.com'));
    console.log('   ✅ Updated stellar.production@demo.com to ID 3');
    
    console.log('\n4. Verification - Updated users:');
    const updatedUsers = await db.select().from(users);
    updatedUsers.forEach(user => {
      console.log(`   ID: ${user.id}, Email: ${user.email}, Type: ${user.userType}`);
    });
    
    console.log('\n✅ Demo user ID mismatch fixed!');
    console.log('Demo accounts now match pitch creator IDs:');
    console.log('- alex.creator@demo.com (ID 1) - owns pitches 1 & 2');
    console.log('- sarah.investor@demo.com (ID 2) - owns pitch 3'); 
    console.log('- stellar.production@demo.com (ID 3) - owns pitch 4');
    
  } catch (error) {
    console.error('❌ Error fixing demo user IDs:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

if (import.meta.main) {
  await fixDemoUserIds();
}