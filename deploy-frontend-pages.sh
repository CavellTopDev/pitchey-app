#!/bin/bash

# =================================================================
# Cloudflare Pages Frontend Deployment Script
# Deploys frontend to pitchey-5o8-66n.pages.dev
# Connects to Worker API at pitchey-api-prod.ndlovucavelle.workers.dev
# =================================================================

set -e  # Exit on any error

echo "🚀 Pitchey Frontend Pages Deployment"
echo "===================================="
echo "Target: pitchey-5o8-66n.pages.dev"
echo "API: pitchey-api-prod.ndlovucavelle.workers.dev"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in project root directory"
    echo "Please run from /home/supremeisbeing/pitcheymovie/pitchey_v0.2"
    exit 1
fi

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "📦 Installing Wrangler CLI..."
    npm install -g wrangler@latest
fi

echo "🔧 Step 1: Building Frontend with Production API URL"
echo "----------------------------------------------------"

# Navigate to frontend directory
cd frontend

# Ensure dependencies are installed
echo "📦 Installing frontend dependencies..."
npm ci

# Build with production API URL
echo "🏗️ Building frontend for production..."
VITE_API_URL=https://pitchey-api-prod.ndlovucavelle.workers.dev \
VITE_WS_URL=wss://pitchey-api-prod.ndlovucavelle.workers.dev \
VITE_APP_URL=https://pitchey-5o8-66n.pages.dev \
NODE_ENV=production \
npm run build

echo "✅ Frontend build complete"
echo ""

# Check build output
if [ ! -d "dist" ]; then
    echo "❌ Error: dist directory not found after build"
    exit 1
fi

echo "📊 Build size:"
du -sh dist/
echo ""

# Go back to project root
cd ..

echo "🚀 Step 2: Deploying to Cloudflare Pages"
echo "----------------------------------------"

# Deploy to Cloudflare Pages
echo "📤 Uploading to Cloudflare Pages..."
wrangler pages deploy frontend/dist \
  --project-name=pitchey-5o8-66n \
  --branch=main \
  --commit-message="Deploy frontend with Worker API connection"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment Successful!"
    echo "===================================="
    echo "🌐 Frontend URL: https://pitchey-5o8-66n.pages.dev"
    echo "🔌 Connected to API: https://pitchey-api-prod.ndlovucavelle.workers.dev"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Visit https://pitchey-5o8-66n.pages.dev to verify deployment"
    echo "2. Check browser console for any errors"
    echo "3. Test API connection by logging in with demo accounts"
    echo ""
    echo "🔑 Demo Accounts (Password: Demo123):"
    echo "   Creator: alex.creator@demo.com"
    echo "   Investor: sarah.investor@demo.com"
    echo "   Production: stellar.production@demo.com"
else
    echo ""
    echo "❌ Deployment failed!"
    echo "Please check the error messages above."
    echo ""
    echo "Common issues:"
    echo "1. Missing CLOUDFLARE_API_TOKEN - set with: export CLOUDFLARE_API_TOKEN='your-token'"
    echo "2. Wrong project name - verify in Cloudflare dashboard"
    echo "3. Build errors - check frontend/dist exists"
    exit 1
fi