-- Database Performance Optimizations for Pitchey Platform
-- Run with: psql $DATABASE_URL < apply-db-optimizations-fixed.sql

-- ========================================
-- 1. CRITICAL INDEXES FOR HIGH-TRAFFIC QUERIES
-- ========================================

-- Pitches browsing and search (most frequent query)
CREATE INDEX IF NOT EXISTS idx_pitches_browse 
ON pitches(status, created_at DESC) 
WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_pitches_genre_status 
ON pitches(genre, status, created_at DESC) 
WHERE status = 'published';

-- Full text search on pitches
CREATE INDEX IF NOT EXISTS idx_pitches_search 
ON pitches USING gin(to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(logline, '') || ' ' || COALESCE(synopsis, '')));

-- Views tracking (for trending calculation)
CREATE INDEX IF NOT EXISTS idx_views_pitch_created 
ON views(pitch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_views_user_pitch 
ON views(user_id, pitch_id);

-- Investments tracking
CREATE INDEX IF NOT EXISTS idx_investments_pitch 
ON investments(pitch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_investments_investor 
ON investments(investor_id, created_at DESC);

-- NDAs for access control
CREATE INDEX IF NOT EXISTS idx_ndas_user_pitch_status 
ON ndas(user_id, pitch_id, status);

CREATE INDEX IF NOT EXISTS idx_ndas_pitch_approved 
ON ndas(pitch_id, status) 
WHERE status = 'approved';

-- Follows for social features
CREATE INDEX IF NOT EXISTS idx_follows_follower 
ON follows(follower_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_follows_following 
ON follows(following_id, created_at DESC);

-- ========================================
-- 2. COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ========================================

-- Dashboard stats queries
CREATE INDEX IF NOT EXISTS idx_pitches_creator_stats 
ON pitches(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread 
ON notifications(user_id, is_read, created_at DESC) 
WHERE is_read = false;

-- Session management
CREATE INDEX IF NOT EXISTS idx_sessions_user_active 
ON sessions(user_id, expires_at) 
WHERE expires_at > NOW();

-- ========================================
-- 3. PARTIAL INDEXES FOR SPECIFIC QUERIES
-- ========================================

-- Active users only
CREATE INDEX IF NOT EXISTS idx_users_active 
ON users(email, id) 
WHERE deleted_at IS NULL;

-- Published pitches with budget range
CREATE INDEX IF NOT EXISTS idx_pitches_budget_published 
ON pitches(budget_range, created_at DESC) 
WHERE status = 'published' AND budget_range IS NOT NULL;

-- ========================================
-- 4. UPDATE TABLE STATISTICS
-- ========================================

-- Update table statistics for query planner
ANALYZE pitches;
ANALYZE users;
ANALYZE views;
ANALYZE investments;
ANALYZE ndas;
ANALYZE follows;
ANALYZE notifications;
ANALYZE sessions;