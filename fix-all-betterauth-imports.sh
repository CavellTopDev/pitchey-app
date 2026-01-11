#!/bin/bash

echo "Fixing all betterAuthStore import paths..."

# Fix files in src/pages/creator/, src/pages/investor/, src/pages/production/, src/pages/settings/, src/pages/team/ subdirectories
# These are two levels deep, so they need ../../store/betterAuthStore
find /home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src/pages -mindepth 2 -type f \( -name "*.tsx" -o -name "*.ts" \) | while read file; do
    if grep -q "from ['\"].*betterAuthStore" "$file"; then
        echo "Fixing: $file"
        sed -i "s|from ['\"].*betterAuthStore['\"]|from '../../store/betterAuthStore'|g" "$file"
    fi
done

# Fix files in src/pages/production/settings/ (three levels deep)
find /home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src/pages/production/settings -type f \( -name "*.tsx" -o -name "*.ts" \) | while read file; do
    if grep -q "from ['\"].*betterAuthStore" "$file"; then
        echo "Fixing: $file (3 levels deep)"
        sed -i "s|from ['\"].*betterAuthStore['\"]|from '../../../store/betterAuthStore'|g" "$file"
    fi
done

# Fix files in src/pages/ root (one level deep)
find /home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src/pages -maxdepth 1 -type f \( -name "*.tsx" -o -name "*.ts" \) | while read file; do
    if grep -q "from ['\"].*betterAuthStore" "$file"; then
        echo "Fixing: $file"
        sed -i "s|from ['\"].*betterAuthStore['\"]|from '../store/betterAuthStore'|g" "$file"
    fi
done

# Fix files in src/components subdirectories (two levels deep)
find /home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src/components -mindepth 2 -type f \( -name "*.tsx" -o -name "*.ts" \) | while read file; do
    if grep -q "from ['\"].*betterAuthStore" "$file"; then
        echo "Fixing: $file"
        sed -i "s|from ['\"].*betterAuthStore['\"]|from '../../store/betterAuthStore'|g" "$file"
    fi
done

echo "Done! All import paths should now be correct."