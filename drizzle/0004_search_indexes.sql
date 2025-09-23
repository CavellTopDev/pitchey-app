-- Add search-optimized indexes for better performance

-- Enable PostgreSQL extensions for full-text search and similarity
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_pitches_title_fulltext ON pitches USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_pitches_logline_fulltext ON pitches USING gin(to_tsvector('english', logline));
CREATE INDEX IF NOT EXISTS idx_pitches_synopsis_fulltext ON pitches USING gin(to_tsvector('english', COALESCE(short_synopsis, '') || ' ' || COALESCE(long_synopsis, '')));

-- Trigram indexes for fuzzy matching
CREATE INDEX IF NOT EXISTS idx_pitches_title_trigram ON pitches USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pitches_logline_trigram ON pitches USING gin(logline gin_trgm_ops);

-- Combined search index for common search patterns
CREATE INDEX IF NOT EXISTS idx_pitches_search_combined ON pitches USING gin(
  (setweight(to_tsvector('english', title), 'A') ||
   setweight(to_tsvector('english', logline), 'B') ||
   setweight(to_tsvector('english', COALESCE(short_synopsis, '')), 'C'))
);

-- Composite indexes for filtered searches
CREATE INDEX IF NOT EXISTS idx_pitches_status_genre_format ON pitches (status, genre, format);
CREATE INDEX IF NOT EXISTS idx_pitches_status_published_views ON pitches (status, published_at DESC, view_count DESC);
CREATE INDEX IF NOT EXISTS idx_pitches_status_budget ON pitches (status, estimated_budget) WHERE estimated_budget IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pitches_status_created ON pitches (status, created_at DESC);

-- Indexes for media filtering
CREATE INDEX IF NOT EXISTS idx_pitches_has_lookbook ON pitches (status) WHERE lookbook_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pitches_has_script ON pitches (status) WHERE script_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pitches_has_trailer ON pitches (status) WHERE trailer_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pitches_has_pitch_deck ON pitches (status) WHERE pitch_deck_url IS NOT NULL;

