-- Advanced Search System Migration
-- Creates indexes, tables, and functions for sophisticated search capabilities

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- =============================================
-- SEARCH PERFORMANCE INDEXES
-- =============================================

-- Full-text search indexes with GIN
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_title_fulltext 
ON pitches USING GIN (to_tsvector('english', title));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_logline_fulltext 
ON pitches USING GIN (to_tsvector('english', logline));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_synopsis_fulltext 
ON pitches USING GIN (to_tsvector('english', coalesce(short_synopsis, '') || ' ' || coalesce(long_synopsis, '')));

-- Trigram indexes for fuzzy matching
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_title_trgm 
ON pitches USING GIN (title gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_logline_trgm 
ON pitches USING GIN (logline gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_genre_trgm 
ON pitches USING GIN (genre gin_trgm_ops);

-- Combined text search index for relevance scoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_combined_search 
ON pitches USING GIN (
    to_tsvector('english', 
        coalesce(title, '') || ' ' || 
        coalesce(logline, '') || ' ' || 
        coalesce(short_synopsis, '') || ' ' ||
        coalesce(genre, '') || ' ' ||
        coalesce(format, '')
    )
);

-- Filter-specific indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_search_filters 
ON pitches (status, published_at, view_count, like_count, nda_count) 
WHERE status = 'published';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_budget_range 
ON pitches (estimated_budget, budget_bracket) 
WHERE status = 'published' AND estimated_budget IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_media_flags 
ON pitches (status, lookbook_url, script_url, trailer_url, pitch_deck_url)
WHERE status = 'published';

-- User search indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_search_text 
ON users USING GIN (to_tsvector('english', 
    coalesce(username, '') || ' ' || 
    coalesce(company_name, '') || ' ' ||
    coalesce(location, '')
));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username_trgm 
ON users USING GIN (username gin_trgm_ops);

-- =============================================
-- SEARCH ANALYTICS TABLES
-- =============================================

-- Enhanced search analytics
CREATE TABLE IF NOT EXISTS search_analytics (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    session_id VARCHAR(255),
    search_query TEXT NOT NULL,
    search_type VARCHAR(50) DEFAULT 'pitch', -- 'pitch', 'user', 'advanced'
    filters JSONB DEFAULT '{}',
    results_count INTEGER DEFAULT 0,
    clicked_result_id INTEGER,
    clicked_result_position INTEGER,
    time_to_click_ms INTEGER,
    search_duration_ms INTEGER,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX (user_id, created_at),
    INDEX (search_query),
    INDEX (created_at),
    INDEX USING GIN (filters)
);

-- Search suggestions cache
CREATE TABLE IF NOT EXISTS search_suggestions (
    id BIGSERIAL PRIMARY KEY,
    query_text TEXT NOT NULL UNIQUE,
    suggestion_type VARCHAR(50) NOT NULL, -- 'title', 'genre', 'creator', 'autocomplete'
    popularity_score FLOAT DEFAULT 0,
    click_through_rate FLOAT DEFAULT 0,
    last_suggested TIMESTAMP DEFAULT NOW(),
    suggestion_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    INDEX (query_text, suggestion_type),
    INDEX (popularity_score DESC),
    INDEX (last_suggested DESC)
);

-- Popular search terms tracking
CREATE TABLE IF NOT EXISTS search_trends (
    id BIGSERIAL PRIMARY KEY,
    search_term TEXT NOT NULL,
    time_bucket TIMESTAMP NOT NULL, -- Hourly buckets for trending
    search_count INTEGER DEFAULT 1,
    unique_users INTEGER DEFAULT 1,
    avg_results INTEGER DEFAULT 0,
    avg_click_position FLOAT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (search_term, time_bucket),
    INDEX (time_bucket DESC, search_count DESC),
    INDEX (search_term, time_bucket)
);

-- Saved search alerts (when new matches appear)
CREATE TABLE IF NOT EXISTS search_alerts (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    saved_search_id INTEGER NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,
    alert_frequency VARCHAR(20) DEFAULT 'daily', -- 'immediate', 'daily', 'weekly'
    last_checked TIMESTAMP DEFAULT NOW(),
    last_sent TIMESTAMP,
    new_results_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    INDEX (user_id, is_active),
    INDEX (alert_frequency, last_checked),
    INDEX (saved_search_id)
);

-- Search performance metrics
CREATE TABLE IF NOT EXISTS search_performance_metrics (
    id BIGSERIAL PRIMARY KEY,
    metric_date DATE NOT NULL,
    total_searches INTEGER DEFAULT 0,
    avg_response_time_ms FLOAT DEFAULT 0,
    avg_results_count FLOAT DEFAULT 0,
    no_results_rate FLOAT DEFAULT 0,
    click_through_rate FLOAT DEFAULT 0,
    bounce_rate FLOAT DEFAULT 0,
    top_searches JSONB DEFAULT '[]',
    slow_queries JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (metric_date),
    INDEX (metric_date DESC)
);

-- =============================================
-- SEARCH FUNCTIONS AND PROCEDURES
-- =============================================

-- Calculate search relevance score
CREATE OR REPLACE FUNCTION calculate_search_relevance(
    title_text TEXT,
    logline_text TEXT,
    synopsis_text TEXT,
    genre_text TEXT,
    format_text TEXT,
    search_query TEXT,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    nda_count INTEGER DEFAULT 0
) RETURNS FLOAT AS $$
DECLARE
    relevance_score FLOAT := 0;
    query_lower TEXT := LOWER(search_query);
    title_lower TEXT := LOWER(COALESCE(title_text, ''));
    logline_lower TEXT := LOWER(COALESCE(logline_text, ''));
BEGIN
    -- Exact title match (highest weight)
    IF title_lower = query_lower THEN
        relevance_score := relevance_score + 100;
    ELSIF title_lower LIKE '%' || query_lower || '%' THEN
        relevance_score := relevance_score + 80;
    END IF;
    
    -- Title similarity using trigrams
    relevance_score := relevance_score + (similarity(title_lower, query_lower) * 60);
    
    -- Logline matches
    IF logline_lower LIKE '%' || query_lower || '%' THEN
        relevance_score := relevance_score + 50;
    END IF;
    
    relevance_score := relevance_score + (similarity(logline_lower, query_lower) * 40);
    
    -- Synopsis matches
    IF LOWER(COALESCE(synopsis_text, '')) LIKE '%' || query_lower || '%' THEN
        relevance_score := relevance_score + 30;
    END IF;
    
    -- Genre/format matches
    IF LOWER(COALESCE(genre_text, '')) LIKE '%' || query_lower || '%' THEN
        relevance_score := relevance_score + 25;
    END IF;
    
    IF LOWER(COALESCE(format_text, '')) LIKE '%' || query_lower || '%' THEN
        relevance_score := relevance_score + 20;
    END IF;
    
    -- Full-text search boost
    IF to_tsvector('english', 
        COALESCE(title_text, '') || ' ' || 
        COALESCE(logline_text, '') || ' ' || 
        COALESCE(synopsis_text, '')
    ) @@ plainto_tsquery('english', search_query) THEN
        relevance_score := relevance_score + 35;
    END IF;
    
    -- Popularity boost (logarithmic scaling)
    relevance_score := relevance_score + (LN(GREATEST(view_count, 1)) * 0.5);
    relevance_score := relevance_score + (LN(GREATEST(like_count, 1)) * 1.0);
    relevance_score := relevance_score + (LN(GREATEST(nda_count, 1)) * 1.5);
    
    RETURN relevance_score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update search trends (called by triggers or scheduled jobs)
CREATE OR REPLACE FUNCTION update_search_trends(
    search_term TEXT,
    result_count INTEGER DEFAULT 0,
    click_position INTEGER DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    current_bucket TIMESTAMP;
BEGIN
    -- Round to nearest hour for trending buckets
    current_bucket := date_trunc('hour', NOW());
    
    INSERT INTO search_trends (search_term, time_bucket, search_count, unique_users, avg_results, avg_click_position)
    VALUES (search_term, current_bucket, 1, 1, result_count, COALESCE(click_position, 0))
    ON CONFLICT (search_term, time_bucket) 
    DO UPDATE SET
        search_count = search_trends.search_count + 1,
        avg_results = ((search_trends.avg_results * search_trends.search_count) + result_count) / (search_trends.search_count + 1),
        avg_click_position = CASE 
            WHEN click_position IS NOT NULL THEN
                ((search_trends.avg_click_position * search_trends.search_count) + click_position) / (search_trends.search_count + 1)
            ELSE search_trends.avg_click_position
        END;
END;
$$ LANGUAGE plpgsql;

-- Get trending searches for time period
CREATE OR REPLACE FUNCTION get_trending_searches(
    time_period INTERVAL DEFAULT '24 hours',
    limit_results INTEGER DEFAULT 10
) RETURNS TABLE (
    search_term TEXT,
    total_searches BIGINT,
    unique_users_count BIGINT,
    avg_results FLOAT,
    growth_rate FLOAT
) AS $$
BEGIN
    RETURN QUERY
    WITH current_period AS (
        SELECT 
            st.search_term,
            SUM(st.search_count) as current_searches,
            COUNT(DISTINCT st.time_bucket) as periods_active,
            AVG(st.avg_results) as avg_result_count
        FROM search_trends st
        WHERE st.time_bucket >= (NOW() - time_period)
        GROUP BY st.search_term
    ),
    previous_period AS (
        SELECT 
            st.search_term,
            SUM(st.search_count) as previous_searches
        FROM search_trends st
        WHERE st.time_bucket >= (NOW() - time_period * 2) 
        AND st.time_bucket < (NOW() - time_period)
        GROUP BY st.search_term
    )
    SELECT 
        cp.search_term,
        cp.current_searches,
        cp.periods_active,
        cp.avg_result_count,
        CASE 
            WHEN pp.previous_searches > 0 THEN 
                ((cp.current_searches - pp.previous_searches)::FLOAT / pp.previous_searches) * 100
            ELSE 100.0
        END as growth_percentage
    FROM current_period cp
    LEFT JOIN previous_period pp ON cp.search_term = pp.search_term
    WHERE cp.current_searches >= 3 -- Minimum threshold
    ORDER BY cp.current_searches DESC, growth_percentage DESC
    LIMIT limit_results;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- SEARCH OPTIMIZATION VIEWS
-- =============================================

-- Popular pitches optimized for search
CREATE OR REPLACE VIEW search_popular_pitches AS
SELECT 
    p.id,
    p.title,
    p.logline,
    p.genre,
    p.format,
    p.view_count,
    p.like_count,
    p.nda_count,
    p.created_at,
    p.published_at,
    u.username,
    u.company_name,
    -- Pre-calculate some search-relevant fields
    (p.view_count + p.like_count * 2 + p.nda_count * 3) as popularity_score,
    CASE 
        WHEN p.lookbook_url IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN p.script_url IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN p.trailer_url IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN p.pitch_deck_url IS NOT NULL THEN 1 ELSE 0 END 
    as media_completeness_score
FROM pitches p
JOIN users u ON p.user_id = u.id
WHERE p.status = 'published'
AND p.published_at IS NOT NULL;

-- Search suggestions with popularity
CREATE OR REPLACE VIEW search_suggestions_ranked AS
SELECT 
    ss.query_text,
    ss.suggestion_type,
    ss.popularity_score,
    ss.click_through_rate,
    ss.suggestion_count,
    -- Calculate trending score
    (ss.popularity_score * 0.7 + ss.click_through_rate * 0.3) as trending_score,
    ss.last_suggested,
    ss.created_at
FROM search_suggestions ss
WHERE ss.last_suggested >= (NOW() - INTERVAL '30 days')
ORDER BY trending_score DESC;

-- =============================================
-- PERFORMANCE OPTIMIZATION
-- =============================================

-- Refresh search suggestions materialized view (run via cron)
CREATE OR REPLACE FUNCTION refresh_search_suggestions() RETURNS VOID AS $$
BEGIN
    -- Update popularity scores based on recent search analytics
    UPDATE search_suggestions 
    SET 
        popularity_score = (
            SELECT COALESCE(LOG(COUNT(*) + 1), 0)
            FROM search_analytics sa
            WHERE LOWER(sa.search_query) = LOWER(search_suggestions.query_text)
            AND sa.created_at >= (NOW() - INTERVAL '30 days')
        ),
        click_through_rate = (
            SELECT COALESCE(
                COUNT(CASE WHEN clicked_result_id IS NOT NULL THEN 1 END)::FLOAT / 
                NULLIF(COUNT(*), 0), 0
            )
            FROM search_analytics sa
            WHERE LOWER(sa.search_query) = LOWER(search_suggestions.query_text)
            AND sa.created_at >= (NOW() - INTERVAL '30 days')
        ),
        updated_at = NOW()
    WHERE last_suggested >= (NOW() - INTERVAL '30 days');
    
    -- Add new popular searches as suggestions
    INSERT INTO search_suggestions (query_text, suggestion_type, popularity_score)
    SELECT DISTINCT
        sa.search_query,
        'autocomplete',
        LOG(COUNT(*) + 1)
    FROM search_analytics sa
    WHERE sa.created_at >= (NOW() - INTERVAL '7 days')
    AND LENGTH(sa.search_query) >= 3
    AND sa.search_query NOT IN (SELECT query_text FROM search_suggestions)
    GROUP BY sa.search_query
    HAVING COUNT(*) >= 5
    ON CONFLICT (query_text) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- SEARCH ANALYTICS TRIGGERS
-- =============================================

-- Trigger to update search trends when analytics are inserted
CREATE OR REPLACE FUNCTION trigger_update_search_trends() RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_search_trends(
        NEW.search_query, 
        NEW.results_count, 
        NEW.clicked_result_position
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER search_analytics_trend_update
    AFTER INSERT ON search_analytics
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_search_trends();

-- =============================================
-- INDEXES FOR NEW TABLES
-- =============================================

-- Search analytics indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_analytics_user_time 
ON search_analytics (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_analytics_query_time 
ON search_analytics (search_query, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_analytics_filters 
ON search_analytics USING GIN (filters);

-- Search suggestions indexes  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_suggestions_popularity 
ON search_suggestions (popularity_score DESC, click_through_rate DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_suggestions_type_query 
ON search_suggestions (suggestion_type, query_text);

-- Search trends indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_trends_bucket_count 
ON search_trends (time_bucket DESC, search_count DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_trends_term_bucket 
ON search_trends (search_term, time_bucket DESC);

-- Search alerts indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_alerts_user_active 
ON search_alerts (user_id, is_active, alert_frequency);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_alerts_schedule 
ON search_alerts (alert_frequency, last_checked) 
WHERE is_active = true;

-- Performance metrics indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_performance_date 
ON search_performance_metrics (metric_date DESC);

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

-- Grant necessary permissions (adjust role names as needed)
-- GRANT SELECT, INSERT, UPDATE ON search_analytics TO pitchey_app_role;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON search_suggestions TO pitchey_app_role;
-- GRANT SELECT, INSERT, UPDATE ON search_trends TO pitchey_app_role;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON search_alerts TO pitchey_app_role;
-- GRANT SELECT, INSERT, UPDATE ON search_performance_metrics TO pitchey_app_role;

-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pitchey_app_role;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO pitchey_app_role;

COMMENT ON TABLE search_analytics IS 'Detailed search behavior tracking for analytics and optimization';
COMMENT ON TABLE search_suggestions IS 'Cached search suggestions with popularity and CTR metrics';
COMMENT ON TABLE search_trends IS 'Trending search terms aggregated by time buckets';
COMMENT ON TABLE search_alerts IS 'User alerts for saved searches when new matches appear';
COMMENT ON TABLE search_performance_metrics IS 'Daily aggregated search system performance metrics';

COMMENT ON FUNCTION calculate_search_relevance IS 'Calculates weighted relevance score for search results';
COMMENT ON FUNCTION update_search_trends IS 'Updates trending search data for analytics';
COMMENT ON FUNCTION get_trending_searches IS 'Returns trending searches with growth metrics';
COMMENT ON FUNCTION refresh_search_suggestions IS 'Updates search suggestion popularity scores';