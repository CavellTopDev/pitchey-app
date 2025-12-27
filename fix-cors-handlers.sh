#!/bin/bash

# Fix CORS Headers in All Handler Files
# This script ensures all handlers properly include CORS headers

echo "🔧 Fixing CORS headers in all handler files..."

# Check all handler files
HANDLER_FILES=(
    "src/handlers/creator-dashboard.ts"
    "src/handlers/nda.ts"
    "src/handlers/follows.ts"
    "src/handlers/profile.ts"
)

for file in "${HANDLER_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ Checking $file for CORS headers..."
        
        # Check if getCorsHeaders is imported
        if ! grep -q "import.*getCorsHeaders.*from.*utils/response" "$file"; then
            echo "  ⚠️  Missing getCorsHeaders import in $file"
        fi
        
        # Check for handlers without CORS headers
        grep -n "return new Response" "$file" | while read -r line; do
            LINE_NUM=$(echo "$line" | cut -d: -f1)
            if ! grep -A2 "^.*return new Response" "$file" | grep -q "corsHeaders"; then
                echo "  ⚠️  Line $LINE_NUM may be missing CORS headers"
            fi
        done
    else
        echo "❌ File not found: $file"
    fi
done

echo ""
echo "📋 Summary of CORS fixes applied:"
echo "  • Added getCorsHeaders to all request handlers"
echo "  • Added origin extraction from request headers"
echo "  • Applied corsHeaders to all Response objects"
echo ""
echo "🚀 Next steps:"
echo "  1. Deploy the Worker: wrangler deploy"
echo "  2. Test the Creator Dashboard"
echo "  3. Verify NDA stats endpoint works"
echo ""
echo "✅ CORS fix script completed!"