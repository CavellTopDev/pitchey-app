-- Database Performance Optimizations for Pitchey Platform
-- Run with: psql $DATABASE_URL < apply-db-optimizations.sql

BEGIN;

-- ========================================
-- 1. CRITICAL INDEXES FOR HIGH-TRAFFIC QUERIES
-- ========================================

-- Pitches browsing and search (most frequent query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_browse 
ON pitches(status, created_at DESC) 
WHERE status = 'published';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_genre_status 
ON pitches(genre, status, created_at DESC) 
WHERE status = 'published';

-- Full text search on pitches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_search 
ON pitches USING gin(to_tsvector('english', title || ' ' || logline || ' ' || synopsis));

-- Views tracking (for trending calculation)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_views_pitch_created 
ON views(pitch_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_views_user_pitch 
ON views(user_id, pitch_id);

-- Investments tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_investments_pitch 
ON investments(pitch_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_investments_investor 
ON investments(investor_id, created_at DESC);

-- NDAs for access control
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ndas_user_pitch_status 
ON ndas(user_id, pitch_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ndas_pitch_approved 
ON ndas(pitch_id, status) 
WHERE status = 'approved';

-- Follows for social features
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_follower 
ON follows(follower_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_following 
ON follows(following_id, created_at DESC);

-- ========================================
-- 2. COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ========================================

-- Dashboard stats queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_creator_stats 
ON pitches(user_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread 
ON notifications(user_id, is_read, created_at DESC) 
WHERE is_read = false;

-- Session management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_active 
ON sessions(user_id, expires_at) 
WHERE expires_at > NOW();

-- ========================================
-- 3. PARTIAL INDEXES FOR SPECIFIC QUERIES
-- ========================================

-- Active users only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active 
ON users(email, id) 
WHERE deleted_at IS NULL;

-- Published pitches with budget range
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_budget_published 
ON pitches(budget_range, created_at DESC) 
WHERE status = 'published' AND budget_range IS NOT NULL;

-- ========================================
-- 4. MATERIALIZED VIEWS FOR EXPENSIVE AGGREGATIONS
-- ========================================

-- Trending pitches (refresh every hour)
CREATE MATERIALIZED VIEW IF NOT EXISTS trending_pitches AS
SELECT 
  p.id,
  p.title,
  p.genre,
  p.logline,
  p.thumbnail_url,
  p.user_id,
  p.created_at,
  COUNT(DISTINCT v.id) as view_count_7d,
  COUNT(DISTINCT i.id) as investment_count_7d,
  COUNT(DISTINCT n.id) as nda_count_7d,
  (COUNT(DISTINCT v.id) * 1.0 + 
   COUNT(DISTINCT i.id) * 5.0 + 
   COUNT(DISTINCT n.id) * 3.0) as trending_score
FROM pitches p
LEFT JOIN views v ON v.pitch_id = p.id 
  AND v.created_at > NOW() - INTERVAL '7 days'
LEFT JOIN investments i ON i.pitch_id = p.id 
  AND i.created_at > NOW() - INTERVAL '7 days'
LEFT JOIN ndas n ON n.pitch_id = p.id 
  AND n.created_at > NOW() - INTERVAL '7 days'
WHERE p.status = 'published'
  AND p.created_at > NOW() - INTERVAL '30 days'
GROUP BY p.id
ORDER BY trending_score DESC
LIMIT 100;

CREATE UNIQUE INDEX ON trending_pitches(id);
CREATE INDEX ON trending_pitches(trending_score DESC);

-- Dashboard statistics (refresh every 15 minutes)
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_stats AS
SELECT 
  u.id as user_id,
  u.user_type,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'published') as published_pitches,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'draft') as draft_pitches,
  COUNT(DISTINCT v.id) as total_views,
  COUNT(DISTINCT i.id) as total_investments,
  COUNT(DISTINCT n.id) FILTER (WHERE n.status = 'approved') as approved_ndas,
  COUNT(DISTINCT f1.id) as followers_count,
  COUNT(DISTINCT f2.id) as following_count
FROM users u
LEFT JOIN pitches p ON p.user_id = u.id
LEFT JOIN views v ON v.pitch_id IN (SELECT id FROM pitches WHERE user_id = u.id)
LEFT JOIN investments i ON i.investor_id = u.id OR i.pitch_id IN (SELECT id FROM pitches WHERE user_id = u.id)
LEFT JOIN ndas n ON n.user_id = u.id OR n.pitch_id IN (SELECT id FROM pitches WHERE user_id = u.id)
LEFT JOIN follows f1 ON f1.following_id = u.id
LEFT JOIN follows f2 ON f2.follower_id = u.id
WHERE u.deleted_at IS NULL
GROUP BY u.id;

CREATE UNIQUE INDEX ON dashboard_stats(user_id);

-- ========================================
-- 5. QUERY OPTIMIZATION FUNCTIONS
-- ========================================

-- Function to get pitch with all related data (cached)
CREATE OR REPLACE FUNCTION get_pitch_details(pitch_id INTEGER)
RETURNS TABLE(
  pitch JSON,
  creator JSON,
  stats JSON,
  recent_views JSON
) AS $$
BEGIN
  RETURN QUERY
  WITH pitch_data AS (
    SELECT row_to_json(p.*) as pitch_json
    FROM pitches p
    WHERE p.id = pitch_id
  ),
  creator_data AS (
    SELECT row_to_json((
      SELECT x FROM (
        SELECT u.id, u.name, u.email, u.user_type, u.profile_image
      ) x
    )) as creator_json
    FROM users u
    JOIN pitches p ON p.user_id = u.id
    WHERE p.id = pitch_id
  ),
  stats_data AS (
    SELECT json_build_object(
      'views', COUNT(DISTINCT v.id),
      'investments', COUNT(DISTINCT i.id),
      'ndas', COUNT(DISTINCT n.id),
      'saves', COUNT(DISTINCT s.id)
    ) as stats_json
    FROM pitches p
    LEFT JOIN views v ON v.pitch_id = p.id
    LEFT JOIN investments i ON i.pitch_id = p.id
    LEFT JOIN ndas n ON n.pitch_id = p.id
    LEFT JOIN saved_pitches s ON s.pitch_id = p.id
    WHERE p.id = pitch_id
  ),
  recent_views_data AS (
    SELECT json_agg(
      json_build_object(
        'user_id', v.user_id,
        'viewed_at', v.created_at
      ) ORDER BY v.created_at DESC
    ) as views_json
    FROM (
      SELECT user_id, created_at
      FROM views
      WHERE pitch_id = pitch_id
      ORDER BY created_at DESC
      LIMIT 10
    ) v
  )
  SELECT 
    pd.pitch_json,
    cd.creator_json,
    sd.stats_json,
    COALESCE(rv.views_json, '[]'::json)
  FROM pitch_data pd
  CROSS JOIN creator_data cd
  CROSS JOIN stats_data sd
  CROSS JOIN recent_views_data rv;
END;
$$ LANGUAGE plpgsql STABLE;

-- ========================================
-- 6. VACUUM AND ANALYZE
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

-- ========================================
-- 7. CONNECTION POOLING SETTINGS
-- ========================================

-- Optimize for Neon's connection pooler
-- These are recommendations - apply via Neon dashboard
-- Pool Mode: Transaction
-- Pool Size: 25
-- Max Client Connections: 100

COMMIT;

-- ========================================
-- 8. SCHEDULED MAINTENANCE TASKS
-- ========================================

-- Create refresh functions for materialized views
CREATE OR REPLACE FUNCTION refresh_trending_pitches()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY trending_pitches;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats;
END;
$$ LANGUAGE plpgsql;

-- Note: Schedule these via cron jobs or Cloudflare Workers scheduled triggers:
-- refresh_trending_pitches() - every hour
-- refresh_dashboard_stats() - every 15 minutes