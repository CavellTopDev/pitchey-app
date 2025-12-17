/**
 * Test Raw SQL Authentication
 * Quick test to verify our authentication works
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = "postgresql://neondb_owner:npg_YibeIGRuv40J@ep-long-dew-ab2wcez1-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

async function testAuth() {
  const sql = neon(DATABASE_URL);
  
  console.log("🔍 Testing Raw SQL Authentication...\n");
  
  // 1. Test database connection
  console.log("1️⃣ Testing database connection...");
  try {
    const result = await sql`SELECT NOW() as current_time`;
    console.log("✅ Database connected:", result[0].current_time);
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    return;
  }
  
  // 2. Check users table
  console.log("\n2️⃣ Checking users table...");
  try {
    const users = await sql`
      SELECT id, email, name, user_type, created_at 
      FROM users 
      WHERE email LIKE '%@demo.com'
      LIMIT 5
    `;
    console.log(`✅ Found ${users.length} demo users:`);
    users.forEach(u => {
      console.log(`   - ${u.email} (${u.user_type})`);
    });
  } catch (error) {
    console.error("❌ Failed to query users:", error);
  }
  
  // 3. Check session table
  console.log("\n3️⃣ Checking session table...");
  try {
    const sessions = await sql`
      SELECT COUNT(*) as total, 
             COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active
      FROM session
    `;
    console.log(`✅ Sessions: ${sessions[0].total} total, ${sessions[0].active} active`);
  } catch (error) {
    console.error("❌ Failed to query sessions:", error);
  }
  
  // 4. Test session creation (without authentication logic)
  console.log("\n4️⃣ Testing session creation...");
  try {
    // Find a demo user
    const [demoUser] = await sql`
      SELECT id, email FROM users 
      WHERE email = 'alex.creator@demo.com' 
      LIMIT 1
    `;
    
    if (demoUser) {
      // Create a test session
      const sessionId = crypto.randomUUID();
      const token = Array.from(crypto.getRandomValues(new Uint8Array(16)), 
        b => b.toString(16).padStart(2, '0')).join('');
      const expiresAt = new Date(Date.now() + 60 * 1000); // 1 minute for test
      
      await sql`
        INSERT INTO session (id, user_id, token, expires_at, created_at, updated_at)
        VALUES (${sessionId}, ${demoUser.id}, ${token}, ${expiresAt}, NOW(), NOW())
      `;
      
      console.log(`✅ Created test session for ${demoUser.email}`);
      
      // Clean up
      await sql`DELETE FROM session WHERE id = ${sessionId}`;
      console.log("✅ Cleaned up test session");
    }
  } catch (error) {
    console.error("❌ Session test failed:", error);
  }
  
  // 5. Check password hashes
  console.log("\n5️⃣ Checking password hashes...");
  try {
    const usersWithPasswords = await sql`
      SELECT email, 
             CASE 
               WHEN password_hash IS NOT NULL AND password_hash != '' THEN 'has password'
               ELSE 'no password'
             END as password_status
      FROM users 
      WHERE email LIKE '%@demo.com'
    `;
    
    usersWithPasswords.forEach(u => {
      console.log(`   - ${u.email}: ${u.password_status}`);
    });
  } catch (error) {
    console.error("❌ Failed to check passwords:", error);
  }
  
  console.log("\n✨ Raw SQL test complete!");
}

testAuth().catch(console.error);