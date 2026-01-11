#!/usr/bin/env -S deno run --allow-all

/**
 * Production Database Population Script
 * Creates demo accounts and populates with realistic business workflow data
 */

import { Client } from 'https://deno.land/x/postgres@v0.17.0/mod.ts';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

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

async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password);
}

async function createTables() {
  console.log('📋 Creating/updating database tables...');
  
  // Create users table with Better Auth compatible structure
  await client.queryArray`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      email_verified BOOLEAN DEFAULT false,
      name TEXT,
      avatar TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      -- Custom fields
      user_type TEXT CHECK (user_type IN ('creator', 'investor', 'production', 'admin')),
      bio TEXT,
      avatar_url TEXT,
      location TEXT,
      company TEXT,
      company_role TEXT,
      phone TEXT,
      website TEXT,
      social_links JSONB DEFAULT '{}',
      subscription_tier TEXT DEFAULT 'basic',
      two_factor_enabled BOOLEAN DEFAULT false,
      two_factor_secret TEXT,
      is_demo_account BOOLEAN DEFAULT false
    )
  `;

  // Create Better Auth accounts table
  await client.queryArray`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      provider_type TEXT,
      access_token TEXT,
      refresh_token TEXT,
      id_token TEXT,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(provider, provider_id)
    )
  `;

  // Create Better Auth sessions table
  await client.queryArray`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      token TEXT UNIQUE,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Create pitches table with comprehensive fields
  await client.queryArray`
    CREATE TABLE IF NOT EXISTS pitches (
      id SERIAL PRIMARY KEY,
      creator_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      logline TEXT,
      synopsis TEXT,
      genre TEXT,
      format TEXT, -- 'feature', 'series', 'documentary', 'short'
      category TEXT, -- 'action', 'comedy', 'drama', 'thriller', etc.
      target_audience TEXT,
      budget_range TEXT,
      funding_goal DECIMAL(10, 2),
      current_funding DECIMAL(10, 2) DEFAULT 0,
      status TEXT DEFAULT 'draft', -- 'draft', 'active', 'funded', 'in_production', 'completed'
      visibility TEXT DEFAULT 'private', -- 'private', 'public', 'nda_required'
      
      -- Media fields
      poster_url TEXT,
      video_url TEXT,
      pitch_deck_url TEXT,
      script_url TEXT,
      additional_media JSONB DEFAULT '[]',
      
      -- Production details
      production_timeline TEXT,
      key_team JSONB DEFAULT '[]',
      cast_wishlist JSONB DEFAULT '[]',
      comparable_films JSONB DEFAULT '[]',
      
      -- Metrics
      view_count INTEGER DEFAULT 0,
      save_count INTEGER DEFAULT 0,
      share_count INTEGER DEFAULT 0,
      
      -- NDA settings
      nda_required BOOLEAN DEFAULT false,
      custom_nda_url TEXT,
      
      -- Timestamps
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      published_at TIMESTAMPTZ,
      funded_at TIMESTAMPTZ
    )
  `;

  // Create investments table
  await client.queryArray`
    CREATE TABLE IF NOT EXISTS investments (
      id SERIAL PRIMARY KEY,
      investor_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
      amount DECIMAL(10, 2) NOT NULL,
      investment_type TEXT, -- 'equity', 'debt', 'revenue_share'
      equity_percentage DECIMAL(5, 2),
      terms TEXT,
      status TEXT DEFAULT 'pending', -- 'pending', 'committed', 'completed', 'withdrawn'
      
      -- Documents
      agreement_url TEXT,
      signed_at TIMESTAMPTZ,
      
      -- Payment details
      payment_method TEXT,
      transaction_id TEXT,
      
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(investor_id, pitch_id)
    )
  `;

  // Create NDA requests table
  await client.queryArray`
    CREATE TABLE IF NOT EXISTS nda_requests (
      id SERIAL PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'expired'
      
      -- NDA details
      nda_type TEXT DEFAULT 'standard', -- 'standard', 'mutual', 'custom'
      custom_terms TEXT,
      
      -- Signature tracking
      requested_at TIMESTAMPTZ DEFAULT NOW(),
      approved_at TIMESTAMPTZ,
      rejected_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      signed_document_url TEXT,
      ip_address TEXT,
      
      -- Access control
      access_granted BOOLEAN DEFAULT false,
      access_revoked_at TIMESTAMPTZ,
      
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, pitch_id)
    )
  `;

  // Create messages table
  await client.queryArray`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      sender_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      recipient_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      pitch_id INTEGER REFERENCES pitches(id) ON DELETE SET NULL,
      
      subject TEXT,
      content TEXT NOT NULL,
      
      -- Message metadata
      is_read BOOLEAN DEFAULT false,
      is_archived BOOLEAN DEFAULT false,
      is_starred BOOLEAN DEFAULT false,
      
      -- Threading
      thread_id TEXT,
      reply_to_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
      
      -- Attachments
      attachments JSONB DEFAULT '[]',
      
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Create follows table
  await client.queryArray`
    CREATE TABLE IF NOT EXISTS follows (
      id SERIAL PRIMARY KEY,
      follower_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      following_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(follower_id, following_id)
    )
  `;

  // Create saved pitches table
  await client.queryArray`
    CREATE TABLE IF NOT EXISTS saved_pitches (
      id SERIAL PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
      notes TEXT,
      tags JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, pitch_id)
    )
  `;

  // Create notifications table
  await client.queryArray`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL, -- 'nda_request', 'investment', 'message', 'follow', 'pitch_update'
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      
      -- Related entities
      related_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      related_pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
      related_id TEXT, -- Generic ID for other entities
      
      -- Metadata
      data JSONB DEFAULT '{}',
      action_url TEXT,
      
      -- Status
      is_read BOOLEAN DEFAULT false,
      read_at TIMESTAMPTZ,
      
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Create analytics_events table for tracking
  await client.queryArray`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id SERIAL PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL, -- 'page_view', 'pitch_view', 'button_click', etc.
      event_category TEXT,
      event_action TEXT,
      event_label TEXT,
      event_value INTEGER,
      
      -- Context
      page_url TEXT,
      referrer TEXT,
      user_agent TEXT,
      ip_address TEXT,
      
      -- Related entities
      pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
      related_id TEXT,
      
      -- Session info
      session_id TEXT,
      
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  console.log('✅ Tables created/updated successfully');
}

