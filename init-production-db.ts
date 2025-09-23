import postgres from "npm:postgres@3.4.7";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const DATABASE_URL = Deno.env.get("DATABASE_URL");
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  Deno.exit(1);
}

const sql = postgres(DATABASE_URL);

async function initDatabase() {
  console.log("🚀 Initializing production database schema...");

  try {
    // Drop existing tables to start fresh
    console.log("📦 Dropping existing tables...");
    await sql`DROP TABLE IF EXISTS typing_indicators CASCADE`;
    await sql`DROP TABLE IF EXISTS pitch_views CASCADE`;
    await sql`DROP TABLE IF EXISTS pitch_saves CASCADE`;
    await sql`DROP TABLE IF EXISTS pitch_likes CASCADE`;
    await sql`DROP TABLE IF EXISTS follows CASCADE`;
    await sql`DROP TABLE IF EXISTS messages CASCADE`;
    await sql`DROP TABLE IF EXISTS ndas CASCADE`;
    await sql`DROP TABLE IF EXISTS pitches CASCADE`;
    await sql`DROP TABLE IF EXISTS sessions CASCADE`;
    await sql`DROP TABLE IF EXISTS users CASCADE`;

    // Create users table
    console.log("👤 Creating users table...");
    await sql`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        user_type VARCHAR(50) NOT NULL DEFAULT 'viewer',
        
        -- Profile Information
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        phone VARCHAR(20),
        location VARCHAR(200),
        bio TEXT,
        profile_image_url TEXT,
        
        -- Company Information (for production/investors)
        company_name TEXT,
        company_number VARCHAR(100),
        company_website TEXT,
        company_address TEXT,
        
        -- Verification & Status
        email_verified BOOLEAN DEFAULT FALSE,
        email_verification_token TEXT,
        email_verified_at TIMESTAMP,
        company_verified BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        
        -- Account Security
        failed_login_attempts INTEGER DEFAULT 0,
        account_locked_at TIMESTAMP,
        account_lock_reason VARCHAR(200),
        last_password_change_at TIMESTAMP,
        password_history JSONB DEFAULT '[]',
        require_password_change BOOLEAN DEFAULT FALSE,
        two_factor_enabled BOOLEAN DEFAULT FALSE,
        
        -- Subscription Information
        subscription_tier VARCHAR(50) DEFAULT 'free',
        subscription_start_date TIMESTAMP,
        subscription_end_date TIMESTAMP,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        
        -- Metadata
        last_login_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create sessions table
    console.log("🔐 Creating sessions table...");
    await sql`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        refresh_token TEXT UNIQUE,
        ip_address VARCHAR(45),
        user_agent TEXT,
        fingerprint TEXT,
        expires_at TIMESTAMP NOT NULL,
        refresh_expires_at TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create pitches table
    console.log("🎬 Creating pitches table...");
    await sql`
      CREATE TABLE pitches (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        logline TEXT NOT NULL,
        genre VARCHAR(100),
        format VARCHAR(100),
        short_synopsis TEXT,
        long_synopsis TEXT,
        opener TEXT,
        premise TEXT,
        target_audience TEXT,
        characters TEXT,
        themes TEXT,
        episode_breakdown TEXT,
        budget_bracket VARCHAR(100),
        estimated_budget DECIMAL(15,2),
        video_url VARCHAR(500),
        poster_url VARCHAR(500),
        pitch_deck_url VARCHAR(500),
        additional_materials JSONB,
        visibility VARCHAR(50) DEFAULT 'public',
        status VARCHAR(50) DEFAULT 'active',
        views INTEGER DEFAULT 0,
        likes INTEGER DEFAULT 0,
        shares INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create NDAs table
    console.log("📝 Creating NDAs table...");
    await sql`
      CREATE TABLE ndas (
        id SERIAL PRIMARY KEY,
        pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'pending',
        signed_at TIMESTAMP,
        expires_at TIMESTAMP,
        ip_address VARCHAR(100),
        signature_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(pitch_id, user_id)
      )
    `;

    // Create messages table
    console.log("💬 Creating messages table...");
    await sql`
      CREATE TABLE messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pitch_id INTEGER REFERENCES pitches(id) ON DELETE SET NULL,
        subject VARCHAR(255),
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create follows table
    console.log("👥 Creating follows table...");
    await sql`
      CREATE TABLE follows (
        id SERIAL PRIMARY KEY,
        follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(follower_id, following_id)
      )
    `;

    // Create pitch_likes table
    console.log("❤️ Creating pitch_likes table...");
    await sql`
      CREATE TABLE pitch_likes (
        id SERIAL PRIMARY KEY,
        pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(pitch_id, user_id)
      )
    `;

    // Create pitch_saves table
    console.log("🔖 Creating pitch_saves table...");
    await sql`
      CREATE TABLE pitch_saves (
        id SERIAL PRIMARY KEY,
        pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(pitch_id, user_id)
      )
    `;

    // Create pitch_views table
    console.log("👁️ Creating pitch_views table...");
    await sql`
      CREATE TABLE pitch_views (
        id SERIAL PRIMARY KEY,
        pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        ip_address VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create typing_indicators table
    console.log("⌨️ Creating typing_indicators table...");
    await sql`
      CREATE TABLE typing_indicators (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        conversation_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create indexes for better performance
    console.log("🔍 Creating indexes...");
    await sql`CREATE INDEX idx_users_email ON users(email)`;
    await sql`CREATE INDEX idx_users_username ON users(username)`;
    await sql`CREATE INDEX idx_sessions_token ON sessions(token)`;
    await sql`CREATE INDEX idx_pitches_user_id ON pitches(user_id)`;
    await sql`CREATE INDEX idx_pitches_status ON pitches(status)`;
    await sql`CREATE INDEX idx_ndas_pitch_user ON ndas(pitch_id, user_id)`;
    await sql`CREATE INDEX idx_messages_recipient ON messages(recipient_id)`;
    await sql`CREATE INDEX idx_follows_following ON follows(following_id)`;

    console.log("✅ Database schema created successfully!");

    // Insert demo users
    console.log("👥 Creating demo users...");
    
    const demoUsers = [
      {
        email: "alex.creator@demo.com",
        username: "alexcreator",
        password: "Demo123",
        userType: "creator",
        firstName: "Alex",
        lastName: "Filmmaker",
        companyName: "Independent Films"
      },
      {
        email: "sarah.investor@demo.com",
        username: "sarahinvestor",
        password: "Demo123",
        userType: "investor",
        firstName: "Sarah",
        lastName: "Investor",
        companyName: "Venture Capital Films"
      },
      {
        email: "stellar.production@demo.com",
        username: "stellarproduction",
        password: "Demo123",
        userType: "production",
        firstName: "Stellar",
        lastName: "Productions",
        companyName: "Stellar Production Studios"
      }
    ];

    for (const user of demoUsers) {
      const hashedPassword = await bcrypt.hash(user.password);
      
      await sql`
        INSERT INTO users (
          email, username, password_hash, user_type, 
          first_name, last_name, company_name, email_verified
        ) VALUES (
          ${user.email}, ${user.username}, ${hashedPassword}, 
          ${user.userType}, ${user.firstName}, ${user.lastName}, 
          ${user.companyName}, true
        )
        ON CONFLICT (email) DO NOTHING
      `;
      console.log(`✅ Created demo user: ${user.email}`);
    }

    // Insert sample pitches
    console.log("🎬 Creating sample pitches...");
    
    // Get creator user ID
    const [creator] = await sql`SELECT id FROM users WHERE email = 'alex.creator@demo.com'`;
    
    if (creator) {
      const samplePitches = [
        {
          title: "Quantum Hearts",
          logline: "A quantum physicist falls in love across parallel dimensions",
          genre: "Sci-Fi Romance",
          format: "Feature Film",
          shortSynopsis: "When Dr. Sarah Chen discovers she can communicate with alternate versions of herself, she finds that in every universe, she's in love with the same person - someone she's never met in her own reality."
        },
        {
          title: "The Last Comedian",
          logline: "In a world where humor is illegal, one comedian fights back",
          genre: "Dystopian Comedy",
          format: "TV Series",
          shortSynopsis: "After the Global Happiness Regulation Act bans all forms of comedy, underground comedian Marcus Wells leads a resistance movement armed with punchlines and pratfalls."
        },
        {
          title: "Echo Valley",
          logline: "A small town's dark secrets echo through generations",
          genre: "Mystery Thriller",
          format: "Limited Series",
          shortSynopsis: "When a podcaster returns to her hometown to investigate a 30-year-old disappearance, she uncovers a conspiracy that connects every family in Echo Valley."
        }
      ];

      for (const pitch of samplePitches) {
        await sql`
          INSERT INTO pitches (
            user_id, title, logline, genre, format, short_synopsis,
            long_synopsis, visibility, status
          ) VALUES (
            ${creator.id}, ${pitch.title}, ${pitch.logline}, 
            ${pitch.genre}, ${pitch.format}, ${pitch.shortSynopsis},
            ${pitch.shortSynopsis}, 'public', 'active'
          )
        `;
        console.log(`✅ Created sample pitch: ${pitch.title}`);
      }
    }

    console.log("🎉 Production database initialization complete!");

  } catch (error) {
    console.error("❌ Error initializing database:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run the initialization
await initDatabase();