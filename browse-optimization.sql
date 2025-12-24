-- Browse Tabs Performance Optimization
-- Run this SQL to ensure optimal performance for browse functionality

-- 1. Ensure required columns exist on pitches table
ALTER TABLE pitches 
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS investment_count INTEGER DEFAULT 0;

-- 2. Create composite indexes for optimal browse performance

-- Index for trending tab: Last 7 days with view_count > 10
CREATE INDEX IF NOT EXISTS idx_pitches_trending 
ON pitches(status, created_at, view_count) 
WHERE status = 'published' AND view_count > 10;

-- Index for new tab: Last 30 days, sorted by creation date
CREATE INDEX IF NOT EXISTS idx_pitches_new 
ON pitches(status, created_at) 
WHERE status = 'published';

-- Index for popular tab by views: view_count > 50
CREATE INDEX IF NOT EXISTS idx_pitches_popular_views 
ON pitches(status, view_count, created_at) 
WHERE status = 'published' AND view_count > 50;

-- Index for popular tab by likes: like_count > 20
CREATE INDEX IF NOT EXISTS idx_pitches_popular_likes 
ON pitches(status, like_count, created_at) 
WHERE status = 'published' AND like_count > 20;

-- General index for published pitches
CREATE INDEX IF NOT EXISTS idx_pitches_published_created 
ON pitches(status, created_at) 
WHERE status = 'published';

-- 3. Function to update pitch statistics in real-time
CREATE OR REPLACE FUNCTION update_pitch_stats_realtime()
RETURNS TRIGGER AS $$
BEGIN
    -- For analytics_events table
    IF TG_TABLE_NAME = 'analytics_events' THEN
        IF NEW.event_type = 'view' THEN
            UPDATE pitches SET view_count = (
                SELECT COUNT(*) FROM analytics_events 
                WHERE pitch_id = NEW.pitch_id AND event_type = 'view'
            ) WHERE id = NEW.pitch_id;
        END IF;
        RETURN NEW;
    END IF;
    
    -- For pitch_likes table
    IF TG_TABLE_NAME = 'pitch_likes' THEN
        UPDATE pitches SET like_count = (
            SELECT COUNT(*) FROM pitch_likes 
            WHERE pitch_id = COALESCE(NEW.pitch_id, OLD.pitch_id)
        ) WHERE id = COALESCE(NEW.pitch_id, OLD.pitch_id);
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- For investments table
    IF TG_TABLE_NAME = 'investments' THEN
        UPDATE pitches SET 
            investment_count = (
                SELECT COUNT(*) FROM investments 
                WHERE pitch_id = COALESCE(NEW.pitch_id, OLD.pitch_id) 
                AND status = 'active'
            )
        WHERE id = COALESCE(NEW.pitch_id, OLD.pitch_id);
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 4. Create triggers to keep stats updated in real-time

-- Trigger for view count updates
DROP TRIGGER IF EXISTS trigger_update_view_stats ON analytics_events;
CREATE TRIGGER trigger_update_view_stats
    AFTER INSERT ON analytics_events
    FOR EACH ROW
    WHEN (NEW.event_type = 'view')
    EXECUTE FUNCTION update_pitch_stats_realtime();

-- Trigger for like count updates
DROP TRIGGER IF EXISTS trigger_update_like_stats_insert ON pitch_likes;
CREATE TRIGGER trigger_update_like_stats_insert
    AFTER INSERT ON pitch_likes
    FOR EACH ROW
    EXECUTE FUNCTION update_pitch_stats_realtime();

DROP TRIGGER IF EXISTS trigger_update_like_stats_delete ON pitch_likes;
CREATE TRIGGER trigger_update_like_stats_delete
    AFTER DELETE ON pitch_likes
    FOR EACH ROW
    EXECUTE FUNCTION update_pitch_stats_realtime();

-- Trigger for investment count updates
DROP TRIGGER IF EXISTS trigger_update_investment_stats_insert ON investments;
CREATE TRIGGER trigger_update_investment_stats_insert
    AFTER INSERT ON investments
    FOR EACH ROW
    EXECUTE FUNCTION update_pitch_stats_realtime();

