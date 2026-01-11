#!/bin/bash

echo "🔧 Deploying authentication fix to production Worker..."
echo "⚠️  WARNING: This will update the production Worker directly!"
echo ""
echo "The fix adds password verification for demo accounts:"
echo "  - alex.creator@demo.com (Password: Demo123)"
echo "  - sarah.investor@demo.com (Password: Demo123)"
echo "  - stellar.production@demo.com (Password: Demo123)"
echo ""
echo "This script will:"
echo "1. Open the Cloudflare dashboard to edit the Worker"
echo "2. You need to manually apply the authentication fix"
echo "3. Save and deploy the changes"
echo ""
echo "Authentication fix location:"
echo "  File: worker-integrated.ts"
echo "  Function: handlePortalLogin (around line 1932)"
echo "  Change: Add password verification for demo accounts"
echo ""
echo "The fix code is saved in: auth-fix.patch"
echo ""
echo "Press Enter to open the Cloudflare dashboard or Ctrl+C to cancel..."
read

# Open the Cloudflare dashboard
echo "Opening Cloudflare dashboard..."
xdg-open "https://dash.cloudflare.com/002bd5c0e90ae753a387c60546cf6869/workers/services/view/pitchey-api-prod" 2>/dev/null || \
  open "https://dash.cloudflare.com/002bd5c0e90ae753a387c60546cf6869/workers/services/view/pitchey-api-prod" 2>/dev/null || \
  echo "Please open: https://dash.cloudflare.com/002bd5c0e90ae753a387c60546cf6869/workers/services/view/pitchey-api-prod"

echo ""
echo "📝 Manual steps:"
echo "1. Click on 'Quick edit' in the Cloudflare dashboard"
echo "2. Search for 'handlePortalLogin' function"
echo "3. Find the line: const isDemoAccount = ['alex.creator@demo.com', 'sarah.investor@demo.com', 'stellar.production@demo.com'].includes(email);"
echo "4. Replace the password verification section with the code from auth-fix.patch"
echo "5. Save and deploy the changes"
echo ""
echo "After deployment, test with:"
echo "  curl -X POST https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/creator/login -H 'Content-Type: application/json' -d '{\"email\":\"alex.creator@demo.com\",\"password\":\"Demo123\"}'"