// Simple Production Database Seed Script
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'npm:drizzle-orm@0.35.3';

const DATABASE_URL = Deno.env.get('DATABASE_URL');

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  Deno.exit(1);
}

console.log('🌱 Seeding production database with demo data...');
console.log('📍 Database:', DATABASE_URL.includes('neon.tech') ? 'Neon Production' : 'Local');

const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function seedDatabase() {
  try {
    // Use pre-hashed password for Demo123
    // This was hashed with bcrypt rounds=10
    const demoPasswordHash = '$2a$10$XQ1WlXRSM.1Y6LmsKw.6H.RWnZjU17V8sdhFo2MXYrckc7Tq9xb9G';
    
    // Create demo users
    console.log('\n👥 Creating demo users...');
    
    // Creator account
    const [creator] = await db.execute(sql`
      INSERT INTO users (
        email, password, name, "userType", role, bio, 
        "companyName", location, verified, "emailVerified"
      ) VALUES (
        'alex.creator@demo.com',
        ${demoPasswordHash},
        'Alex Thompson',
        'creator',
        'creator',
        'Award-winning filmmaker with 10+ years experience in independent cinema',
        'Thompson Films',
        'Los Angeles, CA',
        true,
        true
      ) RETURNING id
    `);
    console.log('✅ Created creator: alex.creator@demo.com');

    // Investor account
    const [investor] = await db.execute(sql`
      INSERT INTO users (
        email, password, name, "userType", role, bio,
        "companyName", location, verified, "emailVerified"
      ) VALUES (
        'sarah.investor@demo.com',
        ${demoPasswordHash},
        'Sarah Chen',
        'investor',
        'investor',
        'Angel investor focused on entertainment and media ventures',
        'Chen Ventures',
        'San Francisco, CA',
        true,
        true
      ) RETURNING id
    `);
    console.log('✅ Created investor: sarah.investor@demo.com');

    // Production company account
    const [production] = await db.execute(sql`
      INSERT INTO users (
        email, password, name, "userType", role, bio,
        "companyName", location, verified, "emailVerified"
      ) VALUES (
        'stellar.production@demo.com',
        ${demoPasswordHash},
        'Michael Roberts',
        'production',
        'production',
        'Executive Producer at Stellar Studios',
        'Stellar Studios',
        'New York, NY',
        true,
        true
      ) RETURNING id
    `);
    console.log('✅ Created production: stellar.production@demo.com');

    // Create sample pitches
    console.log('\n🎬 Creating sample pitches...');
    
    const pitch1 = await db.execute(sql`
      INSERT INTO pitches (
        title, tagline, description, genre, "targetAudience",
        budget, "fundingGoal", "currentFunding", "userId", status,
        visibility, "viewCount", "likeCount", "ndaRequired",
        "creatorId", "creatorType", featured, trending
      ) VALUES (
        'The Last Sunset',
        'A story of redemption in the final days of Earth',
        'In a world where the sun is dying, a group of unlikely heroes must journey to the earth''s core to reignite humanity''s last hope. This epic sci-fi thriller combines stunning visuals with deep emotional storytelling.',
        'Sci-Fi Thriller',
        'Adults 18-45',
        2500000,
        2500000,
        750000,
        ${creator.id},
        'active',
        'public',
        1250,
        89,
        true,
        ${creator.id},
        'creator',
        true,
        true
      ) RETURNING id
    `);
    console.log('✅ Created pitch: The Last Sunset');

    const pitch2 = await db.execute(sql`
      INSERT INTO pitches (
        title, tagline, description, genre, "targetAudience",
        budget, "fundingGoal", "currentFunding", "userId", status,
        visibility, "viewCount", "likeCount", "ndaRequired",
        "creatorId", "creatorType", featured
      ) VALUES (
        'Coffee & Conversations',
        'Every cup tells a story',
        'A heartwarming romantic drama set in a small coffee shop where strangers become friends and friends become family. Follow five interconnected stories of love, loss, and second chances.',
        'Romantic Drama',
        'Adults 25-54',
        800000,
        800000,
        320000,
        ${creator.id},
        'active',
        'public',
        856,
        124,
        false,
        ${creator.id},
        'creator',
        true
      ) RETURNING id
    `);
    console.log('✅ Created pitch: Coffee & Conversations');

    const pitch3 = await db.execute(sql`
      INSERT INTO pitches (
        title, tagline, description, genre, "targetAudience",
        budget, "fundingGoal", "currentFunding", "userId", status,
        visibility, "viewCount", "likeCount", "ndaRequired",
        "creatorId", "creatorType", trending
      ) VALUES (
        'Digital Shadows',
        'In cyberspace, no one can hear you scream',
        'A cyberpunk horror film that explores the dark side of virtual reality. When a new VR game becomes too real, players start disappearing in the real world.',
        'Horror/Thriller',
        'Adults 18-35',
        1500000,
        1500000,
        450000,
        ${creator.id},
        'active',
        'public',
        2100,
        256,
        true,
        ${creator.id},
        'creator',
        true
      ) RETURNING id
    `);
    console.log('✅ Created pitch: Digital Shadows');

    // Create some sample investments
    console.log('\n💰 Creating sample investments...');
    
    await db.execute(sql`
      INSERT INTO investments (
        "pitchId", "investorId", amount, "investmentType", 
        status, "paymentStatus", notes
      ) VALUES (
        ${pitch1.id},
        ${investor.id},
        50000,
        'equity',
        'completed',
        'paid',
        'Excited about the sci-fi concept and visual potential'
      )
    `);
    console.log('✅ Created investment in The Last Sunset');

    await db.execute(sql`
      INSERT INTO investments (
        "pitchId", "investorId", amount, "investmentType",
        status, "paymentStatus", notes
      ) VALUES (
        ${pitch2.id},
        ${investor.id},
        25000,
        'equity',
        'completed',
        'paid',
        'Love the character-driven narrative'
      )
    `);
    console.log('✅ Created investment in Coffee & Conversations');

    console.log('\n✨ Production database seeded successfully!');
    console.log('\n📋 Demo Accounts:');
    console.log('  Creator: alex.creator@demo.com / Demo123');
    console.log('  Investor: sarah.investor@demo.com / Demo123');
    console.log('  Production: stellar.production@demo.com / Demo123');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the seeding
await seedDatabase();