async function clearExistingData() {
  console.log('🗑️ Clearing existing demo data...');
  
  // Delete only demo accounts and their related data
  await client.queryArray`DELETE FROM users WHERE is_demo_account = true`;
  
  console.log('✅ Existing demo data cleared');
}

async function createDemoUsers() {
  console.log('👥 Creating demo users...');
  
  const demoPassword = await hashPassword('Demo123');
  
  const users = [
    // Creators
    {
      id: 'demo-creator-alex',
      email: 'alex.creator@demo.com',
      name: 'Alex Rodriguez',
      user_type: 'creator',
      bio: 'Award-winning filmmaker with 10+ years experience in independent cinema. Passionate about telling stories that matter.',
      company: 'Indie Films Studio',
      company_role: 'Director/Producer',
      location: 'Los Angeles, CA',
      website: 'https://alexrodriguez.film',
      social_links: JSON.stringify({
        twitter: '@alexrodfilm',
        instagram: '@alexrodriguez',
        imdb: 'nm1234567'
      }),
      is_demo_account: true
    },
    {
      id: 'demo-creator-maya',
      email: 'maya.writer@demo.com',
      name: 'Maya Patel',
      user_type: 'creator',
      bio: 'Screenwriter specializing in sci-fi and thriller genres. WGA member with multiple produced credits.',
      company: 'Patel Productions',
      company_role: 'Head Writer',
      location: 'New York, NY',
      is_demo_account: true
    },
    {
      id: 'demo-creator-james',
      email: 'james.director@demo.com',
      name: 'James Chen',
      user_type: 'creator',
      bio: 'Documentary filmmaker focused on environmental and social justice stories.',
      company: 'Truth Lens Productions',
      company_role: 'Director',
      location: 'San Francisco, CA',
      is_demo_account: true
    },
    
    // Investors
    {
      id: 'demo-investor-sarah',
      email: 'sarah.investor@demo.com',
      name: 'Sarah Thompson',
      user_type: 'investor',
      bio: 'Angel investor and entertainment industry veteran. Former studio executive with 20+ years experience.',
      company: 'Thompson Ventures',
      company_role: 'Managing Partner',
      location: 'Beverly Hills, CA',
      website: 'https://thompsonventures.com',
      is_demo_account: true
    },
    {
      id: 'demo-investor-michael',
      email: 'michael.fund@demo.com',
      name: 'Michael Davis',
      user_type: 'investor',
      bio: 'Film financing specialist. Focus on genre films with strong international appeal.',
      company: 'Davis Entertainment Fund',
      company_role: 'Principal',
      location: 'Miami, FL',
      is_demo_account: true
    },
    {
      id: 'demo-investor-lisa',
      email: 'lisa.capital@demo.com',
      name: 'Lisa Wong',
      user_type: 'investor',
      bio: 'Managing Director at Pacific Media Ventures. Specializing in Asian co-productions.',
      company: 'Pacific Media Ventures',
      company_role: 'Managing Director',
      location: 'Los Angeles, CA',
      is_demo_account: true
    },
    
    // Production Companies
    {
      id: 'demo-prod-stellar',
      email: 'stellar.production@demo.com',
      name: 'Stellar Pictures',
      user_type: 'production',
      bio: 'Independent production company specializing in high-concept genre films for global audiences.',
      company: 'Stellar Pictures',
      company_role: 'Production Company',
      location: 'Los Angeles, CA',
      website: 'https://stellarpictures.com',
      is_demo_account: true
    },
    {
      id: 'demo-prod-northstar',
      email: 'northstar.films@demo.com',
      name: 'NorthStar Films',
      user_type: 'production',
      bio: 'Boutique production company focused on prestige dramas and limited series.',
      company: 'NorthStar Films',
      company_role: 'Production Company',
      location: 'New York, NY',
      is_demo_account: true
    },
    {
      id: 'demo-prod-global',
      email: 'global.media@demo.com',
      name: 'Global Media Productions',
      user_type: 'production',
      bio: 'International production and distribution company with offices in LA, London, and Mumbai.',
      company: 'Global Media Productions',
      company_role: 'Production Company',
      location: 'Los Angeles, CA',
      is_demo_account: true
    }
  ];

  for (const user of users) {
    await client.queryArray`
      INSERT INTO users (
        email, username, password, password_hash, user_type, 
        first_name, last_name, bio, company_name, location, website, is_demo_account
      ) VALUES (
        ${user.email}, 
        ${user.email.split('@')[0]}, 
        'Demo123', 
        ${await bcrypt.hash('Demo123')},
        ${user.user_type}, 
        ${user.name.split(' ')[0]}, 
        ${user.name.split(' ')[1] || ''}, 
        ${user.bio}, 
        ${user.company || user.name}, 
        ${user.location}, 
        ${user.website || null}, 
        ${user.is_demo_account}
      ) ON CONFLICT (email) DO UPDATE SET
        user_type = EXCLUDED.user_type,
        bio = EXCLUDED.bio,
        company_name = EXCLUDED.company_name,
        location = EXCLUDED.location,
        website = EXCLUDED.website,
        updated_at = NOW()
    `;
    
    // Get the actual user ID from the database
    const userResult = await client.queryArray`
      SELECT id FROM users WHERE email = ${user.email}
    `;
    
    if (userResult.rows.length > 0) {
      const userId = userResult.rows[0][0];
      // Create Better Auth account entry if account table exists
      await client.queryArray`
        INSERT INTO account (
          id, account_id, provider_id, user_id, password
        ) VALUES (
          ${crypto.randomUUID()}, 
          ${user.email}, 
          'credential', 
          ${userId}, 
          ${await bcrypt.hash('Demo123')}
        ) ON CONFLICT (provider_id, account_id) DO UPDATE SET
          password = EXCLUDED.password,
          updated_at = NOW()
      `.catch(() => {
        // Account table might not exist or have different structure
        console.log(`Note: Could not create account entry for ${user.email}`);
      });
    }
  }
  
  // Get the actual user IDs from the database for return value
  const createdUsers = await client.queryArray`
    SELECT id, email, COALESCE(first_name || ' ' || last_name, username, email) as name, user_type
    FROM users
    WHERE is_demo_account = true
  `;
  
  console.log(`✅ Created ${createdUsers.rows.length} demo users`);
  return createdUsers.rows.map(row => ({ 
    id: row[0], 
    email: row[1], 
    name: row[2], 
    type: row[3] 
  }));
}

