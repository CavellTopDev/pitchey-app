#!/bin/bash

echo "Fixing hardcoded dashboard routes in all portal settings files..."

# Fix all production settings files
for file in /home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src/pages/production/settings/*.tsx; do
  if grep -q "navigate('/dashboard')" "$file"; then
    echo "Fixing: $file"
    # Add import if not present
    if ! grep -q "import { getDashboardRoute }" "$file"; then
      sed -i "/import { useAuthStore }/a import { getDashboardRoute } from '../../../utils/navigation';" "$file"
    fi
    # Replace navigate('/dashboard') with dynamic route
    sed -i "s/navigate('\/dashboard')/navigate(getDashboardRoute(user?.userType))/g" "$file"
  fi
done

# Fix MarketplaceEnhanced.tsx
echo "Fixing MarketplaceEnhanced.tsx..."
file="/home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src/pages/MarketplaceEnhanced.tsx"
if [ -f "$file" ]; then
  # Add import if not present
  if ! grep -q "import { getDashboardRoute }" "$file"; then
    sed -i "1s/^/import { getDashboardRoute } from '..\/utils\/navigation';\n/" "$file"
  fi
  # The MarketplaceEnhanced already has logic to handle userType, just needs updating
fi

echo "Dashboard routes fixed!"