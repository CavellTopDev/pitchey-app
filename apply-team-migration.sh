#!/bin/bash

echo "🔧 Applying Team Management Database Migration"
echo "=============================================="

# Load environment variables
source .env 2>/dev/null || true

# Use production database (Neon)
DB_HOST="ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech"
DB_USER="neondb_owner"
DB_NAME="neondb"
DB_PASSWORD="npg_YibeIGRuv40J"

echo ""
echo "📊 Connecting to Neon database..."
echo "Host: $DB_HOST"
echo "Database: $DB_NAME"
echo ""

# Apply migration
echo "🚀 Applying team tables migration..."
PGPASSWORD="$DB_PASSWORD" psql "postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST/$DB_NAME?sslmode=require&channel_binding=require" -f src/db/migrations/add-team-tables.sql

if [ $? -eq 0 ]; then
    echo "✅ Team tables migration applied successfully!"
else
    echo "❌ Failed to apply migration"
    exit 1
fi

echo ""
echo "📋 Verifying tables..."
PGPASSWORD="$DB_PASSWORD" psql "postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST/$DB_NAME?sslmode=require&channel_binding=require" -c "\dt teams*"
PGPASSWORD="$DB_PASSWORD" psql "postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST/$DB_NAME?sslmode=require&channel_binding=require" -c "\dt team_*"

echo ""
echo "✅ Team management database migration complete!"
echo ""
echo "📝 Created tables:"
echo "  - teams: Main team records"
echo "  - team_members: Team membership"
echo "  - team_invitations: Pending invitations"
echo "  - team_pitches: Pitch associations"
echo "  - team_activity: Activity log"
echo ""
echo "🎯 Next steps:"
echo "  1. Deploy the updated worker with team routes"
echo "  2. Test team creation and management in Creator Portal"