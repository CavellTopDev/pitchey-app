#!/bin/bash

# Deploy Pitchey Backend to Deno Deploy
# This script helps prepare the deployment

set -e

echo "🚀 Preparing Pitchey backend for Deno Deploy..."

# Check if required files exist
if [ ! -f "working-server.ts" ]; then
    echo "❌ Error: working-server.ts not found"
    exit 1
fi

if [ ! -f "deno.json" ]; then
    echo "❌ Error: deno.json not found"
    exit 1
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  Warning: DATABASE_URL not set"
    echo "   You'll need to set this in Deno Deploy dashboard"
fi

# Check if JWT_SECRET is set
if [ -z "$JWT_SECRET" ]; then
    echo "⚠️  Warning: JWT_SECRET not set"
    echo "   You'll need to set this in Deno Deploy dashboard"
fi

echo "✅ Pre-deployment checks complete"

# Test the server locally first
echo "🧪 Testing server locally..."
echo "   Run: deno task start"
echo "   Then test: curl http://localhost:8000/api/health"

echo ""
echo "📋 Next steps:"
echo "1. Commit and push your code to GitHub"
echo "2. Go to https://dash.deno.com/projects"
echo "3. Create a new project and connect your GitHub repo"
echo "4. Set entry point to: working-server.ts"
echo "5. Add environment variables:"
echo "   - DATABASE_URL (from Neon)"
echo "   - JWT_SECRET (generate a secure random string)"
echo "   - STRIPE_SECRET_KEY (optional)"
echo "   - FRONTEND_URL (https://pitchey-frontend.fly.dev)"
echo "6. Deploy!"
echo ""
echo "📖 For detailed instructions, see: DENO_DEPLOY_GUIDE.md"

# Generate a sample JWT secret
echo "🔑 Sample JWT_SECRET (use this or generate your own):"
openssl rand -base64 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_urlsafe(32))" 2>/dev/null || echo "your-super-secure-jwt-secret-at-least-32-characters-long"

echo ""
echo "🎉 Ready for deployment!"