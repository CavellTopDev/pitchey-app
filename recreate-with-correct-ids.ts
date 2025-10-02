#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read

import { neon } from "npm:@neondatabase/serverless";

const sql = neon("postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require");

async function recreateWithCorrectIds() {
  console.log("🔄 Recreating database with correct IDs");
  console.log("=======================================");

  try {
    // Drop all tables and sequences
    console.log("\n🗑️ Dropping existing tables and sequences...");
    await sql`DROP TABLE IF EXISTS pitch_views CASCADE`;
    await sql`DROP TABLE IF EXISTS ndas CASCADE`;
    await sql`DROP TABLE IF EXISTS messages CASCADE`;
    await sql`DROP TABLE IF EXISTS notifications CASCADE`;
    await sql`DROP TABLE IF EXISTS follows CASCADE`;
    await sql`DROP TABLE IF EXISTS portfolio CASCADE`;
    await sql`DROP TABLE IF EXISTS pitches CASCADE`;
    await sql`DROP TABLE IF EXISTS users CASCADE`;
    await sql`DROP SEQUENCE IF EXISTS users_id_seq CASCADE`;

    // Create users table with ID starting at 1001
    console.log("✅ Creating users table...");
    await sql`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY DEFAULT 1001,
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
    
    // Create sequence starting at 1001
    await sql`CREATE SEQUENCE users_id_seq START 1001`;
    await sql`ALTER TABLE users ALTER COLUMN id SET DEFAULT nextval('users_id_seq')`;

    // Create other tables
    console.log("✅ Creating pitches table...");
    await sql`
      CREATE TABLE pitches (
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

    // Create other necessary tables
    await sql`
      CREATE TABLE follows (
        id SERIAL PRIMARY KEY,
        follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        followed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(follower_id, creator_id)
      )
    `;

    await sql`
      CREATE TABLE ndas (
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

    await sql`
      CREATE TABLE messages (
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

    await sql`
      CREATE TABLE pitch_views (
        id SERIAL PRIMARY KEY,
        pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
        viewer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        view_type VARCHAR(50),
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(pitch_id, viewer_id, view_type)
      )
    `;

    await sql`
      CREATE TABLE notifications (
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

    await sql`
      CREATE TABLE portfolio (
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

    console.log("\n🌱 Creating demo accounts with correct IDs...");
    
    // Use pre-hashed password for Demo123 (bcrypt hash)
    const hashedPassword = "$2a$10$X4kv7j5ZcQgSvPOh5lBst.XhQF/ECIKX8mz0W3X3bvLj7CQvzj.3K";
    
    // Insert users with specific IDs
    await sql`
      INSERT INTO users (id, email, username, password, user_type, company_name, first_name, last_name, is_verified)
      VALUES 
        (1001, 'alex.creator@demo.com', 'alexcreator', ${hashedPassword}, 'creator', 'Independent Films', 'Alex', 'Chen', true),
        (1002, 'sarah.investor@demo.com', 'sarahinvestor', ${hashedPassword}, 'investor', 'Mitchell Ventures', 'Sarah', 'Mitchell', true),
        (1003, 'stellar.production@demo.com', 'stellarprod', ${hashedPassword}, 'production', 'Stellar Productions', 'Stellar', 'Productions', true)
    `;
    
    // Update sequence to continue from 1004
    await sql`ALTER SEQUENCE users_id_seq RESTART WITH 1004`;

    console.log("✅ Users created with correct IDs!");

    // Add sample pitches for creator ID 1001
    await sql`
      INSERT INTO pitches (user_id, title, logline, genre, format, budget, status, view_count, like_count, published_at)
      VALUES 
        (1001, 'Quantum Paradox', 'A physicist discovers time travel but each jump erases someone from existence', 'sci-fi', 'feature', '$5-10M', 'published', 1532, 89, NOW()),
        (1001, 'The Last Colony', 'Earth''s final space colony loses contact with home and discovers they''re not alone', 'thriller', 'limited-series', '$20-30M', 'published', 987, 67, NOW()),
        (1001, 'Digital Minds', 'Documentary exploring the rise of AI and its impact on humanity', 'documentary', 'feature', '$1-3M', 'draft', 0, 0, NULL)
    `;
    
    console.log("✅ Sample pitches created!");

    // Verify the setup
    const users = await sql`SELECT id, email, user_type FROM users ORDER BY id`;
    console.log("\n📊 Final user setup:");
    users.forEach(u => console.log(`  ID ${u.id}: ${u.email} (${u.user_type})`));
    
    const pitchCount = await sql`SELECT COUNT(*) as count FROM pitches WHERE user_id = 1001`;
    console.log(`\n✅ Pitches for creator (ID 1001): ${pitchCount[0].count}`);

    console.log("\n🎉 Database recreated successfully with correct IDs!");
    console.log("\nDemo Accounts (Password: Demo123):");
    console.log("- Creator: alex.creator@demo.com (ID: 1001)");
    console.log("- Investor: sarah.investor@demo.com (ID: 1002)");
    console.log("- Production: stellar.production@demo.com (ID: 1003)");

  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
}

// Run setup
await recreateWithCorrectIds();
Deno.exit(0);