async function createPitches() {
  console.log('🎬 Creating demo pitches...');
  
  const pitches = [
    // Alex's pitches
    {
      creator_id: 'demo-creator-alex',
      title: 'The Last Horizon',
      logline: 'When Earth\'s final colony ship malfunctions, a lone engineer must choose between saving her family or humanity\'s last hope.',
      synopsis: 'Set in 2157, "The Last Horizon" follows Maya Chen, chief engineer aboard humanity\'s final colony ship carrying 10,000 sleeping passengers to a new world. When a cascade failure threatens to destroy the ship, Maya discovers she can only save one section - either the one containing her family or the one with humanity\'s genetic diversity bank and cultural archives.',
      genre: 'Sci-Fi Thriller',
      format: 'feature',
      category: 'thriller',
      target_audience: '18-45, sci-fi enthusiasts, fans of Interstellar and The Martian',
      budget_range: '$15-25 million',
      funding_goal: 20000000,
      current_funding: 5500000,
      status: 'active',
      visibility: 'public',
      view_count: 1523,
      save_count: 234,
      nda_required: false,
      production_timeline: '24 months from funding',
      key_team: JSON.stringify([
        { role: 'Director', name: 'Alex Rodriguez' },
        { role: 'Producer', name: 'Jennifer Martinez' },
        { role: 'Cinematographer', name: 'Roger Deakins' }
      ]),
      comparable_films: JSON.stringify([
        'Gravity', 'The Martian', 'Arrival', 'Interstellar'
      ])
    },
    {
      creator_id: 'demo-creator-alex',
      title: 'Echoes of Tomorrow',
      logline: 'A detective who can see 24 hours into the future must prevent his own murder while solving the crime that hasn\'t happened yet.',
      synopsis: 'Detective Marcus Webb wakes up with the ability to see exactly 24 hours into the future. When he witnesses his own death, he has one day to unravel a conspiracy that hasn\'t unfolded yet, change a predetermined future, and discover the source of his mysterious gift.',
      genre: 'Thriller/Mystery',
      format: 'series',
      category: 'thriller',
      target_audience: 'Fans of Minority Report, True Detective, and Black Mirror',
      budget_range: '$3-5 million per episode',
      funding_goal: 30000000,
      current_funding: 8000000,
      status: 'active',
      visibility: 'nda_required',
      view_count: 892,
      save_count: 156,
      nda_required: true,
      production_timeline: '18 months for Season 1 (8 episodes)'
    },
    
    // Maya's pitches
    {
      creator_id: 'demo-creator-maya',
      title: 'The Memory Thief',
      logline: 'In a world where memories can be extracted and sold, a black market dealer discovers she\'s been stealing her own past.',
      synopsis: 'In 2045 Los Angeles, memories are the new currency. Zara Kane runs an illegal memory extraction service, helping people forget their traumas - for a price. But when she discovers gaps in her own past and realizes she\'s been her own client, she must piece together what she made herself forget before her erased memories destroy everything she\'s built.',
      genre: 'Sci-Fi Noir',
      format: 'feature',
      category: 'thriller',
      target_audience: 'Adult audiences, fans of Blade Runner and Inception',
      budget_range: '$30-40 million',
      funding_goal: 35000000,
      current_funding: 12000000,
      status: 'active',
      visibility: 'public',
      view_count: 2341,
      save_count: 445,
      nda_required: false
    },
    {
      creator_id: 'demo-creator-maya',
      title: 'Quantum Hearts',
      logline: 'Two scientists fall in love across parallel dimensions, but each kiss erases another version of themselves.',
      synopsis: 'Dr. Sarah Chen and Dr. David Park independently discover how to communicate across parallel dimensions, only to find versions of each other in every universe. As they fall in love across realities, they realize their connection is collapsing the multiverse, forcing them to choose between their love and existence itself.',
      genre: 'Romantic Sci-Fi',
      format: 'feature',
      category: 'drama',
      target_audience: 'Fans of Everything Everywhere All at Once, Eternal Sunshine',
      budget_range: '$20-30 million',
      funding_goal: 25000000,
      current_funding: 3000000,
      status: 'active',
      visibility: 'public',
      view_count: 1678,
      save_count: 234,
      nda_required: false
    },
    
    // James's documentaries
    {
      creator_id: 'demo-creator-james',
      title: 'The Last Reef',
      logline: 'A race against time to document and save the world\'s last pristine coral reef before climate change destroys it forever.',
      synopsis: 'Following a team of marine biologists and indigenous guardians as they work to protect the last untouched coral reef in the Pacific. The documentary captures the reef\'s stunning biodiversity while exposing the political and economic forces threatening its survival.',
      genre: 'Environmental Documentary',
      format: 'documentary',
      category: 'documentary',
      target_audience: 'Environmental advocates, nature documentary fans',
      budget_range: '$2-3 million',
      funding_goal: 2500000,
      current_funding: 1800000,
      status: 'active',
      visibility: 'public',
      view_count: 3234,
      save_count: 567,
      nda_required: false,
      production_timeline: '18 months including post-production'
    },
    {
      creator_id: 'demo-creator-james',
      title: 'Digital Ghosts',
      logline: 'Exploring what happens to our digital selves after we die, and who controls our online legacy.',
      synopsis: 'An investigation into the trillion-dollar industry emerging around digital death. From AI recreations of deceased loved ones to social media profiles that outlive their owners, this documentary examines the ethical, legal, and emotional implications of our immortal digital footprints.',
      genre: 'Technology Documentary',
      format: 'documentary',
      category: 'documentary',
      target_audience: 'Tech-savvy audiences, Black Mirror fans, 25-45 demographic',
      budget_range: '$1.5-2 million',
      funding_goal: 1750000,
      current_funding: 500000,
      status: 'active',
      visibility: 'public',
      view_count: 1123,
      save_count: 189,
      nda_required: false
    }
  ];

  const pitchIds = [];
  for (const pitch of pitches) {
    const result = await client.queryArray`
      INSERT INTO pitches (
        creator_id, title, logline, synopsis, genre, format, category,
        target_audience, budget_range, funding_goal, current_funding,
        status, visibility, view_count, save_count, nda_required,
        production_timeline, key_team, comparable_films, published_at
      ) VALUES (
        ${pitch.creator_id}, ${pitch.title}, ${pitch.logline}, ${pitch.synopsis},
        ${pitch.genre}, ${pitch.format}, ${pitch.category}, ${pitch.target_audience},
        ${pitch.budget_range}, ${pitch.funding_goal}, ${pitch.current_funding},
        ${pitch.status}, ${pitch.visibility}, ${pitch.view_count}, ${pitch.save_count},
        ${pitch.nda_required}, ${pitch.production_timeline || null}, 
        ${pitch.key_team || '[]'}, ${pitch.comparable_films || '[]'}, NOW()
      ) RETURNING id, title, creator_id
    `;
    pitchIds.push({ 
      id: result.rows[0][0], 
      title: result.rows[0][1],
      creator_id: result.rows[0][2]
    });
  }
  
  console.log(`✅ Created ${pitches.length} demo pitches`);
  return pitchIds;
}

