#!/usr/bin/env -S deno run --allow-all

/**
 * Add demo pitches to the database
 */

import { Client } from 'https://deno.land/x/postgres@v0.17.0/mod.ts';

const DATABASE_URL = Deno.env.get('DATABASE_URL') || 
  'postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';

// Parse connection string
function parseConnectionString(url: string) {
  const regex = /^postgresql:\/\/([^:]+):([^@]+)@([^\/]+)\/([^?]+)(?:\?(.+))?$/;
  const match = url.match(regex);
  
  if (!match) throw new Error('Invalid connection string');
  
  const [_, user, password, hostAndPort, database, params] = match;
  const [hostname, port = '5432'] = hostAndPort.split(':');
  
  return {
    user,
    password,
    hostname,
    port: parseInt(port),
    database,
    tls: params?.includes('sslmode=require') ? { enabled: true, enforce: true } : undefined
  };
}

const dbConfig = parseConnectionString(DATABASE_URL);
const client = new Client(dbConfig);

async function main() {
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Get creator IDs
    const creators = await client.queryArray`
      SELECT id, email FROM users 
      WHERE user_type = 'creator' AND is_demo_account = true
      ORDER BY id
    `;
    
    if (creators.rows.length === 0) {
      console.log('No demo creators found. Please run populate-production-data.ts first');
      return;
    }
    
    const alexId = creators.rows[0][0]; // Alex Rodriguez
    const mayaId = creators.rows[1]?.[0] || alexId; // Maya Chen or fallback to Alex
    const jamesId = creators.rows[2]?.[0] || alexId; // James O'Brien or fallback
    
    console.log(`Using creator IDs: Alex=${alexId}, Maya=${mayaId}, James=${jamesId}`);
    
    // Create demo pitches
    const pitches = [
      {
        user_id: alexId,
        title: 'The Last Horizon',
        logline: 'When Earth\'s final colony ship malfunctions, a lone engineer must choose between saving her family or humanity\'s last hope.',
        genre: 'Sci-Fi Thriller',
        format: 'feature',
        budget: '15-25 million',
        short_synopsis: 'A thrilling space drama about impossible choices and the survival of humanity.',
        long_synopsis: 'Set in 2157, "The Last Horizon" follows Maya Chen, chief engineer aboard humanity\'s final colony ship carrying 10,000 sleeping passengers to a new world. When a cascade failure threatens to destroy the ship, Maya discovers she can only save one section - either the one containing her family or the one with humanity\'s genetic diversity bank and cultural archives. As oxygen runs low and systems fail, Maya must navigate damaged corridors, face off against the ship\'s malfunctioning AI, and make the ultimate sacrifice.',
        status: 'published',
        view_count: 1523,
        like_count: 234,
        nda_count: 45,
        require_nda: false,
        published_at: new Date()
      },
      {
        user_id: alexId,
        title: 'Echoes of Tomorrow',
        logline: 'A detective who can see 24 hours into the future must prevent his own murder while solving the crime that hasn\'t happened yet.',
        genre: 'Thriller/Mystery',
        format: 'series',
        budget: '3-5 million per episode',
        short_synopsis: 'A mind-bending thriller series about fate, free will, and the price of knowing the future.',
        long_synopsis: 'Detective Marcus Webb wakes up with the ability to see exactly 24 hours into the future. When he witnesses his own death, he has one day to unravel a conspiracy that hasn\'t unfolded yet, change a predetermined future, and discover the source of his mysterious gift. Each episode explores a new case where Marcus must prevent crimes before they happen while dealing with the philosophical and personal consequences of his ability.',
        status: 'published',
        view_count: 892,
        like_count: 156,
        nda_count: 78,
        require_nda: true,
        published_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
      },
      {
        user_id: mayaId,
        title: 'Quantum Hearts',
        logline: 'In a world where love is scientifically matched, a glitch pairs two incompatible people who might be perfect for each other.',
        genre: 'Romantic Sci-Fi',
        format: 'feature',
        budget: '8-12 million',
        short_synopsis: 'A romantic sci-fi that questions whether love can be quantified.',
        long_synopsis: 'In 2045, the Harmony AI system has eliminated failed relationships by using quantum computing to perfectly match soulmates. When a system glitch pairs efficiency-obsessed data analyst Emma Park with free-spirited artist Jake Morrison - two people with 0% compatibility - they must pretend to be in love or face social exile. As they fake their relationship, they discover that the imperfections and unpredictability of human connection might be what makes love real.',
        status: 'published',
        view_count: 2341,
        like_count: 567,
        nda_count: 23,
        require_nda: false,
        published_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) // 14 days ago
      },
      {
        user_id: mayaId,
        title: 'The Memory Thief',
        logline: 'A street thief discovers she can steal memories and must use this power to solve her own murder... which hasn\'t happened yet.',
        genre: 'Psychological Thriller',
        format: 'feature',
        budget: '5-8 million',
        short_synopsis: 'A dark thriller about identity, memory, and the stories we tell ourselves.',
        long_synopsis: 'Zara, a small-time pickpocket in near-future London, discovers she can extract memories through touch. When she accidentally steals a memory of her own murder scheduled for next week, she must navigate the city\'s criminal underworld, stealing memories to piece together who wants her dead and why. As she dives deeper into other people\'s memories, the line between her identity and theirs begins to blur.',
        status: 'published',
        view_count: 1876,
        like_count: 432,
        nda_count: 91,
        require_nda: true,
        published_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000) // 21 days ago
      },
      {
        user_id: jamesId,
        title: 'The Carbon Coast',
        logline: 'A climate refugee and a tech billionaire\'s daughter team up to expose a conspiracy that could save or doom the planet.',
        genre: 'Environmental Thriller',
        format: 'series',
        budget: '4-6 million per episode',
        short_synopsis: 'An urgent thriller about climate change, corporate greed, and unlikely alliances.',
        long_synopsis: 'In 2035, rising seas have swallowed coastlines worldwide. When climate refugee Marcus Torres saves tech heiress Chloe Brennan from a kidnapping, they uncover evidence that her father\'s company has been deliberately accelerating climate change to profit from disaster capitalism. Forced to go on the run together, they must expose the truth while being hunted by corporate assassins and navigating a world transformed by environmental collapse.',
        status: 'published',
        view_count: 3210,
        like_count: 789,
        nda_count: 134,
        require_nda: false,
        published_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
      },
      {
        user_id: jamesId,
        title: 'Neon Souls',
        logline: 'In a city where memories are currency, a memory-broke detective must solve murders without forgetting who she is.',
        genre: 'Neo-Noir',
        format: 'feature',
        budget: '10-15 million',
        short_synopsis: 'A stylish neo-noir about the price of memory in a world where forgetting might be freedom.',
        long_synopsis: 'In Neo Tokyo 2050, memories are extracted and traded like cryptocurrency. Detective Yuki Tanaka, deeply in debt and forced to sell most of her memories, takes on a series of murders targeting memory traders. With only fragments of her past and a mysterious partner who might be a deleted memory made flesh, she navigates a neon-lit underworld where identity is fluid and anyone\'s past can be bought, sold, or stolen.',
        status: 'draft',
        view_count: 567,
        like_count: 123,
        nda_count: 45,
        require_nda: true,
        published_at: null
      }
    ];
    
    console.log('🎬 Creating demo pitches...');
    
    for (const pitch of pitches) {
      // Check if pitch already exists
      const existing = await client.queryArray`
        SELECT id FROM pitches 
        WHERE title = ${pitch.title} AND user_id = ${pitch.user_id}
      `;
      
      if (existing.rows.length === 0) {
        await client.queryArray`
          INSERT INTO pitches (
            user_id, title, logline, genre, format, budget,
            short_synopsis, long_synopsis, status, view_count, like_count,
            nda_count, require_nda, published_at, created_at, updated_at
          ) VALUES (
            ${pitch.user_id}, ${pitch.title}, ${pitch.logline}, ${pitch.genre}, ${pitch.format},
            ${pitch.budget}, ${pitch.short_synopsis}, ${pitch.long_synopsis}, ${pitch.status},
            ${pitch.view_count}, ${pitch.like_count}, ${pitch.nda_count}, ${pitch.require_nda},
            ${pitch.published_at}, NOW(), NOW()
          )
        `;
      } else {
        await client.queryArray`
          UPDATE pitches SET
            logline = ${pitch.logline},
            genre = ${pitch.genre},
            updated_at = NOW()
          WHERE title = ${pitch.title} AND user_id = ${pitch.user_id}
        `;
      }
      console.log(`  ✅ Created pitch: ${pitch.title}`);
    }
    
    console.log('\\n✨ Successfully created demo pitches!');
    
    // Display summary
    const summary = await client.queryArray`
      SELECT u.email, COUNT(p.id) as pitch_count
      FROM users u
      LEFT JOIN pitches p ON u.id = p.user_id
      WHERE u.is_demo_account = true AND u.user_type = 'creator'
      GROUP BY u.id, u.email
      ORDER BY u.email
    `;
    
    console.log('\\n📊 Pitch Summary:');
    for (const row of summary.rows) {
      console.log(`  ${row[0]}: ${row[1]} pitches`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
    console.log('👋 Database connection closed');
  }
}

// Run the script
if (import.meta.main) {
  main().catch(console.error);
}
