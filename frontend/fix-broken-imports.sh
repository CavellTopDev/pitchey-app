#!/bin/bash

echo "Fixing broken import statements..."

# Find all TypeScript files where API_BASE_URL was inserted in the middle of an import
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "const API_BASE_URL" {} \; | while read -r file; do
  # Check if the file has the problematic pattern (const API_BASE_URL inside an import block)
  if grep -B2 "const API_BASE_URL" "$file" | grep -q "import type {"; then
    echo "Fixing $file..."
    
    # Create a temporary file
    tmpfile=$(mktemp)
    
    # Fix the file by moving API_BASE_URL after the import block
    awk '
    /^import type {/ { 
      in_import = 1
      print
      next
    }
    /^const API_BASE_URL/ && in_import {
      # Store the API_BASE_URL line for later
      api_line = $0
      next
    }
    /^}.*from/ && in_import {
      print
      in_import = 0
      print ""
      print api_line
      next
    }
    { print }
    ' "$file" > "$tmpfile"
    
    # Replace the original file
    mv "$tmpfile" "$file"
  fi
done

echo "Done fixing import statements!"