async function createInvestments(pitchIds: any[]) {
  console.log('💰 Creating demo investments...');
  
  const investments = [
    // Sarah Thompson's investments
    {
      investor_id: 'demo-investor-sarah',
      pitch_title: 'The Last Horizon',
      amount: 2000000,
      investment_type: 'equity',
      equity_percentage: 10,
      status: 'completed'
    },
    {
      investor_id: 'demo-investor-sarah',
      pitch_title: 'The Memory Thief',
      amount: 5000000,
      investment_type: 'equity',
      equity_percentage: 15,
      status: 'completed'
    },
    {
      investor_id: 'demo-investor-sarah',
      pitch_title: 'The Last Reef',
      amount: 500000,
      investment_type: 'revenue_share',
      status: 'completed'
    },
    
    // Michael Davis's investments
    {
      investor_id: 'demo-investor-michael',
      pitch_title: 'Echoes of Tomorrow',
      amount: 3000000,
      investment_type: 'equity',
      equity_percentage: 10,
      status: 'completed'
    },
    {
      investor_id: 'demo-investor-michael',
      pitch_title: 'The Memory Thief',
      amount: 7000000,
      investment_type: 'equity',
      equity_percentage: 20,
      status: 'completed'
    },
    
    // Lisa Wong's investments
    {
      investor_id: 'demo-investor-lisa',
      pitch_title: 'The Last Horizon',
      amount: 3500000,
      investment_type: 'equity',
      equity_percentage: 17.5,
      status: 'completed'
    },
    {
      investor_id: 'demo-investor-lisa',
      pitch_title: 'Quantum Hearts',
      amount: 3000000,
      investment_type: 'equity',
      equity_percentage: 12,
      status: 'committed'
    },
    {
      investor_id: 'demo-investor-lisa',
      pitch_title: 'The Last Reef',
      amount: 1300000,
      investment_type: 'grant',
      status: 'completed'
    }
  ];

  for (const investment of investments) {
    const pitch = pitchIds.find(p => p.title === investment.pitch_title);
    if (pitch) {
      await client.queryArray`
        INSERT INTO investments (
          investor_id, pitch_id, amount, investment_type,
          equity_percentage, status, signed_at
        ) VALUES (
          ${investment.investor_id}, ${pitch.id}, ${investment.amount},
          ${investment.investment_type}, ${investment.equity_percentage || null},
          ${investment.status}, ${investment.status === 'completed' ? 'NOW()' : null}
        ) ON CONFLICT (investor_id, pitch_id) DO UPDATE SET
          amount = EXCLUDED.amount,
          status = EXCLUDED.status,
          updated_at = NOW()
      `;
    }
  }
  
  console.log(`✅ Created ${investments.length} demo investments`);
}

