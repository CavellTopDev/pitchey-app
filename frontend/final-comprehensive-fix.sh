#!/bin/bash

echo "Final comprehensive syntax fix..."

# Fix all instances of broken fetch calls with missing URLs
find src -type f \( -name "*.ts" -o -name "*.tsx" \) | while read file; do
  # Fix 'const response = await' without fetch
  if grep -q "const response = await$" "$file"; then
    echo "Fixing incomplete fetch in: $file"
    sed -i '/const response = await$/d' "$file"
  fi
  
  # Fix lines with just 'credentials:' followed by nothing
  sed -i '/^\s*credentials:$/d' "$file"
  
  # Fix body: JSON.stringify({ followed immediately by credentials
  sed -i 's/body: JSON.stringify({$/body: JSON.stringify({}),/' "$file"
  
  # Ensure credentials line has proper comma before it
  perl -i -pe 's/([^,])\n(\s*)credentials: .include./\1,\n\2credentials: "include"/g' "$file"
done

echo "Checking for any remaining syntax issues..."
grep -r "credentials:$" src --include="*.tsx" --include="*.ts" | head -5 || echo "No dangling credentials found"
grep -r "const response = await$" src --include="*.tsx" --include="*.ts" | head -5 || echo "No incomplete awaits found"

echo "Done!"
