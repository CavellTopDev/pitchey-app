import { neon } from "npm:@neondatabase/serverless";

const DATABASE_URL = Deno.env.get("DATABASE_URL");
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not found");
  Deno.exit(1);
}

const sql = neon(DATABASE_URL);

console.log("🚀 Initializing database with minimal schema...");

try {
  // Create users table
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      username VARCHAR(100) NOT NULL,
      password VARCHAR(255) NOT NULL,
      user_type VARCHAR(50) NOT NULL,
      company_name VARCHAR(255),
      company_number VARCHAR(255),
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      bio TEXT,
      location VARCHAR(255),
      profile_image VARCHAR(500),
      is_verified BOOLEAN DEFAULT FALSE,
      email_verified BOOLEAN DEFAULT FALSE,
      email_verification_token VARCHAR(255),
      last_login_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  console.log("✅ Users table created");

  // Create pitches table
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
      require_nda BOOLEAN DEFAULT FALSE,
      published_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  console.log("✅ Pitches table created");

  // Insert demo users one by one to handle conflicts better
  const userInserts = [
    { id: 1, email: 'alex.creator@demo.com', username: 'alexcreator', userType: 'creator', company: 'Independent Films' },
    { id: 2, email: 'sarah.investor@demo.com', username: 'sarahinvestor', userType: 'investor', company: 'Johnson Ventures' },
    { id: 3, email: 'stellar.production@demo.com', username: 'stellarproduction', userType: 'production', company: 'Stellar Productions' }
  ];

  const users = [];
  for (const user of userInserts) {
    try {
      const result = await sql`
        INSERT INTO users (id, email, username, password, user_type, company_name) 
        VALUES (${user.id}, ${user.email}, ${user.username}, '$2b$10$example', ${user.userType}, ${user.company})
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          username = EXCLUDED.username,
          user_type = EXCLUDED.user_type,
          company_name = EXCLUDED.company_name
        RETURNING id, username, user_type
      `;
      users.push(result[0]);
    } catch (error) {
      console.log(`User ${user.username} already exists or error:`, error.message);
    }
  }
  console.log("✅ Demo users ready:", users);

  // Insert demo pitches
  const pitches = await sql`
    INSERT INTO pitches (user_id, title, logline, genre, format, status, view_count, like_count, published_at) VALUES
    (1, 'The Last Echo', 'In a world where memories can be extracted and sold, a memory thief discovers her own forgotten past.', 'scifi', 'feature', 'published', 25, 8, NOW() - INTERVAL '2 days'),
    (3, 'Midnight Kitchen', 'A late-night diner becomes the epicenter of supernatural encounters in this anthology series.', 'horror', 'tv', 'published', 42, 15, NOW() - INTERVAL '1 day'),
    (2, 'Green Dreams', 'A documentary following three families as they transition to sustainable living in urban environments.', 'documentary', 'feature', 'published', 18, 5, NOW() - INTERVAL '3 days'),
    (1, 'Code of Honor', 'When a veteran programmer discovers a conspiracy within her tech company, she must choose between loyalty and justice.', 'thriller', 'feature', 'published', 33, 12, NOW() - INTERVAL '4 days'),
    (3, 'The Canvas', 'An art forger s life spirals out of control when she is commissioned to recreate a painting that does not exist.', 'drama', 'feature', 'published', 67, 22, NOW() - INTERVAL '5 days')
    RETURNING id, title, status
  `;
  console.log("✅ Demo pitches created:", pitches);

  console.log("🎉 Database initialization complete!");
  console.log(`📊 Created ${users.length} users and ${pitches.length} pitches`);

} catch (error) {
  console.error("❌ Error during initialization:", error);
  Deno.exit(1);
}