async function createNDARequests(pitchIds: any[]) {
  console.log('📋 Creating demo NDA requests...');
  
  const ndaRequests = [
    // For "Echoes of Tomorrow" (NDA required)
    {
      user_id: 'demo-investor-sarah',
      pitch_title: 'Echoes of Tomorrow',
      status: 'approved',
      approved: true
    },
    {
      user_id: 'demo-investor-michael',
      pitch_title: 'Echoes of Tomorrow',
      status: 'approved',
      approved: true
    },
    {
      user_id: 'demo-prod-stellar',
      pitch_title: 'Echoes of Tomorrow',
      status: 'pending',
      approved: false
    },
    {
      user_id: 'demo-prod-northstar',
      pitch_title: 'Echoes of Tomorrow',
      status: 'approved',
      approved: true
    }
  ];

  for (const nda of ndaRequests) {
    const pitch = pitchIds.find(p => p.title === nda.pitch_title);
    if (pitch) {
      await client.queryArray`
        INSERT INTO nda_requests (
          user_id, pitch_id, status, access_granted,
          approved_at, expires_at
        ) VALUES (
          ${nda.user_id}, ${pitch.id}, ${nda.status}, ${nda.approved},
          ${nda.approved ? 'NOW()' : null},
          ${nda.approved ? `NOW() + INTERVAL '90 days'` : null}
        ) ON CONFLICT (user_id, pitch_id) DO UPDATE SET
          status = EXCLUDED.status,
          access_granted = EXCLUDED.access_granted,
          updated_at = NOW()
      `;
    }
  }
  
  console.log(`✅ Created ${ndaRequests.length} demo NDA requests`);
}

