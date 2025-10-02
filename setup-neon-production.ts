#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read

import { neon } from "npm:@neondatabase/serverless";

const sql = neon("postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require");

async function setupDatabase() {
  console.log("🚀 Setting up Pitchey Production Database");
  console.log("=========================================");

  try {
    // Drop existing tables to start fresh (be careful in production!)
    console.log("\n📊 Cleaning up existing schema...");
    await sql`DROP TABLE IF EXISTS pitch_views CASCADE`;
    await sql`DROP TABLE IF EXISTS ndas CASCADE`;
    await sql`DROP TABLE IF EXISTS messages CASCADE`;
    await sql`DROP TABLE IF EXISTS notifications CASCADE`;
    await sql`DROP TABLE IF EXISTS follows CASCADE`;
    await sql`DROP TABLE IF EXISTS portfolio CASCADE`;
    await sql`DROP TABLE IF EXISTS pitches CASCADE`;
    await sql`DROP TABLE IF EXISTS users CASCADE`;

    // Create users table
    console.log("✅ Creating users table...");
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        user_type VARCHAR(50) NOT NULL CHECK (user_type IN ('creator', 'investor', 'production', 'viewer')),
        company_name VARCHAR(255),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        bio TEXT,
        location VARCHAR(255),
        profile_image VARCHAR(500),
        is_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create pitches table
    console.log("✅ Creating pitches table...");
    await sql`
      CREATE TABLE IF NOT EXISTS pitches (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        logline TEXT NOT NULL,
        genre VARCHAR(100),
        format VARCHAR(100),
        budget VARCHAR(100),
        short_synopsis TEXT,
        long_synopsis TEXT,
        status VARCHAR(50) DEFAULT 'draft',
        view_count INTEGER DEFAULT 0,
        like_count INTEGER DEFAULT 0,
        nda_count INTEGER DEFAULT 0,
        thumbnail_url VARCHAR(500),
        lookbook_url VARCHAR(500),
        script_url VARCHAR(500),
        trailer_url VARCHAR(500),
        pitch_deck_url VARCHAR(500),
        require_nda BOOLEAN DEFAULT false,
        published_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create follows table
    console.log("✅ Creating follows table...");
    await sql`
      CREATE TABLE IF NOT EXISTS follows (
        id SERIAL PRIMARY KEY,
        follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        followed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(follower_id, creator_id)
      )
    `;

    // Create NDAs table
    console.log("✅ Creating NDAs table...");
    await sql`
      CREATE TABLE IF NOT EXISTS ndas (
        id SERIAL PRIMARY KEY,
        pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
        requester_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'pending',
        signed_at TIMESTAMP,
        expires_at TIMESTAMP,
        document_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create messages table
    console.log("✅ Creating messages table...");
    await sql`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        subject VARCHAR(255),
        content TEXT,
        pitch_id INTEGER REFERENCES pitches(id) ON DELETE SET NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create pitch_views table
    console.log("✅ Creating pitch_views table...");
    await sql`
      CREATE TABLE IF NOT EXISTS pitch_views (
        id SERIAL PRIMARY KEY,
        pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
        viewer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        view_type VARCHAR(50),
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(pitch_id, viewer_id, view_type)
      )
    `;

    // Create notifications table
    console.log("✅ Creating notifications table...");
    await sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50),
        title VARCHAR(255),
        message TEXT,
        related_id INTEGER,
        related_type VARCHAR(50),
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create portfolio table for investments
    console.log("✅ Creating portfolio table...");
    await sql`
      CREATE TABLE IF NOT EXISTS portfolio (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2),
        current_value DECIMAL(10, 2),
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log("\n✅ All tables created successfully!");

    // Seed demo accounts
    console.log("\n🌱 Seeding demo accounts...");
    
    const demoPassword = "$2a$10$X4kv7j5ZcQgSvPOh5lBst.XhQF/ECIKX8mz0W3X3bvLj7CQvzj.3K"; // Demo123
    
    // Create demo users
    await sql`
      INSERT INTO users (email, username, password, user_type, company_name, first_name, last_name, is_verified)
      VALUES 
        ('alex.creator@demo.com', 'alexcreator', ${demoPassword}, 'creator', 'Independent Films', 'Alex', 'Chen', true),
        ('sarah.investor@demo.com', 'sarahinvestor', ${demoPassword}, 'investor', 'Mitchell Ventures', 'Sarah', 'Mitchell', true),
        ('stellar.production@demo.com', 'stellarprod', ${demoPassword}, 'production', 'Stellar Productions', 'Stellar', 'Productions', true)
      ON CONFLICT (email) DO NOTHING
    `;

    console.log("✅ Demo accounts created!");
    console.log("\nDemo Accounts (Password: Demo123):");
    console.log("- Creator: alex.creator@demo.com");
    console.log("- Investor: sarah.investor@demo.com");
    console.log("- Production: stellar.production@demo.com");

    // Add some sample pitches for the creator
    const creatorResult = await sql`SELECT id FROM users WHERE email = 'alex.creator@demo.com'`;
    if (creatorResult.length > 0) {
      const creatorId = creatorResult[0].id;
      
      await sql`
        INSERT INTO pitches (user_id, title, logline, genre, format, budget, status, view_count, like_count, published_at)
        VALUES 
          (${creatorId}, 'Quantum Paradox', 'A physicist discovers time travel but each jump erases someone from existence', 'sci-fi', 'feature', '$5-10M', 'published', 1532, 89, NOW()),
          (${creatorId}, 'The Last Colony', 'Earth''s final space colony loses contact with home and discovers they''re not alone', 'thriller', 'limited-series', '$20-30M', 'published', 987, 67, NOW()),
          (${creatorId}, 'Digital Minds', 'Documentary exploring the rise of AI and its impact on humanity', 'documentary', 'feature', '$1-3M', 'draft', 0, 0, NULL)
        ON CONFLICT DO NOTHING
      `;
      
      console.log("✅ Sample pitches created!");
    }

    console.log("\n🎉 Database setup complete!");
    console.log("Your Pitchey platform is ready to use!");

  } catch (error) {
    console.error("❌ Error setting up database:", error);
    throw error;
  }
}

// Run setup
await setupDatabase();
Deno.exit(0);