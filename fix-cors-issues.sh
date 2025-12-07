#!/bin/bash

# Script to fix CORS issues in worker-production-db.ts
# This will replace jsonResponse with corsResponse where needed

echo "🔧 Fixing CORS issues in worker-production-db.ts..."

# Backup the original file
cp src/worker-production-db.ts src/worker-production-db.ts.backup

# Replace all jsonResponse calls with corsResponse
# This ensures all responses include proper CORS headers
sed -i 's/return jsonResponse(/return corsResponse(request, /g' src/worker-production-db.ts

# Fix cases where jsonResponse is called with status parameter
# Pattern: jsonResponse(data, status) -> corsResponse(request, data, status)
sed -i 's/return jsonResponse(\([^,]*\), \([0-9]*\))/return corsResponse(request, \1, \2)/g' src/worker-production-db.ts

# Fix cases where jsonResponse is called with status and headers
# Pattern: jsonResponse(data, status, headers) -> corsResponse(request, data, status)
sed -i 's/return jsonResponse(\([^,]*\), \([0-9]*\), \([^)]*\))/return corsResponse(request, \1, \2)/g' src/worker-production-db.ts

# Special case: Fix standalone jsonResponse calls (not return statements)
sed -i 's/jsonResponse(/corsResponse(request, /g' src/worker-production-db.ts

# Fix double request parameters that might have been introduced
sed -i 's/corsResponse(request, request,/corsResponse(request,/g' src/worker-production-db.ts

echo "✅ Replaced all jsonResponse calls with corsResponse"

# Count the changes
echo "📊 Statistics:"
echo "  - Total corsResponse calls: $(grep -c "corsResponse" src/worker-production-db.ts)"
echo "  - Remaining jsonResponse calls: $(grep -c "jsonResponse" src/worker-production-db.ts)"

echo "🔍 Checking for any remaining issues..."
if grep -q "jsonResponse(" src/worker-production-db.ts; then
    echo "⚠️  Warning: Some jsonResponse calls may still remain. Manual review recommended."
    grep -n "jsonResponse(" src/worker-production-db.ts | head -5
else
    echo "✅ All jsonResponse calls have been replaced!"
fi

echo ""
echo "📝 Next steps:"
echo "1. Review the changes with: diff src/worker-production-db.ts.backup src/worker-production-db.ts"
echo "2. Test locally with: PORT=8001 deno run --allow-all working-server.ts"
echo "3. Deploy with: wrangler deploy"