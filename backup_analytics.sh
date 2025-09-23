#!/bin/bash

# Database Backup Script for Pitchey Analytics
# Backs up the pitches table and related analytics data

set -e

# Configuration
DB_NAME="pitchey"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"
BACKUP_DIR="/home/supremeisbeing/pitcheymovie/pitchey_v0.2/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Database connection string
export PGPASSWORD="password"

echo "Starting backup at $(date)"

# 1. Full database backup
echo "Creating full database backup..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" \
    --format=custom \
    --compress=9 \
    --file="$BACKUP_DIR/pitchey_full_backup_$TIMESTAMP.dump"

# 2. Analytics-specific backup (schema + data)
echo "Creating analytics tables backup..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" \
    --format=custom \
    --compress=9 \
    --table=pitches \
    --table=pitch_views \
    --table=analytics_events \
    --table=analytics_aggregates \
    --file="$BACKUP_DIR/pitchey_analytics_backup_$TIMESTAMP.dump"

# 3. Schema-only backup for disaster recovery
echo "Creating schema-only backup..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" \
    --schema-only \
    --file="$BACKUP_DIR/pitchey_schema_backup_$TIMESTAMP.sql"

# 4. Analytics data CSV export for reporting
echo "Exporting analytics data to CSV..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
\copy (
    SELECT 
        p.id,
        p.title,
        p.view_count,
        p.like_count,
        p.comment_count,
        p.nda_count,
        p.created_at,
        p.updated_at,
        u.username as creator
    FROM pitches p
    JOIN users u ON p.user_id = u.id
    ORDER BY p.created_at DESC
) TO '$BACKUP_DIR/pitches_analytics_$TIMESTAMP.csv' WITH CSV HEADER;
"

# 5. Clean up old backups (keep last 7 days)
echo "Cleaning up old backups..."
find "$BACKUP_DIR" -name "*.dump" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.csv" -mtime +7 -delete

# 6. Verify backup integrity
echo "Verifying backup integrity..."
pg_restore --list "$BACKUP_DIR/pitchey_full_backup_$TIMESTAMP.dump" > /dev/null

echo "Backup completed successfully at $(date)"
echo "Backup files:"
echo "- Full backup: $BACKUP_DIR/pitchey_full_backup_$TIMESTAMP.dump"
echo "- Analytics backup: $BACKUP_DIR/pitchey_analytics_backup_$TIMESTAMP.dump"
echo "- Schema backup: $BACKUP_DIR/pitchey_schema_backup_$TIMESTAMP.sql"
echo "- CSV export: $BACKUP_DIR/pitches_analytics_$TIMESTAMP.csv"

# 7. Test backup by creating a temporary database
echo "Testing backup restoration..."
createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "pitchey_test_$TIMESTAMP" || true
pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "pitchey_test_$TIMESTAMP" \
    "$BACKUP_DIR/pitchey_full_backup_$TIMESTAMP.dump" --quiet
dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "pitchey_test_$TIMESTAMP"

echo "Backup test successful!"

unset PGPASSWORD