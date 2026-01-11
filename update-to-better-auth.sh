#!/bin/bash

echo "Updating all files to use useBetterAuthStore instead of useAuthStore..."

# Find all TypeScript/TSX files that import useAuthStore
FILES=$(grep -r "import.*useAuthStore" frontend/src/ --include="*.ts" --include="*.tsx" -l)

count=0
for file in $FILES; do
    echo "Updating: $file"
    
    # Replace the import statement
    sed -i "s/import { useAuthStore } from '.*authStore'/import { useBetterAuthStore } from '..\/store\/betterAuthStore'/g" "$file"
    sed -i "s/import { useAuthStore } from '@\/store\/authStore'/import { useBetterAuthStore } from '@\/store\/betterAuthStore'/g" "$file"
    
    # Replace all usages of useAuthStore with useBetterAuthStore
    sed -i "s/useAuthStore()/useBetterAuthStore()/g" "$file"
    
    count=$((count + 1))
done

echo "✅ Updated $count files to use useBetterAuthStore"

# Also update the import paths to be relative where needed
echo "Fixing relative import paths..."
find frontend/src -name "*.tsx" -o -name "*.ts" | while read file; do
    depth=$(echo "$file" | tr -cd '/' | wc -c)
    depth=$((depth - 2))  # Subtract 2 for frontend/src
    
    if [ $depth -eq 1 ]; then
        # Files directly in src/
        sed -i "s|import { useBetterAuthStore } from '\.\./store/betterAuthStore'|import { useBetterAuthStore } from './store/betterAuthStore'|g" "$file"
    elif [ $depth -eq 2 ]; then
        # Files in src/subfolder/
        sed -i "s|import { useBetterAuthStore } from '\.\./store/betterAuthStore'|import { useBetterAuthStore } from '../store/betterAuthStore'|g" "$file"
    elif [ $depth -eq 3 ]; then
        # Files in src/subfolder/subfolder/
        sed -i "s|import { useBetterAuthStore } from '\.\./store/betterAuthStore'|import { useBetterAuthStore } from '../../store/betterAuthStore'|g" "$file"
    elif [ $depth -eq 4 ]; then
        # Files in src/subfolder/subfolder/subfolder/
        sed -i "s|import { useBetterAuthStore } from '\.\./store/betterAuthStore'|import { useBetterAuthStore } from '../../../store/betterAuthStore'|g" "$file"
    fi
done

echo "✅ All import paths fixed"