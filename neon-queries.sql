-- Neon PostgreSQL Database Queries
-- Direct SQL queries to verify data for endpoints

-- Connection: 
-- psql postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require

-- ============================================
-- BASIC STATISTICS
-- ============================================

-- Overview of all tables with row counts
SELECT 
    schemaname,
    tablename,
    n_live_tup as row_count,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- ============================================
-- USER QUERIES
-- ============================================

-- All users with their types
SELECT id, email, username, user_type, created_at
FROM users
ORDER BY created_at DESC;

-- User count by type
SELECT user_type, COUNT(*) as count
FROM users
GROUP BY user_type;

-- Demo accounts verification
SELECT id, email, username, user_type, 
       CASE WHEN password IS NOT NULL THEN 'Has Password' ELSE 'No Password' END as auth_status
FROM users
WHERE email IN ('alex.creator@demo.com', 'sarah.investor@demo.com', 'stellar.production@demo.com');

-- ============================================
-- CREATOR DASHBOARD DATA
-- ============================================

-- Creator's pitches with all metrics
SELECT 
    p.id,
    p.title,
    p.status,
    p.genre,
    p.format,
    p.view_count,
    p.like_count,
    p.budget,
    u.username as creator,
    COUNT(DISTINCT i.id) as investment_count,
    COUNT(DISTINCT n.id) as nda_count
FROM pitches p
JOIN users u ON p.user_id = u.id
LEFT JOIN investments i ON p.id = i.pitch_id
LEFT JOIN ndas n ON p.id = n.pitch_id
WHERE u.email = 'alex.creator@demo.com'
GROUP BY p.id, p.title, p.status, p.genre, p.format, p.view_count, p.like_count, p.budget, u.username
ORDER BY p.created_at DESC;

-- Creator dashboard summary (what the endpoint should return)
WITH creator_data AS (
    SELECT id FROM users WHERE email = 'alex.creator@demo.com'
)
SELECT 
    (SELECT COUNT(*) FROM pitches WHERE user_id = (SELECT id FROM creator_data)) as total_pitches,
    (SELECT COUNT(*) FROM pitches WHERE user_id = (SELECT id FROM creator_data) AND status = 'published') as active_pitches,
    (SELECT COALESCE(SUM(view_count), 0) FROM pitches WHERE user_id = (SELECT id FROM creator_data)) as total_views,
    (SELECT COALESCE(SUM(like_count), 0) FROM pitches WHERE user_id = (SELECT id FROM creator_data)) as total_likes,
    (SELECT COUNT(*) FROM follows WHERE creator_id = (SELECT id FROM creator_data)) as follower_count,
    (SELECT COUNT(*) FROM ndas n JOIN pitches p ON n.pitch_id = p.id WHERE p.user_id = (SELECT id FROM creator_data)) as total_ndas;

-- ============================================
-- INVESTOR DASHBOARD DATA
-- ============================================

-- Investor's investments with details
SELECT 
    i.id,
    i.amount,
    i.investment_type,
    i.status,
    i.percentage,
    p.title as pitch_title,
    p.genre,
    u.username as pitch_creator,
    i.created_at as invested_at
FROM investments i
JOIN pitches p ON i.pitch_id = p.id
JOIN users u ON p.user_id = u.id
WHERE i.investor_id = (SELECT id FROM users WHERE email = 'sarah.investor@demo.com')
ORDER BY i.created_at DESC;

-- Investor portfolio summary (for analytics endpoint)
WITH investor_data AS (
    SELECT id FROM users WHERE email = 'sarah.investor@demo.com'
)
SELECT 
    COUNT(*) as total_investments,
    COALESCE(SUM(amount), 0) as portfolio_value,
    COALESCE(AVG(amount), 0) as average_investment,
    COUNT(DISTINCT pitch_id) as unique_pitches,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_investments,
    COUNT(CASE WHEN investment_type = 'equity' THEN 1 END) as equity_investments,
    COUNT(CASE WHEN investment_type = 'debt' THEN 1 END) as debt_investments
FROM investments
WHERE investor_id = (SELECT id FROM investor_data);

-- Investment opportunities (for opportunities endpoint)
SELECT 
    p.id,
    p.title,
    p.genre,
    p.format,
    p.budget,
    p.logline,
    p.view_count,
    p.like_count,
    u.username as creator,
    COUNT(DISTINCT i.id) as existing_investors,
    COALESCE(SUM(i.amount), 0) as total_raised
