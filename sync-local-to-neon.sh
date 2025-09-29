#!/bin/bash

# Sync Local PostgreSQL to Neon Database Script
# This script exports your local database and imports it to Neon

echo "🔄 Syncing Local PostgreSQL to Neon Production Database"
echo "========================================================"

# Local database configuration
LOCAL_HOST="localhost"
LOCAL_PORT="5432"
LOCAL_DB="pitchey"
LOCAL_USER="postgres"
LOCAL_PASSWORD="password"

# Neon database configuration
NEON_HOST="ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech"
NEON_DB="neondb"
NEON_USER="neondb_owner"
NEON_PASSWORD="npg_DZhIpVaLAk06"

# Export options
EXPORT_SCHEMA_ONLY=false  # Set to true if you only want schema
EXPORT_FILE="local_db_export_$(date +%Y%m%d_%H%M%S).sql"

echo ""
echo "📊 Database Configuration:"
echo "  Source: $LOCAL_USER@$LOCAL_HOST:$LOCAL_PORT/$LOCAL_DB"
echo "  Target: $NEON_USER@$NEON_HOST/$NEON_DB"
echo ""

# Function to export local database
export_local_db() {
    echo "📦 Exporting local database..."
    
    if [ "$EXPORT_SCHEMA_ONLY" = true ]; then
        echo "  Mode: Schema only (no data)"
        PGPASSWORD=$LOCAL_PASSWORD pg_dump \
            -h $LOCAL_HOST \
            -p $LOCAL_PORT \
            -U $LOCAL_USER \
            -d $LOCAL_DB \
            --schema-only \
            --no-owner \
            --no-privileges \
            --if-exists \
            --clean \
            > $EXPORT_FILE
    else
        echo "  Mode: Full export (schema + data)"
        PGPASSWORD=$LOCAL_PASSWORD pg_dump \
            -h $LOCAL_HOST \
            -p $LOCAL_PORT \
            -U $LOCAL_USER \
            -d $LOCAL_DB \
            --no-owner \
            --no-privileges \
            --if-exists \
            --clean \
            > $EXPORT_FILE
    fi
    
    if [ $? -eq 0 ]; then
        echo "✅ Export completed: $EXPORT_FILE"
        echo "   File size: $(du -h $EXPORT_FILE | cut -f1)"
    else
        echo "❌ Export failed!"
        exit 1
    fi
}

# Function to import to Neon
import_to_neon() {
    echo ""
    echo "📥 Importing to Neon database..."
    echo "  ⚠️  WARNING: This will replace all data in the Neon database!"
    echo ""
    read -p "  Continue? (y/N): " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Import cancelled"
        exit 1
    fi
    
    echo "  Importing data..."
    PGPASSWORD=$NEON_PASSWORD psql \
        -h $NEON_HOST \
        -U $NEON_USER \
        -d $NEON_DB \
        --set=sslmode=require \
        < $EXPORT_FILE
    
    if [ $? -eq 0 ]; then
        echo "✅ Import completed successfully!"
    else
        echo "❌ Import failed!"
        echo "  Check the error messages above for details"
        exit 1
    fi
}

# Function to verify import
verify_import() {
    echo ""
    echo "🔍 Verifying import..."
    
    # Count tables
    TABLE_COUNT=$(PGPASSWORD=$NEON_PASSWORD psql \
        -h $NEON_HOST \
        -U $NEON_USER \
        -d $NEON_DB \
        --set=sslmode=require \
        -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
    
    # Count users
    USER_COUNT=$(PGPASSWORD=$NEON_PASSWORD psql \
        -h $NEON_HOST \
        -U $NEON_USER \
        -d $NEON_DB \
        --set=sslmode=require \
        -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
    
    # Count pitches
    PITCH_COUNT=$(PGPASSWORD=$NEON_PASSWORD psql \
        -h $NEON_HOST \
        -U $NEON_USER \
        -d $NEON_DB \
        --set=sslmode=require \
        -t -c "SELECT COUNT(*) FROM pitches;" 2>/dev/null || echo "0")
    
    echo "  📊 Database Statistics:"
    echo "     Tables: $TABLE_COUNT"
    echo "     Users: $USER_COUNT"
    echo "     Pitches: $PITCH_COUNT"
}

# Function to clean up
cleanup() {
    echo ""
    read -p "Delete export file? (y/N): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -f $EXPORT_FILE
        echo "✅ Export file deleted"
    else
        echo "📁 Export file kept: $EXPORT_FILE"
    fi
}

# Main execution
main() {
    echo "Choose sync option:"
    echo "1) Full sync (schema + data)"
    echo "2) Schema only (no data)"
    echo "3) Cancel"
    echo ""
    read -p "Option (1-3): " -n 1 -r
    echo ""
    
    case $REPLY in
        1)
            EXPORT_SCHEMA_ONLY=false
            ;;
        2)
            EXPORT_SCHEMA_ONLY=true
            ;;
        *)
            echo "❌ Cancelled"
            exit 0
            ;;
    esac
    
    # Run the sync process
    export_local_db
    import_to_neon
    verify_import
    cleanup
    
    echo ""
    echo "✨ Sync completed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Test your application with the production database"
    echo "  2. Verify all features work correctly"
    echo "  3. Monitor for any errors in the logs"
}

# Check if pg_dump and psql are available
if ! command -v pg_dump &> /dev/null; then
    echo "❌ pg_dump not found. Please install PostgreSQL client tools:"
    echo "   sudo apt-get install postgresql-client  # Ubuntu/Debian"
    echo "   brew install postgresql                 # macOS"
    exit 1
fi

if ! command -v psql &> /dev/null; then
    echo "❌ psql not found. Please install PostgreSQL client tools"
    exit 1
fi

# Run main function
main