#!/bin/bash

echo "Cleaning up deprecated files..."
echo "================================"

# List of files to remove
FILES_TO_REMOVE=(
  # Old server files
  "oak-server.old.ts"
  "working-server.backup.ts"
  "working-server-backup-20250928-191310.ts"
  "auth-server-fixed.ts"
  "multi-portal-server.ts"
  
  # Temporary SQL files
  "update-production-stage.sql"
  "fix-neon-schema.sql"
  "fix-neon-schema-mismatches.sql"
  "add-missing-company-columns.sql"
  "add-missing-pitch-media-columns.sql"
  "complete-drizzle-schema-alignment.sql"
  "fix-missing-columns.sql"
  "apply-security-columns.sql"
  "fix-related-id-column.sql"
  "fix-investments-cascade.sql"
  
  # Old backup files
  "backup_20251011_231853.sql"
  ".env.backup.1758465545994"
  
  # Test files that are no longer needed
  "test-tab-separation.sh"
)

# Archive directory for important backups
ARCHIVE_DIR="archived_files"
mkdir -p "$ARCHIVE_DIR"

# Files to archive instead of delete
FILES_TO_ARCHIVE=(
  "src/db/schema.backup.20251002_233430.ts"
)

# Archive important files
for file in "${FILES_TO_ARCHIVE[@]}"; do
  if [ -f "$file" ]; then
    echo "Archiving: $file"
    mv "$file" "$ARCHIVE_DIR/"
  fi
done

# Remove deprecated files
for file in "${FILES_TO_REMOVE[@]}"; do
  if [ -f "$file" ]; then
    echo "Removing: $file"
    rm "$file"
  fi
done

# Clean up empty migration files
find src/db/migrations -type f -size 0 -delete 2>/dev/null

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Archived files are in: $ARCHIVE_DIR/"
echo "You can safely delete the archive directory after reviewing."