FROM pitches p
JOIN users u ON p.user_id = u.id
LEFT JOIN investments i ON p.id = i.pitch_id
WHERE p.status = 'published'
GROUP BY p.id, p.title, p.genre, p.format, p.budget, p.logline, p.view_count, p.like_count, u.username
ORDER BY p.created_at DESC;

-- ============================================
-- RELATIONSHIPS & ENGAGEMENT
-- ============================================

-- All follows with usernames
SELECT 
    f.id,
    follower.username as follower,
    follower.user_type as follower_type,
    creator.username as following,
    creator.user_type as following_type,
    f.created_at
FROM follows f
JOIN users follower ON f.follower_id = follower.id
JOIN users creator ON f.creator_id = creator.id;

-- NDAs status
SELECT 
    n.id,
    p.title as pitch,
    u.username as user,
    n.status,
    n.signed_at,
    n.expires_at
FROM ndas n
JOIN pitches p ON n.pitch_id = p.id
JOIN users u ON n.user_id = u.id;

-- Notifications
SELECT 
    n.id,
    u.username as user,
    n.type,
    n.title,
    n.message,
    n.read,
    n.created_at
FROM notifications n
JOIN users u ON n.user_id = u.id
ORDER BY n.created_at DESC
LIMIT 10;

-- ============================================
-- PERFORMANCE ANALYSIS
-- ============================================

-- Table sizes
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(tablename::regclass)) as size,
    n_live_tup as rows
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(tablename::regclass) DESC;

-- Database performance metrics
SELECT 
    datname,
    numbackends as connections,
    xact_commit as commits,
    xact_rollback as rollbacks,
    blks_hit as cache_hits,
    blks_read as disk_reads,
    ROUND(100.0 * blks_hit / NULLIF(blks_hit + blks_read, 0), 2) as cache_hit_ratio
FROM pg_stat_database
WHERE datname = current_database();

-- ============================================
-- DATA VALIDATION QUERIES
-- ============================================

-- Check for orphaned records
SELECT 'Investments without valid pitch' as issue, COUNT(*)
FROM investments i
WHERE NOT EXISTS (SELECT 1 FROM pitches p WHERE p.id = i.pitch_id)
UNION ALL
SELECT 'NDAs without valid pitch', COUNT(*)
FROM ndas n
WHERE NOT EXISTS (SELECT 1 FROM pitches p WHERE p.id = n.pitch_id)
UNION ALL
SELECT 'Notifications without valid user', COUNT(*)
FROM notifications n
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = n.user_id);

-- Verify referential integrity
SELECT 
    'pitches.user_id -> users.id' as relationship,
    CASE 
        WHEN COUNT(*) = 0 THEN 'OK ✓'
        ELSE 'BROKEN ✗ (' || COUNT(*) || ' orphans)'
    END as status
FROM pitches p
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = p.user_id)
UNION ALL
SELECT 
    'investments.investor_id -> users.id',
    CASE 
        WHEN COUNT(*) = 0 THEN 'OK ✓'
        ELSE 'BROKEN ✗ (' || COUNT(*) || ' orphans)'
    END
FROM investments i
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = i.investor_id);

-- ============================================
-- ENDPOINT CORRELATION QUERIES
-- ============================================

-- What /api/creator/dashboard should return
SELECT 
    'totalPitches' as field,
    COUNT(*)::text as value
FROM pitches 
WHERE user_id = (SELECT id FROM users WHERE email = 'alex.creator@demo.com')
UNION ALL
SELECT 
    'activePitches',
    COUNT(*)::text
FROM pitches 
WHERE user_id = (SELECT id FROM users WHERE email = 'alex.creator@demo.com') 
    AND status = 'published'
UNION ALL
SELECT 
    'totalViews',
    COALESCE(SUM(view_count), 0)::text
FROM pitches 
WHERE user_id = (SELECT id FROM users WHERE email = 'alex.creator@demo.com');

-- What /api/investor/analytics should return
SELECT 
    'portfolioValue' as metric,
    COALESCE(SUM(amount), 0)::text as value
FROM investments 
WHERE investor_id = (SELECT id FROM users WHERE email = 'sarah.investor@demo.com')
UNION ALL
SELECT 
    'totalInvestments',
    COUNT(*)::text
FROM investments 
WHERE investor_id = (SELECT id FROM users WHERE email = 'sarah.investor@demo.com')
UNION ALL
SELECT 
    'activeDeals',
    COUNT(*)::text
FROM investments 
WHERE investor_id = (SELECT id FROM users WHERE email = 'sarah.investor@demo.com')
    AND status = 'active';