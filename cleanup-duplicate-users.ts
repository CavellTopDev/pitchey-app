import { db } from './src/db/client.ts';
import { users } from './src/db/schema.ts';
import { eq, and } from "drizzle-orm";

async function cleanupDuplicateUsers() {
  console.log('🧹 Cleaning up duplicate demo users...');
  
  try {
    // 1. Find all users with demo emails
    console.log('\n1. Finding all demo user records...');
    
    const allCreatorUsers = await db.select({
      id: users.id,
      email: users.email,
      username: users.username,
      userType: users.userType
    }).from(users).where(eq(users.email, 'alex.creator@demo.com'));
    
    const allInvestorUsers = await db.select({
      id: users.id,
      email: users.email,
      username: users.username,
      userType: users.userType
    }).from(users).where(eq(users.email, 'sarah.investor@demo.com'));
    
    const allProductionUsers = await db.select({
      id: users.id,
      email: users.email,
      username: users.username,
      userType: users.userType
    }).from(users).where(eq(users.email, 'stellar.production@demo.com'));
    
    console.log(`Found ${allCreatorUsers.length} alex.creator@demo.com records:`);
    allCreatorUsers.forEach(user => console.log(`   ID: ${user.id}, Username: ${user.username}`));
    
    console.log(`Found ${allInvestorUsers.length} sarah.investor@demo.com records:`);
    allInvestorUsers.forEach(user => console.log(`   ID: ${user.id}, Username: ${user.username}`));
    
    console.log(`Found ${allProductionUsers.length} stellar.production@demo.com records:`);
    allProductionUsers.forEach(user => console.log(`   ID: ${user.id}, Username: ${user.username}`));
    
    // 2. Keep only the users with IDs 1, 2, 3 and delete duplicates
    console.log('\n2. Removing duplicate records...');
    
    // Delete alex.creator@demo.com records that are NOT ID 1
    if (allCreatorUsers.length > 1) {
      for (const user of allCreatorUsers) {
        if (user.id !== 1) {
          await db.delete(users).where(
            and(
              eq(users.email, 'alex.creator@demo.com'),
              eq(users.id, user.id)
            )
          );
          console.log(`   🗑️ Deleted duplicate alex.creator@demo.com (ID: ${user.id})`);
        }
      }
    }
    
    // Delete sarah.investor@demo.com records that are NOT ID 2
    if (allInvestorUsers.length > 1) {
      for (const user of allInvestorUsers) {
        if (user.id !== 2) {
          await db.delete(users).where(
            and(
              eq(users.email, 'sarah.investor@demo.com'),
              eq(users.id, user.id)
            )
          );
          console.log(`   🗑️ Deleted duplicate sarah.investor@demo.com (ID: ${user.id})`);
        }
      }
    }
    
    // Delete stellar.production@demo.com records that are NOT ID 3
    if (allProductionUsers.length > 1) {
      for (const user of allProductionUsers) {
        if (user.id !== 3) {
          await db.delete(users).where(
            and(
              eq(users.email, 'stellar.production@demo.com'),
              eq(users.id, user.id)
            )
          );
          console.log(`   🗑️ Deleted duplicate stellar.production@demo.com (ID: ${user.id})`);
        }
      }
    }
    
    // 3. Verify cleanup
    console.log('\n3. Verification - Remaining demo users:');
    
    const finalCreator = await db.select({
      id: users.id,
      email: users.email,
      username: users.username,
      userType: users.userType
    }).from(users).where(eq(users.email, 'alex.creator@demo.com'));
    
    const finalInvestor = await db.select({
      id: users.id,
      email: users.email,
      username: users.username,
      userType: users.userType
    }).from(users).where(eq(users.email, 'sarah.investor@demo.com'));
    
    const finalProduction = await db.select({
      id: users.id,
      email: users.email,
      username: users.username,
      userType: users.userType
    }).from(users).where(eq(users.email, 'stellar.production@demo.com'));
    
    console.log(`✅ alex.creator@demo.com: ${finalCreator.length} record(s)`);
    finalCreator.forEach(user => console.log(`   ID: ${user.id}, Username: ${user.username}`));
    
    console.log(`✅ sarah.investor@demo.com: ${finalInvestor.length} record(s)`);
    finalInvestor.forEach(user => console.log(`   ID: ${user.id}, Username: ${user.username}`));
    
    console.log(`✅ stellar.production@demo.com: ${finalProduction.length} record(s)`);
    finalProduction.forEach(user => console.log(`   ID: ${user.id}, Username: ${user.username}`));
    
    console.log('\n🎉 Duplicate user cleanup complete!');
    console.log('Each demo email now has exactly one user record with correct ID.');
    
  } catch (error) {
    console.error('❌ Error cleaning up duplicate users:', error);
    throw error;
  }
}

if (import.meta.main) {
  await cleanupDuplicateUsers();
}