async function createMessages() {
  console.log('✉️ Creating demo messages...');
  
  const messages = [
    {
      sender_id: 'demo-investor-sarah',
      recipient_id: 'demo-creator-alex',
      subject: 'Re: The Last Horizon - Investment Opportunity',
      content: 'Alex, I\'m very interested in The Last Horizon. The concept is unique and the budget seems reasonable for the scope. Can we schedule a call this week to discuss terms?'
    },
    {
      sender_id: 'demo-creator-alex',
      recipient_id: 'demo-investor-sarah',
      subject: 'Re: The Last Horizon - Investment Opportunity',
      content: 'Sarah, thank you for your interest! I\'d be happy to discuss further. I\'m available Tuesday or Thursday afternoon. I can also send over our detailed financial projections and distribution strategy.',
      reply_to_previous: true
    },
    {
      sender_id: 'demo-prod-stellar',
      recipient_id: 'demo-creator-maya',
      subject: 'The Memory Thief - Production Partnership',
      content: 'Maya, we\'ve reviewed The Memory Thief and believe it aligns perfectly with our slate. We\'d like to discuss coming on board as producers and can contribute both funding and distribution.'
    },
    {
      sender_id: 'demo-investor-michael',
      recipient_id: 'demo-creator-james',
      subject: 'Digital Ghosts Documentary',
      content: 'James, the Digital Ghosts concept is fascinating and timely. I specialize in documentary financing and would like to explore investment options. What\'s your current funding gap?'
    },
    {
      sender_id: 'demo-prod-northstar',
      recipient_id: 'demo-creator-alex',
      subject: 'Echoes of Tomorrow - Series Development',
      content: 'We\'re impressed with Echoes of Tomorrow. Our company has strong relationships with streaming platforms and we believe this could be a flagship series. Let\'s discuss a development deal.'
    }
  ];

  let previousMessageId = null;
  for (const message of messages) {
    const result = await client.queryArray`
      INSERT INTO messages (
        sender_id, recipient_id, subject, content,
        reply_to_id, thread_id
      ) VALUES (
        ${message.sender_id}, ${message.recipient_id},
        ${message.subject}, ${message.content},
        ${message.reply_to_previous ? previousMessageId : null},
        ${message.reply_to_previous ? 'thread-1' : `thread-${Math.random().toString(36).substr(2, 9)}`}
      ) RETURNING id
    `;
    previousMessageId = result.rows[0][0];
  }
  
  console.log(`✅ Created ${messages.length} demo messages`);
}

