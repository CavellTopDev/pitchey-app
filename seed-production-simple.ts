// Simple Production Database Seed Script
import { drizzle } from "npm:drizzle-orm@0.35.3/neon-http";
import { neon } from "npm:@neondatabase/serverless@0.9.5";
import { sql } from 'npm:drizzle-orm@0.35.3';

const DATABASE_URL = Deno.env.get('DATABASE_URL');

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  Deno.exit(1);
}

console.log('🌱 Seeding production database with demo data...');
console.log('📍 Database:', DATABASE_URL.includes('neon.tech') ? 'Neon Production' : 'Local');

const client = neon(DATABASE_URL);
const db = drizzle(client);

async function seedDatabase() {
  try {
    // Use pre-hashed password for Demo123
    // This was hashed with bcrypt rounds=10
    const demoPasswordHash = '$2a$10$XQ1WlXRSM.1Y6LmsKw.6H.RWnZjU17V8sdhFo2MXYrckc7Tq9xb9G';
    
    // Create demo users
    console.log('\n👥 Creating demo users...');
    
    // Creator account
    const creatorResult = await db.execute(sql`
      INSERT INTO users (
        email, password, password_hash, username, user_type, first_name, last_name, bio, 
        company_name, location, email_verified
      ) VALUES (
        'alex.creator@demo.com',
        ${demoPasswordHash},
        ${demoPasswordHash},
        'alexcreator',
        'creator',
        'Alex',
        'Thompson',
        'Award-winning filmmaker with 10+ years experience in independent cinema',
        'Thompson Films',
        'Los Angeles, CA',
        true
      ) RETURNING id
    `);
    const creator = creatorResult.rows[0];
    console.log('✅ Created creator: alex.creator@demo.com');

    // Investor account
    const investorResult = await db.execute(sql`
      INSERT INTO users (
        email, password, password_hash, username, user_type, first_name, last_name, bio,
        company_name, location, email_verified
      ) VALUES (
        'sarah.investor@demo.com',
        ${demoPasswordHash},
        ${demoPasswordHash},
        'sarahinvestor',
        'investor',
        'Sarah',
        'Chen',
        'Angel investor focused on entertainment and media ventures',
        'Chen Ventures',
        'San Francisco, CA',
        true
      ) RETURNING id
    `);
    const investor = investorResult.rows[0];
    console.log('✅ Created investor: sarah.investor@demo.com');

    // Production company account
    const productionResult = await db.execute(sql`
      INSERT INTO users (
        email, password, password_hash, username, user_type, first_name, last_name, bio,
        company_name, location, email_verified
      ) VALUES (
        'stellar.production@demo.com',
        ${demoPasswordHash},
        ${demoPasswordHash},
        'stellarproduction',
        'production',
        'Michael',
        'Roberts',
        'Executive Producer at Stellar Studios',
        'Stellar Studios',
        'New York, NY',
        true
      ) RETURNING id
    `);
    const production = productionResult.rows[0];
    console.log('✅ Created production: stellar.production@demo.com');

    // Create sample pitches
    console.log('\n🎬 Creating sample pitches...');
    
    const pitch1Result = await db.execute(sql`
      INSERT INTO pitches (
        title, logline, short_synopsis, genre, target_audience,
        budget_bracket, user_id, status,
        visibility, view_count, like_count, require_nda
      ) VALUES (
        'The Last Sunset',
        'A story of redemption in the final days of Earth',
        'In a world where the sun is dying, a group of unlikely heroes must journey to the earth''s core to reignite humanity''s last hope. This epic sci-fi thriller combines stunning visuals with deep emotional storytelling.',
        'scifi',
        'Adults 18-45',
        '$2M-$5M',
        ${creator.id},
        'active',
        'public',
        1250,
        89,
        true
      ) RETURNING id
    `);
    console.log('✅ Created pitch: The Last Sunset');

    const pitch2Result = await db.execute(sql`
      INSERT INTO pitches (
        title, logline, short_synopsis, genre, target_audience,
        budget_bracket, user_id, status,
        visibility, view_count, like_count, require_nda
      ) VALUES (
        'Coffee & Conversations',
        'Every cup tells a story',
        'A heartwarming romantic drama set in a small coffee shop where strangers become friends and friends become family. Follow five interconnected stories of love, loss, and second chances.',
        'drama',
        'Adults 25-54',
        '$500K-$1M',
        ${creator.id},
        'active',
        'public',
        856,
        124,
        false
      ) RETURNING id
    `);
    console.log('✅ Created pitch: Coffee & Conversations');

    const pitch3Result = await db.execute(sql`
      INSERT INTO pitches (
        title, logline, short_synopsis, genre, target_audience,
        budget_bracket, user_id, status,
        visibility, view_count, like_count, require_nda
      ) VALUES (
        'Digital Shadows',
        'In cyberspace, no one can hear you scream',
        'A cyberpunk horror film that explores the dark side of virtual reality. When a new VR game becomes too real, players start disappearing in the real world.',
        'horror',
        'Adults 18-35',
        '$1M-$3M',
        ${creator.id},
        'active',
        'public',
        2100,
        256,
        true
      ) RETURNING id
    `);
    console.log('✅ Created pitch: Digital Shadows');

    // Skip investments for now - table may not exist yet

    console.log('\n✨ Production database seeded successfully!');
    console.log('\n📋 Demo Accounts:');
    console.log('  Creator: alex.creator@demo.com / Demo123');
    console.log('  Investor: sarah.investor@demo.com / Demo123');
    console.log('  Production: stellar.production@demo.com / Demo123');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
  // Neon doesn't require explicit connection closing
}

// Run the seeding
await seedDatabase();