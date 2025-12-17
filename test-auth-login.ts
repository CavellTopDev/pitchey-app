/**
 * Test authentication login with raw SQL
 */

import { RawSQLAuth } from './src/auth/raw-sql-auth.ts';

const DATABASE_URL = "postgresql://neondb_owner:npg_YibeIGRuv40J@ep-long-dew-ab2wcez1-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

async function testLogin() {
  const auth = new RawSQLAuth(DATABASE_URL);
  
  console.log("🔐 Testing Raw SQL Authentication Login...\n");
  
  // Test cases
  const testCases = [
    { email: 'alex.creator@demo.com', password: 'Demo123', portal: 'creator' as const },
    { email: 'sarah.investor@demo.com', password: 'Demo123', portal: 'investor' as const },
    { email: 'stellar.production@demo.com', password: 'Demo123', portal: 'production' as const }
  ];
  
  for (const test of testCases) {
    console.log(`\n📧 Testing login for ${test.email} (${test.portal})...`);
    
    try {
      // Test portal login
      const result = await auth.portalLogin(
        { email: test.email, password: test.password },
        test.portal
      );
      
      console.log(`✅ Login successful!`);
      console.log(`   User ID: ${result.user.id}`);
      console.log(`   Username: ${result.user.username}`);
      console.log(`   User Type: ${result.user.user_type}`);
      console.log(`   Session Token: ${result.session.token.substring(0, 10)}...`);
      console.log(`   Expires: ${result.session.expires_at}`);
      
      // Test session validation
      console.log(`\n🔍 Validating session...`);
      const validation = await auth.validateSession(result.session.token);
      
      if (validation) {
        console.log(`✅ Session valid!`);
        console.log(`   User confirmed: ${validation.user.email}`);
      } else {
        console.log(`❌ Session validation failed`);
      }
      
      // Clean up - sign out
      await auth.signOut(result.session.token);
      console.log(`✅ Signed out successfully`);
      
    } catch (error: any) {
      console.error(`❌ Login failed: ${error.message}`);
    }
  }
  
  // Test invalid login
  console.log(`\n\n❌ Testing invalid login...`);
  try {
    await auth.portalLogin(
      { email: 'alex.creator@demo.com', password: 'WrongPassword' },
      'creator'
    );
    console.log(`⚠️  Should not have succeeded!`);
  } catch (error: any) {
    console.log(`✅ Correctly rejected: ${error.message}`);
  }
  
  // Test wrong portal access
  console.log(`\n❌ Testing wrong portal access...`);
  try {
    await auth.portalLogin(
      { email: 'alex.creator@demo.com', password: 'Demo123' },
      'investor' // Wrong portal for creator
    );
    console.log(`⚠️  Should not have succeeded!`);
  } catch (error: any) {
    console.log(`✅ Correctly rejected: ${error.message}`);
  }
  
  console.log("\n\n✨ Authentication tests complete!");
}

testLogin().catch(console.error);