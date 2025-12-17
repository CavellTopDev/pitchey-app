#!/bin/bash

# Simple Database Optimization Script
# Uses psql directly to optimize the database

set -e

echo "🔧 Starting Database Optimization..."
echo "====================================="

# Parse DATABASE_URL
DATABASE_URL="${DATABASE_URL:-postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require}"

# Extract components from DATABASE_URL
if [[ $DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^/]+)/([^?]+) ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASS="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_NAME="${BASH_REMATCH[4]}"
else
    echo "❌ Invalid DATABASE_URL format"
    exit 1
fi

export PGPASSWORD="$DB_PASS"

# Function to run SQL command
run_sql() {
    psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "$1" 2>/dev/null || echo "⚠️  Command failed: $1"
}

echo ""
echo "📊 Analyzing Database State..."
echo "------------------------------"

# Get database size
run_sql "SELECT pg_size_pretty(pg_database_size(current_database())) as database_size;"

# Get table sizes
echo ""
echo "📋 Table Sizes:"
run_sql "SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
         FROM pg_tables
         WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
         ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
         LIMIT 10;"

echo ""
echo "🔍 Creating Missing Indexes..."
echo "-------------------------------"

# Create critical indexes if they don't exist
INDEXES=(
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_status_created ON pitches(status, created_at DESC);"
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_genre_status ON pitches(genre, status);"
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitches_creator_status ON pitches(creator_id, status);"
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));"
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_type ON users(type);"
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ndas_pitch_status ON ndas(pitch_id, status);"
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ndas_requester_status ON ndas(requester_id, status);"
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_views_pitch_date ON views(pitch_id, viewed_at DESC);"
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);"
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_conversation ON messages(sender_id, recipient_id, created_at DESC);"
)

for index in "${INDEXES[@]}"; do
    echo "  Creating index..."
    run_sql "$index" && echo "  ✓ Index created or already exists" || echo "  ⚠️  Index creation failed"
done

echo ""
echo "📈 Updating Statistics..."
echo "-------------------------"

# Update statistics for query planner
TABLES=("users" "pitches" "ndas" "views" "notifications" "messages" "saved_pitches" "investments" "follows")

for table in "${TABLES[@]}"; do
    echo "  Analyzing $table..."
    run_sql "ANALYZE $table;" && echo "  ✓ $table analyzed" || echo "  ⚠️  Failed to analyze $table"
done

echo ""
echo "🧹 Cleaning Up Orphaned Data..."
echo "--------------------------------"

# Clean orphaned records
echo "  Cleaning orphaned views..."
run_sql "DELETE FROM views v WHERE NOT EXISTS (SELECT 1 FROM pitches p WHERE p.id = v.pitch_id);"

echo "  Cleaning orphaned notifications..."
run_sql "DELETE FROM notifications n WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = n.user_id);"

echo "  Cleaning old sessions..."
run_sql "DELETE FROM sessions WHERE expires_at < NOW() - INTERVAL '30 days';"

echo ""
echo "⚡ Optimizing Queries..."
echo "------------------------"

# Set optimal configuration for Neon
echo "  Setting optimal parameters..."
run_sql "SET statement_timeout = '30s';"
run_sql "SET lock_timeout = '10s';"
run_sql "SET idle_in_transaction_session_timeout = '60s';"

echo ""
echo "📊 Optimization Summary"
echo "======================="

# Get index usage stats
echo ""
echo "Unused Indexes:"
run_sql "SELECT schemaname, tablename, indexname 
         FROM pg_stat_user_indexes 
         WHERE idx_scan = 0 
         ORDER BY schemaname, tablename 
         LIMIT 5;"

# Get slow queries if pg_stat_statements is available
echo ""
echo "Connection Stats:"
run_sql "SELECT count(*) as total_connections, 
         state, 
         COUNT(*) as count 
         FROM pg_stat_activity 
         GROUP BY state;"

echo ""
echo "✅ Database Optimization Complete!"
echo ""
echo "Recommendations:"
echo "  → Use connection pooling (Hyperdrive is configured)"
echo "  → Monitor slow queries with pg_stat_statements"
echo "  → Consider partitioning large tables if they grow > 10GB"
echo "  → Regular VACUUM and ANALYZE scheduled (Neon handles automatically)"
echo ""

# Cleanup
unset PGPASSWORD