import { createClient } from './src/db/client.ts';

async function fixUserIds() {
  console.log('🔧 Fixing demo user IDs to match pitch ownership...');
  
  const db = createClient();
  
  try {
    // Check current state
    console.log('\n1. Checking current users and pitches...');
    
    const users = await db.query(`
      SELECT id, email, username, "userType" 
      FROM users 
      WHERE email IN ('alex.creator@demo.com', 'sarah.investor@demo.com', 'stellar.production@demo.com')
      ORDER BY id
    `);
    
    console.log('Current demo users:');
    users.rows.forEach(user => {
      console.log(`   ID: ${user[0]}, Email: ${user[1]}, Type: ${user[3]}`);
    });
    
    const pitches = await db.query(`
      SELECT id, title, "userId" 
      FROM pitches 
      ORDER BY id
    `);
    
    console.log('\nCurrent pitches:');
    pitches.rows.forEach(pitch => {
      console.log(`   Pitch ID: ${pitch[0]}, Title: "${pitch[1]}", User ID: ${pitch[2]}`);
    });
    
    // Fix the user IDs by updating them to match pitch ownership
    console.log('\n2. Updating user IDs to match pitch ownership...');
    
    // Update alex.creator@demo.com to ID 1
    await db.query(`
      UPDATE users 
      SET id = 1 
      WHERE email = 'alex.creator@demo.com'
    `);
    console.log('   ✅ alex.creator@demo.com → ID 1');
    
    // Update sarah.investor@demo.com to ID 2  
    await db.query(`
      UPDATE users 
      SET id = 2 
      WHERE email = 'sarah.investor@demo.com'
    `);
    console.log('   ✅ sarah.investor@demo.com → ID 2');
    
    // Update stellar.production@demo.com to ID 3
    await db.query(`
      UPDATE users 
      SET id = 3 
      WHERE email = 'stellar.production@demo.com'
    `);
    console.log('   ✅ stellar.production@demo.com → ID 3');
    
    // Verify the changes
    console.log('\n3. Verification - Updated users:');
    const updatedUsers = await db.query(`
      SELECT id, email, username, "userType" 
      FROM users 
      WHERE email IN ('alex.creator@demo.com', 'sarah.investor@demo.com', 'stellar.production@demo.com')
      ORDER BY id
    `);
    
    updatedUsers.rows.forEach(user => {
      console.log(`   ID: ${user[0]}, Email: ${user[1]}, Type: ${user[3]}`);
    });
    
    console.log('\n✅ Demo user ID mismatch fixed!');
    console.log('Now demo accounts can access their pitches:');
    console.log('- alex.creator@demo.com (ID 1) - owns pitches 1 & 2');
    console.log('- sarah.investor@demo.com (ID 2) - owns pitch 3'); 
    console.log('- stellar.production@demo.com (ID 3) - owns pitch 4');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await db.end();
  }
}

if (import.meta.main) {
  await fixUserIds();
}