import { db } from './src/db/client.ts';
import { users, pitches } from './src/db/schema.ts';
import { eq } from "drizzle-orm";

async function fixDemoUsersWithDrizzle() {
  console.log('🔧 Fixing demo user IDs using Drizzle ORM...');
  
  try {
    // 1. Check current state
    console.log('\n1. Current demo users in database:');
    const currentUsers = await db.select({
      id: users.id,
      email: users.email,
      username: users.username,
      userType: users.userType
    }).from(users).where(
      eq(users.email, 'alex.creator@demo.com')
    ).limit(1);
    
    if (currentUsers.length > 0) {
      console.log(`   alex.creator@demo.com: ID ${currentUsers[0].id}, Type: ${currentUsers[0].userType}`);
    }
    
    const investorUsers = await db.select({
      id: users.id,
      email: users.email,
      userType: users.userType
    }).from(users).where(
      eq(users.email, 'sarah.investor@demo.com')
    ).limit(1);
    
    if (investorUsers.length > 0) {
      console.log(`   sarah.investor@demo.com: ID ${investorUsers[0].id}, Type: ${investorUsers[0].userType}`);
    }
    
    const productionUsers = await db.select({
      id: users.id,
      email: users.email,
      userType: users.userType
    }).from(users).where(
      eq(users.email, 'stellar.production@demo.com')
    ).limit(1);
    
    if (productionUsers.length > 0) {
      console.log(`   stellar.production@demo.com: ID ${productionUsers[0].id}, Type: ${productionUsers[0].userType}`);
    }
    
    // 2. Check current pitches
    console.log('\n2. Current pitches and their user IDs:');
    const currentPitches = await db.select({
      id: pitches.id,
      title: pitches.title,
      userId: pitches.userId
    }).from(pitches).limit(10);
    
    currentPitches.forEach(pitch => {
      console.log(`   Pitch ID: ${pitch.id}, Title: "${pitch.title}", User ID: ${pitch.userId}`);
    });
    
    // 3. Update user IDs to match pitch ownership
    console.log('\n3. Updating demo user IDs to match pitch ownership...');
    
    // Update alex.creator@demo.com to ID 1 (matches pitches 1 & 2)
    await db.update(users)
      .set({ id: 1 })
      .where(eq(users.email, 'alex.creator@demo.com'));
    console.log('   ✅ alex.creator@demo.com → ID 1');
    
    // Update sarah.investor@demo.com to ID 2 (matches pitch 3)
    await db.update(users)
      .set({ id: 2 })
      .where(eq(users.email, 'sarah.investor@demo.com'));
    console.log('   ✅ sarah.investor@demo.com → ID 2');
    
    // Update stellar.production@demo.com to ID 3 (matches pitch 4)
    await db.update(users)
      .set({ id: 3 })
      .where(eq(users.email, 'stellar.production@demo.com'));
    console.log('   ✅ stellar.production@demo.com → ID 3');
    
    // 4. Verify the changes
    console.log('\n4. Verification - Demo users after update:');
    
    const verifyCreator = await db.select({
      id: users.id,
      email: users.email,
      userType: users.userType
    }).from(users).where(eq(users.email, 'alex.creator@demo.com')).limit(1);
    
    const verifyInvestor = await db.select({
      id: users.id,
      email: users.email,
      userType: users.userType
    }).from(users).where(eq(users.email, 'sarah.investor@demo.com')).limit(1);
    
    const verifyProduction = await db.select({
      id: users.id,
      email: users.email,
      userType: users.userType
    }).from(users).where(eq(users.email, 'stellar.production@demo.com')).limit(1);
    
    if (verifyCreator.length > 0) {
      console.log(`   ✅ alex.creator@demo.com: ID ${verifyCreator[0].id}`);
    }
    if (verifyInvestor.length > 0) {
      console.log(`   ✅ sarah.investor@demo.com: ID ${verifyInvestor[0].id}`);
    }
    if (verifyProduction.length > 0) {
      console.log(`   ✅ stellar.production@demo.com: ID ${verifyProduction[0].id}`);
    }
    
    console.log('\n🎉 Demo user ID mismatch fixed successfully!');
    console.log('Demo accounts can now access their pitches:');
    console.log('- alex.creator@demo.com (ID 1) - owns pitches with userId=1');
    console.log('- sarah.investor@demo.com (ID 2) - owns pitches with userId=2'); 
    console.log('- stellar.production@demo.com (ID 3) - owns pitches with userId=3');
    
  } catch (error) {
    console.error('❌ Error fixing demo user IDs:', error);
    if (error.message) {
      console.error('Error message:', error.message);
    }
    throw error;
  }
}

if (import.meta.main) {
  await fixDemoUsersWithDrizzle();
}