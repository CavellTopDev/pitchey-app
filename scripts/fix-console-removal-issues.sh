#!/bin/bash

# Fix issues caused by console.log removal that left orphaned object literals

echo "🔧 Fixing orphaned object literals from console.log removal..."

# Pattern: Lines that start with properties but aren't part of valid structures
# These are typically followed by });

fix_orphaned_objects() {
    local file=$1
    echo "  Fixing: $file"
    
    # Create a temporary file
    tmp_file=$(mktemp)
    
    # Process the file line by line
    in_orphan=false
    while IFS= read -r line; do
        # Check if this line looks like an orphaned property
        if echo "$line" | grep -qE "^\s+[a-zA-Z_][a-zA-Z0-9_]*:.*,$"; then
            # Check if the previous line was a comment or if statement
            if [ "$prev_line_was_comment_or_if" = true ]; then
                in_orphan=true
                continue
            fi
        fi
        
        # Check if this is the closing of an orphaned object
        if [ "$in_orphan" = true ] && echo "$line" | grep -qE "^\s+}\);?$"; then
            in_orphan=false
            continue
        fi
        
        # Skip lines that are part of orphaned objects
        if [ "$in_orphan" = true ]; then
            continue
        fi
        
        # Track if this line is a comment or if statement
        if echo "$line" | grep -qE "^\s*(//|/\*|\*|if\s*\(|}\s*else)"; then
            prev_line_was_comment_or_if=true
        else
            prev_line_was_comment_or_if=false
        fi
        
        echo "$line" >> "$tmp_file"
    done < "$file"
    
    # Replace the original file
    mv "$tmp_file" "$file"
}

# Files with known issues
FILES_TO_FIX=(
    "frontend/src/pages/Calendar.tsx"
    "frontend/src/hooks/useSentryPortal.ts"
)

# Fix each file
for file in "${FILES_TO_FIX[@]}"; do
    if [ -f "$file" ]; then
        fix_orphaned_objects "$file"
    fi
done

# More aggressive fix: Find and remove all orphaned object literal patterns
echo "🔍 Scanning for remaining orphaned objects..."

find frontend/src -type f \( -name "*.ts" -o -name "*.tsx" \) -print0 | while IFS= read -r -d '' file; do
    # Use sed to remove orphaned object patterns
    # Pattern: Lines with property: value, preceded by comment/if and followed by });
    sed -i '/^\s*\/\/.*$/{N;/\n\s*[a-zA-Z_][a-zA-Z0-9_]*:.*,$/d;}' "$file" 2>/dev/null
    sed -i '/^\s*if\s*(.*)\s*{\s*$/{N;/\n\s*[a-zA-Z_][a-zA-Z0-9_]*:.*,$/d;}' "$file" 2>/dev/null
done

echo "✅ Fixed orphaned object literals"