import { neon } from '@neondatabase/serverless';
import bcrypt from 'npm:bcryptjs@2.4.3';

const DATABASE_URL = "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

const sql = neon(DATABASE_URL);

async function checkAndSeedDemoUsers() {
  console.log('🔍 Checking for existing demo users...\n');

  // Check existing users
  const existingUsers = await sql`
    SELECT id, email, username, user_type 
    FROM users 
    WHERE email IN (
      'alex.creator@demo.com', 
      'sarah.investor@demo.com', 
      'stellar.production@demo.com'
    )
  `;

  console.log(`Found ${existingUsers.length} demo users:`);
  existingUsers.forEach(user => {
    console.log(`  - ${user.email} (${user.user_type})`);
  });

  // Check which demo users need to be created
  const demoEmails = ['alex.creator@demo.com', 'sarah.investor@demo.com', 'stellar.production@demo.com'];
  const existingEmails = existingUsers.map(u => u.email);
  const missingEmails = demoEmails.filter(email => !existingEmails.includes(email));

  if (missingEmails.length === 0) {
    console.log('\n✅ All demo users already exist!');
    return;
  }

  console.log(`\n📝 Need to create ${missingEmails.length} demo users:`);
  missingEmails.forEach(email => console.log(`  - ${email}`));

  // Hash the demo password
  const passwordHash = await bcrypt.hash('Demo123', 10);

  // Prepare demo users data
  const demoUsers = [
    {
      email: 'alex.creator@demo.com',
      username: 'alex_creator',
      user_type: 'creator',
      password_hash: passwordHash,
      is_verified: true,
      has_verified_email: true
    },
    {
      email: 'sarah.investor@demo.com',
      username: 'sarah_investor',
      user_type: 'investor',
      password_hash: passwordHash,
      is_verified: true,
      has_verified_email: true
    },
    {
      email: 'stellar.production@demo.com',
      username: 'stellar_production',
      user_type: 'production_company',
      password_hash: passwordHash,
      is_verified: true,
      has_verified_email: true
    }
  ];

  // Insert missing demo users
  for (const user of demoUsers) {
    if (missingEmails.includes(user.email)) {
      console.log(`\n🌱 Creating ${user.username}...`);
      
      try {
        const result = await sql`
          INSERT INTO users (
            email, username, user_type, 
            password_hash, is_verified, has_verified_email,
            created_at, updated_at
          ) VALUES (
            ${user.email}, ${user.username}, ${user.user_type},
            ${user.password_hash}, ${user.is_verified}, ${user.has_verified_email},
            NOW(), NOW()
          )
          RETURNING id, email, username, user_type
        `;
        
        console.log(`  ✅ Created: ${result[0].email} (ID: ${result[0].id})`);
      } catch (error) {
        // Check if it's a duplicate error
        if (error.message?.includes('duplicate')) {
          console.log(`  ⚠️  ${user.email} already exists (might have been created elsewhere)`);
        } else {
          console.error(`  ❌ Error creating ${user.email}:`, error.message);
        }
      }
    }
  }

  console.log('\n📊 Final check - all users in database:');
  const allUsers = await sql`
    SELECT id, email, username, user_type 
    FROM users 
    ORDER BY created_at DESC
    LIMIT 10
  `;

  allUsers.forEach(user => {
    const isDemoUser = demoEmails.includes(user.email);
    console.log(`  ${isDemoUser ? '🎯' : '  '} ${user.email} (${user.user_type})`);
  });

  console.log('\n✨ Demo user setup complete!');
  console.log('\n🔑 Login credentials:');
  console.log('  Email: alex.creator@demo.com | Password: Demo123');
  console.log('  Email: sarah.investor@demo.com | Password: Demo123');
  console.log('  Email: stellar.production@demo.com | Password: Demo123');
}

// Run the script
checkAndSeedDemoUsers().catch(console.error);