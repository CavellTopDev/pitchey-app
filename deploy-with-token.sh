#!/bin/bash

# =================================================================
# Cloudflare Pages Deployment with API Token
# =================================================================

echo "🚀 Deploying Frontend to Cloudflare Pages"
echo "========================================="
echo ""

# Check if API token is provided
if [ -z "$1" ]; then
    echo "❌ Error: Please provide your Cloudflare API token"
    echo ""
    echo "Usage: ./deploy-with-token.sh YOUR_CLOUDFLARE_API_TOKEN"
    echo ""
    echo "To get your API token:"
    echo "1. Go to https://dash.cloudflare.com/profile/api-tokens"
    echo "2. Create a token with 'Cloudflare Pages:Edit' permission"
    echo "3. Copy the token and run this script again"
    echo ""
    exit 1
fi

# Set the API token
export CLOUDFLARE_API_TOKEN="$1"

echo "📦 Using provided API token..."
echo ""

# Check if frontend is already built
if [ ! -d "frontend/dist" ]; then
    echo "⚠️  Frontend not built. Building now..."
    cd frontend
    VITE_API_URL=https://pitchey-api-prod.ndlovucavelle.workers.dev \
    VITE_WS_URL=wss://pitchey-api-prod.ndlovucavelle.workers.dev \
    npm run build
    cd ..
fi

echo "🚀 Deploying to Cloudflare Pages..."
echo ""

# Deploy with API token
wrangler pages deploy frontend/dist \
    --project-name=pitchey-5o8-66n \
    --branch=main \
    --commit-message="Frontend deployment with Worker API connection"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment Successful!"
    echo "========================================="
    echo "🌐 Frontend: https://pitchey-5o8-66n.pages.dev"
    echo "🔌 API: https://pitchey-api-prod.ndlovucavelle.workers.dev"
    echo ""
    echo "Test the connection by visiting:"
    echo "https://pitchey-5o8-66n.pages.dev"
else
    echo ""
    echo "❌ Deployment failed. Please check your API token."
fi