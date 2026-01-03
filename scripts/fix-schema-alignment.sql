-- Fix Schema Alignment Issues between Frontend/API/Database
-- This script creates missing tables and columns

-- ========================================
-- 1. CREATE MISSING VIEWS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS views (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, pitch_id)
);

-- Create indexes for views table
CREATE INDEX IF NOT EXISTS idx_views_pitch_id ON views(pitch_id);
CREATE INDEX IF NOT EXISTS idx_views_user_id ON views(user_id);
CREATE INDEX IF NOT EXISTS idx_views_created_at ON views(created_at DESC);

-- ========================================
-- 2. FIX FOLLOWS TABLE STRUCTURE
-- ========================================
-- The follows table currently has pitch_id/creator_id but needs following_id for user-to-user follows
-- We need to support both pitch follows and user follows

-- Add missing columns if they don't exist
ALTER TABLE follows 
ADD COLUMN IF NOT EXISTS following_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE follows 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Copy followed_at to created_at where needed
UPDATE follows 
SET created_at = followed_at 
WHERE created_at IS NULL AND followed_at IS NOT NULL;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_created_at ON follows(created_at DESC);

-- ========================================
-- 3. ADD MISSING COLUMNS TO PITCHES TABLE
-- ========================================
ALTER TABLE pitches 
ADD COLUMN IF NOT EXISTS synopsis TEXT;

ALTER TABLE pitches 
ADD COLUMN IF NOT EXISTS creator_id INTEGER REFERENCES users(id);

-- Copy user_id to creator_id if needed
UPDATE pitches 
SET creator_id = user_id 
WHERE creator_id IS NULL AND user_id IS NOT NULL;

-- ========================================
-- 4. ADD MISSING COLUMNS TO USERS TABLE
-- ========================================
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Generate name from first_name and last_name if they exist
UPDATE users 
SET name = CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))
WHERE name IS NULL 
  AND (first_name IS NOT NULL OR last_name IS NOT NULL);

-- ========================================
-- 5. CREATE SAVED_PITCHES TABLE IF MISSING
-- ========================================
CREATE TABLE IF NOT EXISTS saved_pitches (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
    saved_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, pitch_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_pitches_user_id ON saved_pitches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_pitches_pitch_id ON saved_pitches(pitch_id);

-- ========================================
-- 6. CREATE RBAC TABLES IF MISSING
-- ========================================
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    resource VARCHAR(50),
    action VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

-- ========================================
-- 7. CREATE ANALYTICS VIEWS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS pitch_views (
    id SERIAL PRIMARY KEY,
    pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
    viewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    viewed_at TIMESTAMP DEFAULT NOW(),
    duration_seconds INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pitch_views_pitch_id ON pitch_views(pitch_id);
CREATE INDEX IF NOT EXISTS idx_pitch_views_viewer_id ON pitch_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_pitch_views_viewed_at ON pitch_views(viewed_at DESC);

-- ========================================
-- 8. CREATE MESSAGES TABLE FOR CHAT
-- ========================================
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_pitch_id ON messages(pitch_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- ========================================
-- 9. FIX NOTIFICATIONS TABLE
-- ========================================
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- ========================================
-- 10. CREATE TEAMS TABLE FOR COLLABORATION
-- ========================================
CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

-- ========================================
-- 11. SEED DEMO DATA FOR VIEWS
-- ========================================
-- Add some demo views to test with
INSERT INTO views (user_id, pitch_id, viewed_at)
SELECT 
    u.id as user_id,
    p.id as pitch_id,
    NOW() - INTERVAL '1 day' * FLOOR(RANDOM() * 30) as viewed_at
FROM users u
CROSS JOIN pitches p
WHERE p.status = 'published'
LIMIT 100
ON CONFLICT (user_id, pitch_id) DO NOTHING;

-- ========================================
-- 12. UPDATE STATISTICS
-- ========================================
ANALYZE views;
ANALYZE follows;
ANALYZE pitches;
ANALYZE users;
ANALYZE saved_pitches;
ANALYZE notifications;
ANALYZE messages;
ANALYZE teams;
ANALYZE team_members;