async function createFollows() {
  console.log('👥 Creating demo follows...');
  
  const follows = [
    // Investors following creators
    { follower: 'demo-investor-sarah', following: 'demo-creator-alex' },
    { follower: 'demo-investor-sarah', following: 'demo-creator-maya' },
    { follower: 'demo-investor-sarah', following: 'demo-creator-james' },
    { follower: 'demo-investor-michael', following: 'demo-creator-alex' },
    { follower: 'demo-investor-michael', following: 'demo-creator-maya' },
    { follower: 'demo-investor-lisa', following: 'demo-creator-james' },
    
    // Production companies following creators
    { follower: 'demo-prod-stellar', following: 'demo-creator-alex' },
    { follower: 'demo-prod-stellar', following: 'demo-creator-maya' },
    { follower: 'demo-prod-northstar', following: 'demo-creator-alex' },
    { follower: 'demo-prod-global', following: 'demo-creator-james' },
    
    // Creators following each other
    { follower: 'demo-creator-alex', following: 'demo-creator-maya' },
    { follower: 'demo-creator-maya', following: 'demo-creator-alex' },
    { follower: 'demo-creator-james', following: 'demo-creator-alex' }
  ];

  for (const follow of follows) {
    await client.queryArray`
      INSERT INTO follows (follower_id, following_id)
      VALUES (${follow.follower}, ${follow.following})
      ON CONFLICT (follower_id, following_id) DO NOTHING
    `;
  }
  
  console.log(`✅ Created ${follows.length} follow relationships`);
}

