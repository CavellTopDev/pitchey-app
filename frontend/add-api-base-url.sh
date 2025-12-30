#!/bin/bash

echo "Adding API_BASE_URL to service files that need it..."

# Add API_BASE_URL to files that need it
files=(
  "src/services/admin.service.ts"
  "src/services/analytics.service.ts"
  "src/services/enhanced-upload.service.ts"
  "src/services/upload.service.ts"
  "src/services/metrics.service.ts"
  "src/services/auth-secure.service.ts"
  "src/services/creator.service.ts"
  "src/services/presence-fallback.service.ts"
  "src/services/production.service.ts"
  "src/services/user.service.ts"
  "src/services/messaging.service.ts"
  "src/services/search.service.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    # Check if API_BASE_URL is already defined
    if ! grep -q "const API_BASE_URL" "$file"; then
      echo "Adding API_BASE_URL to $file..."
      # Add after the imports section
      sed -i '0,/^import.*$/s||&\n\nconst API_BASE_URL = import.meta.env.VITE_API_URL || '\''https://pitchey-api-prod.ndlovucavelle.workers.dev'\'';|' "$file"
    fi
  fi
done

echo "Done!"