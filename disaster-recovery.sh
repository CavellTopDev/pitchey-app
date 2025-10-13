#!/bin/bash
# Pitchey Database Disaster Recovery Script
# Generated: 2025-10-08T12:30:41.695Z
# 
# This script provides step-by-step disaster recovery procedures

set -e

echo "🚨 Pitchey Database Disaster Recovery"
echo "====================================="

# Check if backup file exists
BACKUP_FILE="$1"
if [ -z "$BACKUP_FILE" ]; then
    echo "❌ Usage: $0 <backup_file>"
    echo "   Example: $0 ./backups/pitchey_backup_2025-01-01.dump"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "📦 Using backup file: $BACKUP_FILE"

# Database connection settings
DB_HOST="localhost"
DB_NAME="pitchey"
DB_USER="postgres"

echo "🔄 Starting recovery process..."

# Step 1: Create new database (if needed)
echo "1️⃣ Preparing database..."
createdb -h $DB_HOST -U $DB_USER $DB_NAME || echo "Database already exists"

# Step 2: Restore from backup
echo "2️⃣ Restoring from backup..."
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME --clean --if-exists --no-owner --no-privileges "$BACKUP_FILE"

# Step 3: Verify critical tables
echo "3️⃣ Verifying critical tables..."
CRITICAL_TABLES=(
    "users"
    "pitches" 
    "feature_flags"
    "portal_configurations"
    "content_items"
    "navigation_menus"
    "translations"
    "content_types"
)

for table in "${CRITICAL_TABLES[@]}"; do
    COUNT=$(psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "0")
    echo "   $table: $COUNT rows"
done

# Step 4: Run maintenance
echo "4️⃣ Running post-recovery maintenance..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "VACUUM ANALYZE;" || echo "Maintenance completed with warnings"

# Step 5: Test application connection
echo "5️⃣ Testing application connectivity..."
deno run --allow-all scripts/database-operations.ts test || echo "⚠️ Application test failed - manual verification needed"

echo "✅ Recovery process completed"
echo ""
echo "📋 Post-Recovery Checklist:"
echo "  □ Verify application functionality"
echo "  □ Check data integrity"
echo "  □ Update connection strings if needed"
echo "  □ Monitor performance metrics"
echo "  □ Notify stakeholders of recovery completion"
echo ""
echo "🚨 RTO Target: < 30 minutes"
echo "🚨 RPO Target: < 15 minutes (based on backup frequency)"