async function createSavedPitches(pitchIds: any[]) {
  console.log('💾 Creating saved pitches...');
  
  const savedPitches = [
    { user: 'demo-investor-sarah', pitch_title: 'The Last Horizon', notes: 'Strong concept, good team' },
    { user: 'demo-investor-sarah', pitch_title: 'The Memory Thief', notes: 'Unique premise, check comparables' },
    { user: 'demo-investor-sarah', pitch_title: 'Quantum Hearts', notes: 'Interesting but needs script review' },
    { user: 'demo-investor-michael', pitch_title: 'Echoes of Tomorrow', notes: 'Perfect for streaming platforms' },
    { user: 'demo-investor-michael', pitch_title: 'The Memory Thief', notes: 'Great international potential' },
    { user: 'demo-investor-lisa', pitch_title: 'The Last Reef', notes: 'Impact investment opportunity' },
    { user: 'demo-prod-stellar', pitch_title: 'The Memory Thief', notes: 'Fits our slate perfectly' },
    { user: 'demo-prod-northstar', pitch_title: 'Echoes of Tomorrow', notes: 'Series potential' }
  ];

  for (const saved of savedPitches) {
    const pitch = pitchIds.find(p => p.title === saved.pitch_title);
    if (pitch) {
      await client.queryArray`
        INSERT INTO saved_pitches (user_id, pitch_id, notes)
        VALUES (${saved.user}, ${pitch.id}, ${saved.notes})
        ON CONFLICT (user_id, pitch_id) DO UPDATE SET
          notes = EXCLUDED.notes
      `;
    }
  }
  
  console.log(`✅ Created ${savedPitches.length} saved pitches`);
}

async function createNotifications() {
  console.log('🔔 Creating demo notifications...');
  
  const notifications = [
    {
      user_id: 'demo-creator-alex',
      type: 'investment',
      title: 'New Investment Received',
      message: 'Sarah Thompson has invested $2,000,000 in The Last Horizon',
      related_user_id: 'demo-investor-sarah'
    },
    {
      user_id: 'demo-creator-alex',
      type: 'message',
      title: 'New Message',
      message: 'You have a new message from NorthStar Films',
      related_user_id: 'demo-prod-northstar'
    },
    {
      user_id: 'demo-creator-alex',
      type: 'nda_request',
      title: 'NDA Request Approved',
      message: 'NorthStar Films has signed the NDA for Echoes of Tomorrow',
      related_user_id: 'demo-prod-northstar'
    },
    {
      user_id: 'demo-creator-maya',
      type: 'follow',
      title: 'New Follower',
      message: 'Stellar Pictures is now following you',
      related_user_id: 'demo-prod-stellar'
    },
    {
      user_id: 'demo-investor-sarah',
      type: 'pitch_update',
      title: 'Pitch Update',
      message: 'The Last Horizon has been updated with new financial projections',
      related_user_id: 'demo-creator-alex'
    }
  ];

  for (const notification of notifications) {
    await client.queryArray`
      INSERT INTO notifications (
        user_id, type, title, message, related_user_id
      ) VALUES (
        ${notification.user_id}, ${notification.type},
        ${notification.title}, ${notification.message},
        ${notification.related_user_id}
      )
    `;
  }
  
  console.log(`✅ Created ${notifications.length} demo notifications`);
}

async function main() {
  try {
    console.log('🚀 Starting production database population...');
    console.log(`📊 Database: ${dbConfig.database} on ${dbConfig.hostname}`);
    
    await client.connect();
    console.log('✅ Connected to database');
    
    // Create tables
    await createTables();
    
    // Clear existing demo data
    await clearExistingData();
    
    // Create demo users
    const users = await createDemoUsers();
    
    // Create pitches
    const pitchIds = await createPitches();
    
    // Create business workflow data
    await createInvestments(pitchIds);
    await createNDARequests(pitchIds);
    await createMessages();
    await createFollows();
    await createSavedPitches(pitchIds);
    await createNotifications();
    
    console.log('\n✨ Production database populated successfully!');
    console.log('\n📧 Demo Accounts (Password: Demo123):');
    console.log('----------------------------------------');
    users.forEach(user => {
      console.log(`${user.type.padEnd(10)} | ${user.email.padEnd(30)} | ${user.name}`);
    });
    console.log('----------------------------------------');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.end();
    console.log('👋 Database connection closed');
  }
}

// Run the script
if (import.meta.main) {
  main().catch(console.error);
}