#!/bin/bash

echo "Fixing ALL config.API_URL references in the codebase..."

# Fix in all TypeScript/TSX files
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "config\.API_URL" {} \; | while read -r file; do
  echo "Processing $file..."
  
  # Check if file already imports or defines API_URL
  if grep -q "const API_URL = " "$file"; then
    # File already has API_URL, just replace config.API_URL with API_URL
    sed -i 's/config\.API_URL/API_URL/g' "$file"
  elif grep -q "import.*API_URL" "$file"; then
    # File imports API_URL, just replace config.API_URL with API_URL
    sed -i 's/config\.API_URL/API_URL/g' "$file"
  else
    # Add API_URL import or definition after last import
    # First check if it's a service file or component file
    if [[ "$file" == *"/services/"* ]]; then
      # Service file - use API_BASE_URL if defined, else add it
      if grep -q "const API_BASE_URL" "$file"; then
        sed -i 's/config\.API_URL/API_BASE_URL/g' "$file"
      else
        # Add API_BASE_URL after imports
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
    else
      # Component/Page file - use import from config
      if grep -q "import.*config" "$file"; then
        # Already imports config, check what it imports
        sed -i 's/config\.API_URL/API_URL/g' "$file"
        # Make sure API_URL is imported from config
        if ! grep -q "API_URL" "$file" | head -1; then
          sed -i "s/import { config }/import { config, API_URL }/" "$file"
          sed -i "s/import config/import { API_URL }/" "$file"
        fi
      else
        # Add API_URL import
        if grep -q "^import.*from '\''.*config'\''" "$file"; then
          # Has config import, add API_URL to it
          sed -i "s/from '\''.*config'\''/& API_URL/" "$file"
        else
          # Add new import
          sed -i "1a import { API_URL } from '../config';" "$file"
        fi
        sed -i 's/config\.API_URL/API_URL/g' "$file"
      fi
    fi
  fi
  
  # Clean up any broken imports
  sed -i 's/import {  }/import/g' "$file"
  sed -i '/^import$/d' "$file"
done

echo "Done! All config.API_URL references have been fixed."

# Show summary
echo ""
echo "Summary of changes:"
echo "==================="
remaining=$(grep -r "config\.API_URL" src --include="*.ts" --include="*.tsx" | wc -l)
if [ "$remaining" -eq 0 ]; then
  echo "✓ All config.API_URL references have been successfully replaced!"
else
  echo "⚠ Warning: $remaining references to config.API_URL still remain:"
  grep -r "config\.API_URL" src --include="*.ts" --include="*.tsx" | head -5
fi