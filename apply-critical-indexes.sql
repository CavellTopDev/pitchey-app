-- CRITICAL DATABASE INDEXES - IMMEDIATE DEPLOYMENT
-- Zero-downtime deployment with CONCURRENTLY

-- 1. Authentication Indexes (MOST CRITICAL)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_unique 
ON users (email);

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_token 
ON sessions (token);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_active 
ON sessions (user_id, expires_at) WHERE expires_at > NOW();

-- 2. Pitches Browse Optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_status_published 
ON pitches (status) WHERE status = 'published';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_browse_filters 
ON pitches (status, genre, format, production_stage, created_at DESC) 
WHERE status = 'published';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_user_id 
ON pitches (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_sort_date 
ON pitches (created_at DESC) WHERE status = 'published';

-- 3. Update Statistics
ANALYZE pitches;
ANALYZE users;
ANALYZE sessions;

-- 4. Verify indexes
SELECT 
  'Index created successfully' AS status,
  indexname,
  tablename
FROM pg_indexes 
WHERE indexname LIKE 'idx_%'
ORDER BY tablename, indexname;