-- Engagement metrics indexes
CREATE INDEX IF NOT EXISTS idx_pitches_view_count_desc ON pitches (view_count DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_pitches_like_count_desc ON pitches (like_count DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_pitches_nda_count_desc ON pitches (nda_count DESC) WHERE status = 'published';

-- User-related search indexes
CREATE INDEX IF NOT EXISTS idx_users_username_search ON users USING gin(username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_company_search ON users USING gin(company_name gin_trgm_ops) WHERE company_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_location_search ON users USING gin(location gin_trgm_ops) WHERE location IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_type_verified ON users (user_type, company_verified);

-- Analytics search indexes
CREATE INDEX IF NOT EXISTS idx_analytics_search_events ON analytics_events (event_type, timestamp DESC) WHERE event_type = 'search';
CREATE INDEX IF NOT EXISTS idx_analytics_search_query ON analytics_events USING gin((event_data->>'query') gin_trgm_ops) WHERE event_type = 'search';
CREATE INDEX IF NOT EXISTS idx_analytics_search_user_time ON analytics_events (user_id, timestamp DESC) WHERE event_type = 'search';

-- NDA and follow relationship indexes for search enrichment
CREATE INDEX IF NOT EXISTS idx_ndas_signer_pitch_active ON ndas (signer_id, pitch_id) WHERE access_granted = true;
CREATE INDEX IF NOT EXISTS idx_follows_follower_pitch ON follows (follower_id, pitch_id) WHERE pitch_id IS NOT NULL;

-- Covering indexes for common search result queries
CREATE INDEX IF NOT EXISTS idx_pitches_search_result_data ON pitches (
  id, title, logline, genre, format, status, view_count, like_count, nda_count, 
  published_at, created_at, estimated_budget, title_image
) WHERE status = 'published';

-- Partial indexes for specific search scenarios
CREATE INDEX IF NOT EXISTS idx_pitches_recent_published ON pitches (published_at DESC) 
WHERE status = 'published' AND published_at > (NOW() - INTERVAL '30 days');

CREATE INDEX IF NOT EXISTS idx_pitches_high_engagement ON pitches (view_count DESC, like_count DESC) 
WHERE status = 'published' AND (view_count > 100 OR like_count > 10);

-- Expression indexes for computed fields
CREATE INDEX IF NOT EXISTS idx_pitches_budget_range ON pitches (
  CASE 
    WHEN estimated_budget < 100000 THEN 1
    WHEN estimated_budget < 1000000 THEN 2
    WHEN estimated_budget < 10000000 THEN 3
    WHEN estimated_budget < 50000000 THEN 4
    ELSE 5
  END
) WHERE status = 'published' AND estimated_budget IS NOT NULL;

-- Add constraint to ensure similarity extension works
ALTER TABLE pitches ADD CONSTRAINT pitches_title_not_empty CHECK (length(trim(title)) > 0);
ALTER TABLE pitches ADD CONSTRAINT pitches_logline_not_empty CHECK (length(trim(logline)) > 0);

-- Create function for search relevance scoring
CREATE OR REPLACE FUNCTION calculate_search_relevance(
  search_query text,
  pitch_title text,
  pitch_logline text,
  pitch_synopsis text,
  pitch_genre text,
  pitch_format text,
  pitch_views integer,
  pitch_likes integer,
  pitch_ndas integer
) RETURNS decimal AS $$
BEGIN
  RETURN (
    -- Exact title match gets highest score
    CASE WHEN LOWER(pitch_title) = LOWER(search_query) THEN 100
         WHEN LOWER(pitch_title) LIKE '%' || LOWER(search_query) || '%' THEN 80
         ELSE 0 
    END +
    
    -- Logline match
    CASE WHEN LOWER(pitch_logline) LIKE '%' || LOWER(search_query) || '%' THEN 60
         ELSE 0 
    END +
    
    -- Synopsis match
    CASE WHEN LOWER(COALESCE(pitch_synopsis, '')) LIKE '%' || LOWER(search_query) || '%' THEN 30
         ELSE 0 
    END +
    
    -- Genre/format exact match
    CASE WHEN LOWER(pitch_genre) = LOWER(search_query) THEN 40
         WHEN LOWER(pitch_format) = LOWER(search_query) THEN 35
         ELSE 0 
    END +
    
    -- Fuzzy title similarity
    similarity(LOWER(pitch_title), LOWER(search_query)) * 50 +
    
    -- Fuzzy logline similarity  
    similarity(LOWER(pitch_logline), LOWER(search_query)) * 25 +
    
    -- Engagement boost
    LEAST(pitch_views * 0.01, 10) +
    LEAST(pitch_likes * 0.05, 15) +
    LEAST(pitch_ndas * 0.1, 20)
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create materialized view for search performance (updated periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_search_data AS
SELECT 
  p.id,
  p.title,
  p.logline,
  p.short_synopsis,
  p.long_synopsis,
  p.genre,
  p.format,
  p.status,
  p.view_count,
  p.like_count,
  p.nda_count,
  p.published_at,
  p.created_at,
  p.estimated_budget,
  p.title_image,
  p.lookbook_url IS NOT NULL as has_lookbook,
  p.script_url IS NOT NULL as has_script,
  p.trailer_url IS NOT NULL as has_trailer,
  p.pitch_deck_url IS NOT NULL as has_pitch_deck,
  u.id as creator_id,
  u.username as creator_username,
  u.user_type as creator_type,
  u.company_name as creator_company,
  u.company_verified as creator_verified,
  u.location as creator_location,
  to_tsvector('english', p.title || ' ' || p.logline || ' ' || COALESCE(p.short_synopsis, '')) as search_vector
FROM pitches p
INNER JOIN users u ON p.user_id = u.id
WHERE p.status = 'published';

-- Index the materialized view
CREATE INDEX IF NOT EXISTS idx_mv_search_data_vector ON mv_search_data USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_mv_search_data_genre ON mv_search_data (genre);
CREATE INDEX IF NOT EXISTS idx_mv_search_data_format ON mv_search_data (format);
CREATE INDEX IF NOT EXISTS idx_mv_search_data_published ON mv_search_data (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_mv_search_data_views ON mv_search_data (view_count DESC);

-- Create function to refresh search materialized view
CREATE OR REPLACE FUNCTION refresh_search_data() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_search_data;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to refresh search data when pitches are updated
CREATE OR REPLACE FUNCTION trigger_refresh_search_data() RETURNS trigger AS $$
BEGIN
  -- Only refresh if published status or key search fields changed
  IF (TG_OP = 'UPDATE' AND (
    OLD.status != NEW.status OR 
    OLD.title != NEW.title OR 
    OLD.logline != NEW.logline OR 
    OLD.short_synopsis != NEW.short_synopsis OR
    OLD.genre != NEW.genre OR
    OLD.format != NEW.format
  )) OR TG_OP = 'INSERT' THEN
    -- Use pg_notify to trigger async refresh
    PERFORM pg_notify('refresh_search_data', '');
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_search_data_refresh ON pitches;
CREATE TRIGGER trigger_search_data_refresh
  AFTER INSERT OR UPDATE ON pitches
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_search_data();

-- Add comments for documentation
COMMENT ON INDEX idx_pitches_title_fulltext IS 'Full-text search index for pitch titles';
COMMENT ON INDEX idx_pitches_search_combined IS 'Combined weighted full-text search index';
COMMENT ON INDEX idx_pitches_title_trigram IS 'Trigram index for fuzzy title matching';
COMMENT ON MATERIALIZED VIEW mv_search_data IS 'Materialized view for optimized search queries';
COMMENT ON FUNCTION calculate_search_relevance IS 'Function to calculate search relevance scores';