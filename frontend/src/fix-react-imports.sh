#!/bin/bash

# Fix React imports in all files that need it
FILES_TO_FIX=(
  "pages/BrowseGenres.tsx"
  "pages/BrowseTopRated.tsx"
  "pages/SearchPage.tsx"
  "pages/CreatorDashboard.tsx"
  "pages/InvestorDashboard.tsx"
  "pages/ProductionDashboard.tsx"
  "pages/Analytics.tsx"
  "pages/Billing.tsx"
  "pages/Calendar.tsx"
  "pages/ComingSoon.tsx"
  "pages/CreatePitch.tsx"
  "pages/CreatorDashboardTest.tsx"
  "pages/CreatorLogin.tsx"
  "pages/InvestorLogin.tsx"
  "pages/ProductionLogin.tsx"
  "pages/TeamManagement.tsx"
)

for file in "${FILES_TO_FIX[@]}"; do
  if [ -f "$file" ]; then
    # Check if file starts with "import {" and doesn't have React import
    if head -1 "$file" | grep -q "^import {.*} from 'react'" && ! head -1 "$file" | grep -q "React"; then
      echo "Fixing $file"
      sed -i "1s/import {/import React, {/" "$file"
    fi
  fi
done

echo "React imports fixed!"
