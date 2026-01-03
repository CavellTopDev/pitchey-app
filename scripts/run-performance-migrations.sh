#!/bin/bash

# Run Performance and Monitoring Migrations
# This script applies database indexes and creates monitoring tables

set -e

echo "🚀 Running database performance migrations..."

# Database connection with correct hostname and channel binding
DB_URL="postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# Extract connection details (fixed typo in hostname - was missing 'b')
DB_HOST="ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech"
DB_USER="neondb_owner"
DB_PASS="npg_YibeIGRuv40J"
DB_NAME="neondb"

echo "📊 Applying performance indexes and monitoring tables..."

# Run the migration
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f src/db/migrations/add-performance-indexes.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    echo ""
    echo "📈 Created/Updated:"
    echo "  - 40+ performance indexes for faster queries"
    echo "  - password_reset_tokens table for password recovery"
    echo "  - analytics_events table for user tracking"
    echo "  - error_logs table for error monitoring"
    echo "  - request_logs table for performance monitoring"
    echo ""
    echo "🧹 Cleaned up:"
    echo "  - Expired password reset tokens"
    echo "  - Old error logs (>30 days)"
    echo "  - Old request logs (>7 days)"
    echo ""
    echo "✨ Database optimization complete!"
else
    echo "❌ Migration failed!"
    exit 1
fi