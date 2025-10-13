-- Initialize minimal database schema for Pitchey
-- Create basic tables needed for pitch display

-- Users table
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
);

-- Pitches table
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
);

-- Insert demo users
INSERT INTO users (id, email, username, password, user_type, company_name) VALUES
(1001, 'alex.creator@demo.com', 'alexcreator', '$2b$10$example', 'creator', 'Independent Films'),
(1002, 'sarah.investor@demo.com', 'sarahinvestor', '$2b$10$example', 'investor', 'Johnson Ventures'),
(1003, 'stellar.production@demo.com', 'stellarproduction', '$2b$10$example', 'production', 'Stellar Productions')
ON CONFLICT (id) DO NOTHING;

-- Insert demo pitches
INSERT INTO pitches (user_id, title, logline, genre, format, status, view_count, like_count, published_at) VALUES
(1001, 'The Last Echo', 'In a world where memories can be extracted and sold, a memory thief discovers her own forgotten past.', 'scifi', 'feature', 'published', 25, 8, NOW() - INTERVAL '2 days'),
(1003, 'Midnight Kitchen', 'A late-night diner becomes the epicenter of supernatural encounters in this anthology series.', 'horror', 'tv', 'published', 42, 15, NOW() - INTERVAL '1 day'),
(1002, 'Green Dreams', 'A documentary following three families as they transition to sustainable living in urban environments.', 'documentary', 'feature', 'published', 18, 5, NOW() - INTERVAL '3 days'),
(1001, 'Code of Honor', 'When a veteran programmer discovers a conspiracy within her tech company, she must choose between loyalty and justice.', 'thriller', 'feature', 'published', 33, 12, NOW() - INTERVAL '4 days'),
(1003, 'The Canvas', 'An art forger\'s life spirals out of control when she\'s commissioned to recreate a painting that doesn\'t exist.', 'drama', 'feature', 'published', 67, 22, NOW() - INTERVAL '5 days')
ON CONFLICT DO NOTHING;