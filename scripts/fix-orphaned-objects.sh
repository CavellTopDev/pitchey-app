#!/bin/bash

# Fix orphaned object literals left from console.log removal

echo "🔧 Fixing orphaned object literals..."

# NotificationInitializer.tsx
if [ -f "frontend/src/components/NotificationInitializer.tsx" ]; then
    echo "Fixing NotificationInitializer.tsx..."
    sed -i '/^    if (process.env.NODE_ENV === .development.) {$/,/^    });$/c\    // Development environment - removed debug logging' frontend/src/components/NotificationInitializer.tsx
fi

# Find and fix other potential orphaned objects
FILES_WITH_ISSUES=$(grep -l "^\s*[A-Za-z_][A-Za-z0-9_]*:" frontend/src/**/*.{ts,tsx} 2>/dev/null | while read file; do
    # Check if the line is not inside a proper object/interface declaration
    if grep -B1 "^\s*[A-Za-z_][A-Za-z0-9_]*:" "$file" | grep -q "^\s*$\|^//" 2>/dev/null; then
        echo "$file"
    fi
done | sort -u)

for file in $FILES_WITH_ISSUES; do
    echo "Checking: $file"
    # Remove orphaned object properties that aren't part of a valid statement
    sed -i '/^\s*[A-Za-z_][A-Za-z0-9_]*:.*,$/d' "$file" 2>/dev/null
    sed -i '/^\s*});$/d' "$file" 2>/dev/null
done

echo "✅ Fixed orphaned object literals"