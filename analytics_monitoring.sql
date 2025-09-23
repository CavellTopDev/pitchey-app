-- Analytics Monitoring and Maintenance Script for Pitches Table
-- This script provides monitoring queries and maintenance procedures for analytics columns

-- 1. Current analytics summary
SELECT 
    COUNT(*) as total_pitches,
    SUM(view_count) as total_views,
    SUM(like_count) as total_likes, 
    SUM(comment_count) as total_comments,
    SUM(nda_count) as total_ndas,
    AVG(view_count) as avg_views_per_pitch,
    AVG(like_count) as avg_likes_per_pitch,
    AVG(comment_count) as avg_comments_per_pitch,
    AVG(nda_count) as avg_ndas_per_pitch
FROM pitches 
WHERE status = 'active';

-- 2. Top performing pitches by engagement
SELECT 
    id,
    title,
    view_count,
    like_count,
    comment_count,
    nda_count,
    (view_count + like_count * 5 + comment_count * 3 + nda_count * 10) as engagement_score,
    created_at
FROM pitches 
WHERE status = 'active'
ORDER BY engagement_score DESC 
LIMIT 10;

-- 3. Analytics columns health check
SELECT 
    'view_count' as metric,
    COUNT(*) as total_records,
    COUNT(CASE WHEN view_count IS NULL THEN 1 END) as null_count,
    COUNT(CASE WHEN view_count < 0 THEN 1 END) as negative_count,
    MIN(view_count) as min_value,
    MAX(view_count) as max_value
FROM pitches
UNION ALL
SELECT 
    'like_count' as metric,
    COUNT(*) as total_records,
    COUNT(CASE WHEN like_count IS NULL THEN 1 END) as null_count,
    COUNT(CASE WHEN like_count < 0 THEN 1 END) as negative_count,
    MIN(like_count) as min_value,
    MAX(like_count) as max_value
FROM pitches
UNION ALL
SELECT 
    'comment_count' as metric,
    COUNT(*) as total_records,
    COUNT(CASE WHEN comment_count IS NULL THEN 1 END) as null_count,
    COUNT(CASE WHEN comment_count < 0 THEN 1 END) as negative_count,
    MIN(comment_count) as min_value,
    MAX(comment_count) as max_value
FROM pitches
UNION ALL
SELECT 
    'nda_count' as metric,
    COUNT(*) as total_records,
    COUNT(CASE WHEN nda_count IS NULL THEN 1 END) as null_count,
    COUNT(CASE WHEN nda_count < 0 THEN 1 END) as negative_count,
    MIN(nda_count) as min_value,
    MAX(nda_count) as max_value
FROM pitches;

-- 4. Fix any NULL values (run if needed)
-- UPDATE pitches SET view_count = 0 WHERE view_count IS NULL;
-- UPDATE pitches SET like_count = 0 WHERE like_count IS NULL;
-- UPDATE pitches SET comment_count = 0 WHERE comment_count IS NULL;
-- UPDATE pitches SET nda_count = 0 WHERE nda_count IS NULL;

-- 5. Performance monitoring query
EXPLAIN ANALYZE 
SELECT id, title, view_count, like_count, comment_count, nda_count 
FROM pitches 
WHERE view_count > 100 
ORDER BY view_count DESC 
LIMIT 20;