#!/bin/bash

# Instant Production Diagnosis Script
# Run this to see EXACTLY why your fixes aren't working

echo "🔍 DIAGNOSING YOUR DEPLOYMENT..."
echo "================================"
echo ""

# 1. Check latest commit
echo "📝 Your Latest Commit:"
git log --oneline -1
LATEST_COMMIT=$(git log --format="%h" -n 1)
echo ""

# 2. Check GitHub Actions status
echo "🚀 GitHub Actions Status:"
gh run list --limit 3 --json status,conclusion,name,displayTitle | jq -r '.[] | "\(.conclusion // "running") | \(.name) | \(.displayTitle)"'
echo ""

# 3. Check what's deployed to production
echo "🌐 Production Backend Status:"
DEPLOYED_COMMIT=$(curl -s https://pitchey-backend-fresh.deno.dev/health | jq -r '.commit // "ERROR"')
if [ "$DEPLOYED_COMMIT" = "ERROR" ]; then
    echo "❌ Backend is DOWN or not responding"
else
    echo "✅ Backend is UP"
    echo "   Deployed commit: $DEPLOYED_COMMIT"
    echo "   Latest commit:   $LATEST_COMMIT"
    
    if [ "$DEPLOYED_COMMIT" = "$LATEST_COMMIT" ]; then
        echo "   ✅ MATCH - Your latest code IS deployed"
    else
        echo "   ❌ MISMATCH - Production is running OLD CODE"
        echo "   → This is why your fixes don't work!"
    fi
fi
echo ""

# 4. Check if deployments are failing
LAST_DEPLOYMENT=$(gh run list --limit 1 --json conclusion | jq -r '.[0].conclusion')
echo "📊 Last Deployment Result: $LAST_DEPLOYMENT"
if [ "$LAST_DEPLOYMENT" = "failure" ]; then
    echo "❌ DEPLOYMENTS ARE FAILING!"
    echo "   Run this to see why: gh run view --log-failed"
    echo ""
    echo "🔧 Common fixes:"
    echo "   1. Update .github/workflows/deploy.yml to use official Deno action"
    echo "   2. Check Deno Deploy has correct environment variables"
    echo "   3. Verify project name matches (pitchey-backend-fresh)"
elif [ "$LAST_DEPLOYMENT" = "success" ]; then
    echo "✅ Deployments are working"
else
    echo "⏳ Deployment in progress..."
fi
echo ""

# 5. Test production auth
echo "🔐 Testing Production Auth:"
AUTH_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST https://pitchey-backend-fresh.deno.dev/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}')

HTTP_CODE=$(echo "$AUTH_RESPONSE" | tail -n1)
BODY=$(echo "$AUTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Auth works (HTTP $HTTP_CODE)"
    USER_ID=$(echo "$BODY" | jq -r '.user.id // "null"')
    TOKEN_USER_ID=$(echo "$BODY" | jq -r '.token' | cut -d. -f2 | base64 -d 2>/dev/null | jq -r '.userId // "null"')
    
    echo "   User ID in response: $USER_ID"
    echo "   User ID in token:    $TOKEN_USER_ID"
    
    if [ "$USER_ID" = "$TOKEN_USER_ID" ]; then
        echo "   ✅ Token has correct user ID"
    else
        echo "   ❌ TOKEN MISMATCH - This breaks WebSocket!"
        echo "   → This is a known bug, needs backend fix"
    fi
else
    echo "❌ Auth failed (HTTP $HTTP_CODE)"
    echo "   Response: $BODY"
fi
echo ""

# 6. Final diagnosis
echo "================================"
echo "🎯 DIAGNOSIS:"
echo ""

if [ "$LAST_DEPLOYMENT" = "failure" ]; then
    echo "❌ PRIMARY ISSUE: Deployments are failing"
    echo "   → Fix deployment workflow first"
    echo "   → Run: gh run view --log-failed"
elif [ "$DEPLOYED_COMMIT" != "$LATEST_COMMIT" ]; then
    echo "❌ PRIMARY ISSUE: Old code deployed"
    echo "   → Wait for deployment to complete"
    echo "   → Or trigger manual deployment"
elif [ "$USER_ID" != "$TOKEN_USER_ID" ]; then
    echo "❌ PRIMARY ISSUE: Token has wrong user ID"
    echo "   → Backend bug in auth service"
    echo "   → Check JWT token generation code"
else
    echo "✅ Everything looks good!"
    echo "   → If WebSocket still fails, check browser console"
    echo "   → Clear localStorage and try again"
fi
echo ""

echo "💡 Next Steps:"
echo "1. Fix the primary issue above"
echo "2. Wait for deployment (gh run watch)"
echo "3. Go to https://pitchey-5o8.pages.dev/"
echo "4. Press F12 → Console"
echo "5. Clear localStorage: localStorage.clear()"
echo "6. Refresh page (Ctrl+Shift+R)"
echo "7. Log in and check for errors"
echo ""
echo "📸 If still broken, screenshot console and share it!"