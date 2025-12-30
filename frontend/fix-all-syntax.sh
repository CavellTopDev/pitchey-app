#!/bin/bash

echo "Fixing all missing commas before credentials..."

# Find all files with missing comma before credentials
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "body: JSON.stringify.*[^,]$" {} \; | while read file; do
  # Fix missing comma after JSON.stringify
  sed -i 's/body: JSON.stringify(\([^)]*\))$/body: JSON.stringify(\1),/' "$file"
  sed -i 's/body: formData$/body: formData,/' "$file"
  echo "Fixed: $file"
done

# Fix credentials without proper syntax
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "^\s*credentials: 'include'" {} \; | while read file; do
  # Check if previous line ends with comma, if not add it
  sed -i '/credentials: .include./{N;s/\([^,]\)\n\s*credentials:/\1,\n      credentials:/;}' "$file"
  echo "Checked credentials in: $file"
done

echo "All syntax fixes applied!"
