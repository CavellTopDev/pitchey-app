// Add pitches to production using existing demo users
import { drizzle } from "drizzle-orm";
import { neon } from "npm:@neondatabase/serverless@0.9.5";
import { sql } from 'npm:drizzle-orm@0.35.3';

const DATABASE_URL = Deno.env.get('DATABASE_URL');

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  Deno.exit(1);
}

console.log('🎬 Adding pitches to production database...');

const client = neon(DATABASE_URL);
const db = drizzle(client);

async function addPitches() {
  try {
    // Get the creator user ID
    const creatorResult = await db.execute(sql`
      SELECT id FROM users WHERE email = 'alex.creator@demo.com'
    `);
    
    if (!creatorResult.rows || creatorResult.rows.length === 0) {
      console.error('❌ Creator user not found! Please run seed-demo-users.ts first');
      Deno.exit(1);
    }
    
    const creatorId = creatorResult.rows[0].id;
    console.log(`✅ Found creator with ID: ${creatorId}`);
    
    // Create sample pitches
    console.log('\n🎬 Creating sample pitches...');
    
    await db.execute(sql`
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
        ${creatorId},
        'active',
        'public',
        1250,
        89,
        true
      )
    `);
    console.log('✅ Created pitch: The Last Sunset');

    await db.execute(sql`
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
        ${creatorId},
        'active',
        'public',
        856,
        124,
        false
      )
    `);
    console.log('✅ Created pitch: Coffee & Conversations');

    await db.execute(sql`
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
        ${creatorId},
        'active',
        'public',
        2100,
        256,
        true
      )
    `);
    console.log('✅ Created pitch: Digital Shadows');

    console.log('\n✨ Production pitches added successfully!');
    console.log('\n📋 Demo Account:');
    console.log('  Creator: alex.creator@demo.com / Demo123');
    console.log('\n🌐 Check: https://pitchey-5o8.pages.dev');
    
  } catch (error) {
    console.error('❌ Error adding pitches:', error);
    throw error;
  }
}

await addPitches();
