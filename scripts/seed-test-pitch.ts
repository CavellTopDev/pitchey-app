#!/usr/bin/env -S deno run --allow-all

/**
 * Script to seed a test pitch in the database for NDA testing
 * This creates pitch ID 204 that the frontend is trying to access
 */

import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js';

const DATABASE_URL = Deno.env.get('DATABASE_URL') || 
  'postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(DATABASE_URL, {
  ssl: 'require',
  idle_timeout: 20,
  max_lifetime: 60 * 2,
});

async function seedTestPitch() {
  console.log('🌱 Seeding test pitch for NDA workflow...');

  try {
    // First, check if we have a creator user
    const [creator] = await sql`
      SELECT id FROM users 
      WHERE email = 'alex.creator@demo.com' 
      LIMIT 1
    `;

    let creatorId = creator?.id;

    if (!creatorId) {
      // Create a test creator if none exists
      console.log('Creating test creator user...');
      const [newCreator] = await sql`
        INSERT INTO users (
          email, name, password_hash, role, 
          created_at, updated_at
        ) VALUES (
          'alex.creator@demo.com',
          'Alex Creator',
          '$2a$10$K7L1OJ0TfuCpwFnPqqIuNONmG3JAESMqH0FhLlaNBW8iZ7KaKCv9e',
          'creator',
          NOW(), NOW()
        )
        ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
        RETURNING id
      `;
      creatorId = newCreator.id;
    }

    console.log(`Using creator ID: ${creatorId}`);

    // Check if pitch 204 already exists
    const [existingPitch] = await sql`
      SELECT id FROM pitches WHERE id = 204
    `;

    if (existingPitch) {
      console.log('Pitch 204 already exists, updating it...');
      await sql`
        UPDATE pitches SET
          title = 'Epic Space Adventure',
          logline = 'A thrilling journey through the cosmos to save Earth from an alien invasion.',
          genre = 'Sci-Fi',
          format = 'Feature Film',
          status = 'active',
          user_id = ${creatorId},
          creator_id = ${creatorId},
          created_by = ${creatorId},
          updated_at = NOW()
        WHERE id = 204
      `;
    } else {
      console.log('Creating pitch 204...');
      
      // Try to insert with explicit ID
      try {
        await sql`
          INSERT INTO pitches (
            id, title, logline, genre, format, status,
            user_id, creator_id, created_by,
            synopsis, themes, setting,
            created_at, updated_at
          ) VALUES (
            204,
            'Epic Space Adventure',
            'A thrilling journey through the cosmos to save Earth from an alien invasion.',
            'Sci-Fi',
            'Feature Film',
            'active',
            ${creatorId}, ${creatorId}, ${creatorId},
            'In the year 2150, Earth receives a mysterious signal from deep space. A team of astronauts must embark on humanity''s first interstellar mission to investigate, only to discover an alien armada preparing to invade. With time running out, they must find a way to stop the invasion and save Earth.',
            'Courage, Unity, Sacrifice',
            'Space stations, alien worlds, and Earth''s future cities',
            NOW(), NOW()
          )
        `;
      } catch (e) {
        // If explicit ID fails, try without ID and update sequence
        console.log('Inserting without explicit ID...');
        const [newPitch] = await sql`
          INSERT INTO pitches (
            title, logline, genre, format, status,
            user_id, creator_id, created_by,
            synopsis, themes, setting,
            created_at, updated_at
          ) VALUES (
            'Epic Space Adventure',
            'A thrilling journey through the cosmos to save Earth from an alien invasion.',
            'Sci-Fi',
            'Feature Film',
            'active',
            ${creatorId}, ${creatorId}, ${creatorId},
            'In the year 2150, Earth receives a mysterious signal from deep space. A team of astronauts must embark on humanity''s first interstellar mission to investigate, only to discover an alien armada preparing to invade. With time running out, they must find a way to stop the invasion and save Earth.',
            'Courage, Unity, Sacrifice',
            'Space stations, alien worlds, and Earth''s future cities',
            NOW(), NOW()
          )
          RETURNING id
        `;
        console.log(`Created pitch with ID: ${newPitch.id}`);
      }
    }

    // Verify the pitch exists
    const [verifyPitch] = await sql`
      SELECT id, title, genre, user_id, creator_id 
      FROM pitches 
      WHERE title = 'Epic Space Adventure'
      LIMIT 1
    `;

    if (verifyPitch) {
      console.log('✅ Test pitch seeded successfully!');
      console.log(`   ID: ${verifyPitch.id}`);
      console.log(`   Title: ${verifyPitch.title}`);
      console.log(`   Genre: ${verifyPitch.genre}`);
      console.log(`   Creator ID: ${verifyPitch.creator_id || verifyPitch.user_id}`);
    } else {
      console.log('❌ Failed to create test pitch');
    }

    // Also create some additional test pitches for browsing
    const testPitches = [
      {
        title: 'Comedy Gold',
        logline: 'A hilarious misadventure of two friends trying to start a food truck business.',
        genre: 'Comedy',
        format: 'Feature Film'
      },
      {
        title: 'Mystery Manor',
        logline: 'A detective investigates strange disappearances at an old English manor.',
        genre: 'Mystery',
        format: 'Limited Series'
      },
      {
        title: 'Stellar Horizons',
        logline: 'A space exploration epic following humanity first interstellar colony mission',
        genre: 'Science Fiction (Sci-Fi)',
        format: 'Film'
      }
    ];

    for (const pitch of testPitches) {
      await sql`
        INSERT INTO pitches (
          title, logline, genre, format, status,
          user_id, creator_id, created_by,
          created_at, updated_at
        ) VALUES (
          ${pitch.title}, ${pitch.logline}, ${pitch.genre}, ${pitch.format},
          'active',
          ${creatorId}, ${creatorId}, ${creatorId},
          NOW(), NOW()
        )
        ON CONFLICT (title) DO UPDATE SET updated_at = NOW()
      `;
    }

    console.log('✅ Additional test pitches seeded');

  } catch (error) {
    console.error('Error seeding test pitch:', error);
  } finally {
    await sql.end();
  }
}

// Run the seed script
await seedTestPitch();