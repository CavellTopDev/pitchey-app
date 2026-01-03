#!/bin/bash

# Script to clean up debug console.log statements from the frontend code
# Keeps console.error and console.warn for production debugging

echo "🧹 Cleaning up debug console.log statements..."

# Frontend source files
FRONTEND_DIR="frontend/src"

# Count total console statements before cleanup
TOTAL_BEFORE=$(grep -r "console\.\(log\|debug\|info\)" "$FRONTEND_DIR" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | wc -l)
echo "Found $TOTAL_BEFORE console statements to clean up"

# Files to process
FILES=$(find "$FRONTEND_DIR" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) | grep -v "__tests__" | grep -v ".test." | grep -v ".spec.")

# Process each file
for file in $FILES; do
    # Check if file contains console.log/debug/info
    if grep -q "console\.\(log\|debug\|info\)" "$file" 2>/dev/null; then
        echo "Processing: $file"
        
        # Create backup
        cp "$file" "$file.backup"
        
        # Remove console.log, console.debug, and console.info statements
        # Keep console.error and console.warn for production debugging
        sed -i '/console\.\(log\|debug\|info\)/d' "$file"
        
        # Remove empty blocks that might result from deletion
        sed -i '/^[[:space:]]*{[[:space:]]*$/N;/^[[:space:]]*{[[:space:]]*\n[[:space:]]*}[[:space:]]*$/d' "$file"
        
        # Clean up any backup files if the sed was successful
        if [ $? -eq 0 ]; then
            rm "$file.backup"
        else
            echo "⚠️  Error processing $file, restoring backup"
            mv "$file.backup" "$file"
        fi
    fi
done

# Count remaining console statements
TOTAL_AFTER=$(grep -r "console\.\(log\|debug\|info\)" "$FRONTEND_DIR" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | wc -l)
CONSOLE_ERROR_WARN=$(grep -r "console\.\(error\|warn\)" "$FRONTEND_DIR" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | wc -l)

echo "✅ Cleanup complete!"
echo "   Removed: $((TOTAL_BEFORE - TOTAL_AFTER)) console statements"
echo "   Remaining debug statements: $TOTAL_AFTER"
echo "   Preserved error/warn statements: $CONSOLE_ERROR_WARN"

# Show any remaining console.log/debug/info (should be 0 or in test files)
if [ $TOTAL_AFTER -gt 0 ]; then
    echo ""
    echo "⚠️  Some console statements remain (likely in test files):"
    grep -r "console\.\(log\|debug\|info\)" "$FRONTEND_DIR" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | head -5
fi