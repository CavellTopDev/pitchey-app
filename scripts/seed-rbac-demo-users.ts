#!/usr/bin/env -S deno run --allow-all

import { neon } from "npm:@neondatabase/serverless";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const DATABASE_URL = Deno.env.get("DATABASE_URL") || 
  "postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-a9pr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

const sql = neon(DATABASE_URL);

interface DemoUser {
  email: string;
  password: string;
  name: string;
  userType: 'creator' | 'investor' | 'production' | 'admin';
}

const DEMO_USERS: DemoUser[] = [
  {
    email: 'alex.creator@demo.com',
    password: 'Demo123',
    name: 'Alex Creator',
    userType: 'creator'
  },
  {
    email: 'sarah.investor@demo.com',
    password: 'Demo123',
    name: 'Sarah Investor',
    userType: 'investor'
  },
  {
    email: 'stellar.production@demo.com',
    password: 'Demo123',
    name: 'Stellar Productions',
    userType: 'production'
  },
  {
    email: 'admin@pitchey.com',
    password: 'Admin123!',
    name: 'Platform Admin',
    userType: 'admin'
  }
];

async function seedRBACDemoUsers() {
  console.log('🚀 Starting RBAC Demo User Seeding...\n');
  
  try {
    // Check if roles exist
    const rolesCheck = await sql`SELECT COUNT(*) as count FROM roles`;
    if (rolesCheck[0].count === 0) {
      console.error('❌ No roles found! Please run RBAC migrations first.');
      return;
    }
    
    // Create or update demo users
    for (const user of DEMO_USERS) {
      console.log(`\n📝 Processing user: ${user.email}`);
      
      // Hash password
      const passwordHash = await bcrypt.hash(user.password);
      
      // Create/update user
      const [createdUser] = await sql`
        INSERT INTO users (email, password_hash, user_type, name, created_at, updated_at)
        VALUES (${user.email}, ${passwordHash}, ${user.userType}, ${user.name}, NOW(), NOW())
        ON CONFLICT (email) 
        DO UPDATE SET 
          password_hash = ${passwordHash},
          user_type = ${user.userType},
          name = ${user.name},
          updated_at = NOW()
        RETURNING id, email, user_type
      `;
      
      console.log(`  ✅ User ${createdUser.email} (ID: ${createdUser.id}) ready`);
      
      // Assign appropriate role
      const roleName = user.userType === 'admin' ? 'admin' : user.userType;
      const [role] = await sql`SELECT id FROM roles WHERE name = ${roleName}`;
      
      if (role) {
        await sql`
          INSERT INTO user_roles (user_id, role_id, granted_at)
          VALUES (${createdUser.id}, ${role.id}, NOW())
          ON CONFLICT (user_id, role_id) DO NOTHING
        `;
        console.log(`  ✅ Assigned role: ${roleName}`);
      }
      
      // For creator, also create sample pitches
      if (user.userType === 'creator') {
        console.log(`  📄 Creating sample pitches for creator...`);
        
        const genres = ['Action', 'Comedy', 'Drama', 'Thriller', 'Sci-Fi'];
        for (let i = 0; i < 5; i++) {
          const [pitch] = await sql`
            INSERT INTO pitches (
              user_id, title, genre, logline, synopsis, 
              status, created_at, updated_at
            )
            VALUES (
              ${createdUser.id},
              ${'Epic ' + genres[i] + ' Adventure ' + (i + 1)},
              ${genres[i]},
              ${'A compelling story about ' + genres[i].toLowerCase() + ' and adventure'},
              ${'In a world where ' + genres[i].toLowerCase() + ' meets innovation, our hero must overcome incredible odds to save the day. This is a story of courage, determination, and the power of cinema.'},
              'published',
              NOW() - INTERVAL '${i} days',
              NOW()
            )
            ON CONFLICT DO NOTHING
            RETURNING id, title
          `;
          
          if (pitch) {
            // Grant ownership access
            await sql`
              INSERT INTO content_access (
                user_id, content_type, content_id, 
                access_level, granted_via, granted_at
              )
              VALUES (
                ${createdUser.id}, 'pitch', ${pitch.id},
                'admin', 'ownership', NOW()
              )
              ON CONFLICT (user_id, content_type, content_id) DO NOTHING
            `;
            console.log(`    ✅ Created pitch: ${pitch.title}`);
          }
        }
      }
    }
    
    // Create sample NDA requests between investor and creator
    console.log('\n📋 Creating sample NDA requests...');
    
    const investor = await sql`SELECT id FROM users WHERE email = 'sarah.investor@demo.com'`;
    const creatorPitches = await sql`
      SELECT p.id, p.title 
      FROM pitches p
      JOIN users u ON p.user_id = u.id
      WHERE u.email = 'alex.creator@demo.com'
      ORDER BY p.created_at DESC
      LIMIT 2
    `;
    
    if (investor[0] && creatorPitches.length > 0) {
      for (const pitch of creatorPitches) {
        await sql`
          INSERT INTO ndas (pitch_id, user_id, status, created_at)
          VALUES (${pitch.id}, ${investor[0].id}, 'pending', NOW())
          ON CONFLICT DO NOTHING
        `;
        console.log(`  ✅ NDA request created for: ${pitch.title}`);
      }
    }
    
    // Display summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 RBAC SEEDING SUMMARY');
    console.log('='.repeat(60));
    
    const userSummary = await sql`
      SELECT u.email, u.user_type, r.name as role_name
      FROM users u
      JOIN user_roles ur ON u.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE u.email = ANY(${DEMO_USERS.map(u => u.email)})
      ORDER BY u.email
    `;
    
    console.log('\n👥 Demo Users with Roles:');
    for (const user of userSummary) {
      console.log(`  • ${user.email} => ${user.role_name} role`);
    }
    
    const stats = await sql`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE email = ANY(${DEMO_USERS.map(u => u.email)})) as users_count,
        (SELECT COUNT(*) FROM user_roles WHERE user_id IN (
          SELECT id FROM users WHERE email = ANY(${DEMO_USERS.map(u => u.email)})
        )) as role_assignments,
        (SELECT COUNT(*) FROM content_access) as access_records,
        (SELECT COUNT(*) FROM pitches WHERE user_id = (
          SELECT id FROM users WHERE email = 'alex.creator@demo.com'
        )) as creator_pitches,
        (SELECT COUNT(*) FROM ndas) as nda_requests
    `;
    
    console.log('\n📈 Statistics:');
    console.log(`  • Demo Users: ${stats[0].users_count}`);
    console.log(`  • Role Assignments: ${stats[0].role_assignments}`);
    console.log(`  • Access Records: ${stats[0].access_records}`);
    console.log(`  • Creator Pitches: ${stats[0].creator_pitches}`);
    console.log(`  • NDA Requests: ${stats[0].nda_requests}`);
    
    console.log('\n✅ RBAC demo users seeded successfully!');
    console.log('\n🔑 Login Credentials:');
    for (const user of DEMO_USERS) {
      console.log(`  • ${user.email} / ${user.password}`);
    }
    
  } catch (error) {
    console.error('❌ Error seeding RBAC demo users:', error);
    throw error;
  }
}

// Run the seeding
if (import.meta.main) {
  await seedRBACDemoUsers();
  Deno.exit(0);
}