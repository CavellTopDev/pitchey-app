#!/bin/bash

# Fix all config.API_URL references in service files
echo "Fixing config.API_URL references in all service files..."

# Files to fix
files=(
  "src/services/analytics.service.ts"
  "src/services/enhanced-upload.service.ts"
  "src/services/upload.service.ts"
  "src/services/investor.service.ts"
  "src/services/metrics.service.ts"
  "src/services/auth-secure.service.ts"
  "src/services/creator.service.ts"
  "src/services/presence-fallback.service.ts"
  "src/services/production.service.ts"
  "src/services/user.service.ts"
  "src/services/messaging.service.ts"
  "src/services/search.service.ts"
  "src/services/nda.service.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."
    
    # Check if file already has API_BASE_URL defined
    if grep -q "const API_BASE_URL" "$file"; then
      # Replace config.API_URL with API_BASE_URL
      sed -i 's/config\.API_URL/API_BASE_URL/g' "$file"
    else
      # Add API_BASE_URL definition at the top of the file (after imports)
      # and replace config.API_URL references
      sed -i '1,/^import/ { 
        /^import/!b; 
        :a; 
        n; 
        /^import/ba;
        i\
\
const API_BASE_URL = import.meta.env.VITE_API_URL || '\''https://pitchey-api-prod.ndlovucavelle.workers.dev'\'';
      }' "$file"
      sed -i 's/config\.API_URL/API_BASE_URL/g' "$file"
    fi
    
    # Also remove any import of config if it exists and is not used elsewhere
    # Check if config is used for anything other than API_URL
    if ! grep -q "config\." "$file" | grep -v "config\.API_URL"; then
      sed -i "/import.*config.*from.*config/d" "$file"
    fi
  fi
done

echo "Done! Fixed all config.API_URL references."