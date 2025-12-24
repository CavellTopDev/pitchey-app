#!/bin/bash

# Apply Browse Tab Optimizations to Neon Database
# This script adds the required columns and indexes for browse functionality

echo "🔧 Applying Browse Tab Optimizations to Neon Database..."

# Database connection details (from your CLAUDE.md)
DB_HOST="ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech"
DB_USER="neondb_owner"
DB_PASS="npg_DZhIpVaLAk06"
DB_NAME="neondb"

# SQL Optimization commands
SQL_COMMANDS='
-- 1. Ensure required columns exist on pitches table
ALTER TABLE pitches 
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS investment_count INTEGER DEFAULT 0;

-- 2. Create composite indexes for optimal browse performance

-- Index for trending tab: Last 7 days with view_count > 10
CREATE INDEX IF NOT EXISTS idx_pitches_trending 
ON pitches(status, created_at, view_count) 
WHERE status = '"'"'published'"'"' AND view_count > 10;

-- Index for new tab: Last 30 days, sorted by creation date
CREATE INDEX IF NOT EXISTS idx_pitches_new 
ON pitches(status, created_at) 
WHERE status = '"'"'published'"'"';

-- Index for popular tab by views: view_count > 50
CREATE INDEX IF NOT EXISTS idx_pitches_popular_views 
ON pitches(status, view_count, created_at) 
WHERE status = '"'"'published'"'"' AND view_count > 50;

-- Index for popular tab by likes: like_count > 20
CREATE INDEX IF NOT EXISTS idx_pitches_popular_likes 
ON pitches(status, like_count, created_at) 
WHERE status = '"'"'published'"'"' AND like_count > 20;

-- General index for published pitches
CREATE INDEX IF NOT EXISTS idx_pitches_published_created 
ON pitches(status, created_at) 
WHERE status = '"'"'published'"'"';

-- 3. One-time update to populate existing stats
-- Update view counts from analytics_events (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '"'"'analytics_events'"'"') THEN
        UPDATE pitches SET view_count = COALESCE((
            SELECT COUNT(*) 
            FROM analytics_events 
            WHERE pitch_id = pitches.id AND event_type = '"'"'view'"'"'
        ), 0);
    END IF;
END $$;

-- Update like counts from pitch_likes (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '"'"'pitch_likes'"'"') THEN
        UPDATE pitches SET like_count = COALESCE((
            SELECT COUNT(*) 
            FROM pitch_likes 
            WHERE pitch_id = pitches.id
        ), 0);
    END IF;
END $$;

-- Update investment counts from investments (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '"'"'investments'"'"') THEN
        UPDATE pitches SET investment_count = COALESCE((
            SELECT COUNT(*) 
            FROM investments 
            WHERE pitch_id = pitches.id AND status = '"'"'active'"'"'
        ), 0);
    END IF;
END $$;

-- 4. Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = '"'"'pitches'"'"' 
AND column_name IN ('"'"'view_count'"'"', '"'"'like_count'"'"', '"'"'investment_count'"'"');

-- 5. Verify indexes were created
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = '"'"'pitches'"'"' 
AND indexname LIKE '"'"'idx_pitches_%'"'"';
'

# Execute the SQL commands
echo "📝 Running SQL optimizations..."
PGPASSWORD="$DB_PASS" psql "postgresql://$DB_USER:$DB_PASS@$DB_HOST/$DB_NAME?sslmode=require" -c "$SQL_COMMANDS" 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Browse optimizations applied successfully!"
    
    # Test the optimizations
    echo -e "\n🔍 Verifying columns exist..."
    PGPASSWORD="$DB_PASS" psql "postgresql://$DB_USER:$DB_PASS@$DB_HOST/$DB_NAME?sslmode=require" -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'pitches' AND column_name IN ('view_count', 'like_count', 'investment_count');" 2>&1
    
    echo -e "\n📊 Checking sample data..."
    PGPASSWORD="$DB_PASS" psql "postgresql://$DB_USER:$DB_PASS@$DB_HOST/$DB_NAME?sslmode=require" -c "SELECT id, title, status, view_count, like_count, investment_count FROM pitches WHERE status = 'published' LIMIT 5;" 2>&1
else
    echo "❌ Failed to apply optimizations"
    exit 1
fi

echo -e "\n🎉 Database optimization complete!"
echo "Next steps:"
echo "1. Update frontend to use /api/browse endpoint with tab parameter"
echo "2. Deploy the worker to Cloudflare"
echo "3. Test browse tabs (trending, new, popular)"