#!/bin/bash

# Verify Cloudflare API Token
# This script helps verify your Cloudflare API token has the correct permissions

echo "🔍 Cloudflare API Token Verification Script"
echo "==========================================="
echo ""

# Check if token is provided as argument or environment variable
if [ -n "$1" ]; then
    TOKEN="$1"
elif [ -n "$CLOUDFLARE_API_TOKEN" ]; then
    TOKEN="$CLOUDFLARE_API_TOKEN"
else
    echo "❌ Error: No API token provided"
    echo "Usage: $0 <your-api-token>"
    echo "Or set CLOUDFLARE_API_TOKEN environment variable"
    exit 1
fi

echo "📝 Token format check..."
# Check token length (should be 40 characters for valid Cloudflare tokens)
TOKEN_LENGTH=${#TOKEN}
echo "   Token length: $TOKEN_LENGTH characters"

if [ $TOKEN_LENGTH -lt 30 ] || [ $TOKEN_LENGTH -gt 50 ]; then
    echo "   ⚠️  Warning: Token length seems unusual (expected ~40 characters)"
fi

echo ""
echo "🔐 Testing API token validity..."
RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" https://api.cloudflare.com/client/v4/user)
SUCCESS=$(echo $RESPONSE | jq -r '.success')

if [ "$SUCCESS" = "true" ]; then
    echo "   ✅ Token is valid!"
    
    # Get user details
    EMAIL=$(echo $RESPONSE | jq -r '.result.email')
    ID=$(echo $RESPONSE | jq -r '.result.id')
    echo "   📧 Email: $EMAIL"
    echo "   🆔 User ID: $ID"
else
    echo "   ❌ Token is invalid!"
    ERROR_CODE=$(echo $RESPONSE | jq -r '.errors[0].code')
    ERROR_MSG=$(echo $RESPONSE | jq -r '.errors[0].message')
    echo "   Error Code: $ERROR_CODE"
    echo "   Error Message: $ERROR_MSG"
    echo ""
    echo "🔧 How to fix:"
    echo "1. Go to: https://dash.cloudflare.com/profile/api-tokens"
    echo "2. Click 'Create Token'"
    echo "3. Use 'Custom token' template"
    echo "4. Add these permissions:"
    echo "   - Account: Cloudflare Pages:Edit"
    echo "   - Account: Workers Scripts:Edit"
    echo "   - User: User Details:Read"
    echo "5. Copy the token (it looks like: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')"
    exit 1
fi

echo ""
echo "🔍 Checking token permissions..."

# Test Pages API access
echo -n "   Testing Pages API access... "
PAGES_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "https://api.cloudflare.com/client/v4/accounts/002bd5c0e90ae753a387c60546cf6869/pages/projects")
PAGES_SUCCESS=$(echo $PAGES_RESPONSE | jq -r '.success')

if [ "$PAGES_SUCCESS" = "true" ]; then
    echo "✅ OK"
else
    echo "❌ FAILED"
    echo "      Error: $(echo $PAGES_RESPONSE | jq -r '.errors[0].message')"
fi

# Test Workers API access
echo -n "   Testing Workers API access... "
WORKERS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "https://api.cloudflare.com/client/v4/accounts/002bd5c0e90ae753a387c60546cf6869/workers/scripts")
WORKERS_SUCCESS=$(echo $WORKERS_RESPONSE | jq -r '.success')

if [ "$WORKERS_SUCCESS" = "true" ]; then
    echo "✅ OK"
else
    echo "❌ FAILED"
    echo "      Error: $(echo $WORKERS_RESPONSE | jq -r '.errors[0].message')"
fi

echo ""
echo "📋 Summary:"
if [ "$PAGES_SUCCESS" = "true" ] && [ "$WORKERS_SUCCESS" = "true" ]; then
    echo "   ✅ Token has all required permissions!"
    echo ""
    echo "🚀 Next steps:"
    echo "1. Update GitHub secret:"
    echo "   gh secret set CLOUDFLARE_API_TOKEN --repo CavellTopDev/pitchey-app"
    echo "2. Paste the token when prompted"
    echo "3. Re-run the deployment workflow"
else
    echo "   ❌ Token is missing required permissions"
    echo "   Please create a new token with the correct permissions"
fi