DROP TRIGGER IF EXISTS trigger_update_investment_stats_update ON investments;
CREATE TRIGGER trigger_update_investment_stats_update
    AFTER UPDATE ON investments
    FOR EACH ROW
    EXECUTE FUNCTION update_pitch_stats_realtime();

DROP TRIGGER IF EXISTS trigger_update_investment_stats_delete ON investments;
CREATE TRIGGER trigger_update_investment_stats_delete
    AFTER DELETE ON investments
    FOR EACH ROW
    EXECUTE FUNCTION update_pitch_stats_realtime();

-- 5. One-time update to populate existing stats
-- This should be run once to populate the stats for existing pitches

-- Update view counts from analytics_events
UPDATE pitches SET view_count = COALESCE((
    SELECT COUNT(*) 
    FROM analytics_events 
    WHERE pitch_id = pitches.id AND event_type = 'view'
), 0);

-- Update like counts from pitch_likes
UPDATE pitches SET like_count = COALESCE((
    SELECT COUNT(*) 
    FROM pitch_likes 
    WHERE pitch_id = pitches.id
), 0);

-- Update investment counts from investments
UPDATE pitches SET investment_count = COALESCE((
    SELECT COUNT(*) 
    FROM investments 
    WHERE pitch_id = pitches.id AND status = 'active'
), 0);

-- 6. Create a materialized view for browse performance (optional)
-- This can be refreshed periodically for even better performance

DROP MATERIALIZED VIEW IF EXISTS mv_browse_pitches;
CREATE MATERIALIZED VIEW mv_browse_pitches AS
SELECT 
    p.*,
    u.name as creator_name,
    COALESCE(p.view_count, 0) as view_count,
    COALESCE(p.like_count, 0) as like_count,
    COALESCE(p.investment_count, 0) as investment_count,
    CASE 
        WHEN p.created_at >= NOW() - INTERVAL '7 days' AND p.view_count > 10 
        THEN 'trending'
        ELSE NULL
    END as is_trending,
    CASE 
        WHEN p.created_at >= NOW() - INTERVAL '30 days' 
        THEN 'new'
        ELSE NULL
    END as is_new,
    CASE 
        WHEN p.view_count > 50 OR p.like_count > 20 
        THEN 'popular'
        ELSE NULL
    END as is_popular
FROM pitches p
LEFT JOIN users u ON p.creator_id = u.id
WHERE p.status = 'published';

-- Create indexes on the materialized view
CREATE INDEX idx_mv_browse_trending ON mv_browse_pitches(is_trending, view_count DESC, created_at DESC) WHERE is_trending IS NOT NULL;
CREATE INDEX idx_mv_browse_new ON mv_browse_pitches(is_new, created_at DESC) WHERE is_new IS NOT NULL;
CREATE INDEX idx_mv_browse_popular ON mv_browse_pitches(is_popular, view_count DESC, like_count DESC) WHERE is_popular IS NOT NULL;

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_browse_cache()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_browse_pitches;
END;
$$ LANGUAGE plpgsql;

-- 7. Verify the optimization by running test queries
-- These can be used to test that the indexes are working correctly

-- Test trending query
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM pitches p 
LEFT JOIN users u ON p.creator_id = u.id
WHERE p.status = 'published' 
  AND p.created_at >= NOW() - INTERVAL '7 days'
  AND COALESCE(p.view_count, 0) > 10
ORDER BY p.view_count DESC, p.created_at DESC
LIMIT 20;

-- Test new query
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM pitches p 
LEFT JOIN users u ON p.creator_id = u.id
WHERE p.status = 'published'
  AND p.created_at >= NOW() - INTERVAL '30 days'
ORDER BY p.created_at DESC
LIMIT 20;

-- Test popular query
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM pitches p 
LEFT JOIN users u ON p.creator_id = u.id
WHERE p.status = 'published'
  AND (COALESCE(p.view_count, 0) > 50 OR COALESCE(p.like_count, 0) > 20)
ORDER BY p.view_count DESC, p.like_count DESC, p.created_at DESC
LIMIT 20;