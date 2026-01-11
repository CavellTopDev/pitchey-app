#!/bin/bash

echo "Fixing all betterAuthStore import paths..."

# Fix files directly in src/ (need ../store/betterAuthStore)
find frontend/src -maxdepth 1 -name "*.tsx" -o -name "*.ts" | while read file; do
    if grep -q "from ['\"].*betterAuthStore" "$file"; then
        echo "Fixing: $file (root level - needs ../store/)"
        sed -i "s|from ['\"].*betterAuthStore['\"]|from '../store/betterAuthStore'|g" "$file"
    fi
done

# Fix files in src/components/ (need ../store/betterAuthStore)
find frontend/src/components -name "*.tsx" -o -name "*.ts" | while read file; do
    if grep -q "from ['\"].*betterAuthStore" "$file"; then
        echo "Fixing: $file (components - needs ../store/)"
        sed -i "s|from ['\"].*betterAuthStore['\"]|from '../store/betterAuthStore'|g" "$file"
    fi
done

# Fix files in src/hooks/ (need ../store/betterAuthStore)
find frontend/src/hooks -name "*.tsx" -o -name "*.ts" | while read file; do
    if grep -q "from ['\"].*betterAuthStore" "$file"; then
        echo "Fixing: $file (hooks - needs ../store/)"
        sed -i "s|from ['\"].*betterAuthStore['\"]|from '../store/betterAuthStore'|g" "$file"
    fi
done

# Fix files in src/contexts/ (need ../store/betterAuthStore)
find frontend/src/contexts -name "*.tsx" -o -name "*.ts" | while read file; do
    if grep -q "from ['\"].*betterAuthStore" "$file"; then
        echo "Fixing: $file (contexts - needs ../store/)"
        sed -i "s|from ['\"].*betterAuthStore['\"]|from '../store/betterAuthStore'|g" "$file"
    fi
done

# Fix files in src/pages/ (need ../../store/betterAuthStore) 
find frontend/src/pages -maxdepth 1 -name "*.tsx" -o -name "*.ts" | while read file; do
    if grep -q "from ['\"].*betterAuthStore" "$file"; then
        echo "Fixing: $file (pages root - needs ../../store/)"
        sed -i "s|from ['\"].*betterAuthStore['\"]|from '../../store/betterAuthStore'|g" "$file"
    fi
done

# Fix files in src/pages/*/ subdirectories (need ../../store/betterAuthStore)
find frontend/src/pages -mindepth 2 -name "*.tsx" -o -name "*.ts" | while read file; do
    if grep -q "from ['\"].*betterAuthStore" "$file"; then
        echo "Fixing: $file (pages subdirs - needs ../../store/)"
        sed -i "s|from ['\"].*betterAuthStore['\"]|from '../../store/betterAuthStore'|g" "$file"
    fi
done

# Fix files in src/components/layout/ (need ../../store/betterAuthStore)
find frontend/src/components/layout -name "*.tsx" -o -name "*.ts" | while read file; do
    if grep -q "from ['\"].*betterAuthStore" "$file"; then
        echo "Fixing: $file (layout - needs ../../store/)"
        sed -i "s|from ['\"].*betterAuthStore['\"]|from '../../store/betterAuthStore'|g" "$file"
    fi
done

# Fix files in src/components/*/ (need ../../store/betterAuthStore)
find frontend/src/components -mindepth 2 -name "*.tsx" -o -name "*.ts" | while read file; do
    if grep -q "from ['\"].*betterAuthStore" "$file"; then
        echo "Fixing: $file (component subdirs - needs ../../store/)"
        sed -i "s|from ['\"].*betterAuthStore['\"]|from '../../store/betterAuthStore'|g" "$file"
    fi
done

echo "✅ All betterAuthStore import paths fixed!"