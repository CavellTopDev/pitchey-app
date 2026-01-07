#!/bin/bash

# Pitchey Frontend Deployment Script for Cloudflare Pages
# This script builds and deploys the frontend to Cloudflare Pages

echo "🚀 Starting Pitchey Frontend Deployment"
echo "======================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "frontend" ]; then
    echo -e "${RED}Error: Must be run from the project root directory${NC}"
    exit 1
fi

# Build the frontend
echo -e "${YELLOW}📦 Building frontend...${NC}"
cd frontend
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"

# Go back to root
cd ..

# Deploy to Cloudflare Pages
echo -e "${YELLOW}☁️  Deploying to Cloudflare Pages...${NC}"

# Method 1: Try with wrangler.json config
if [ -f "wrangler.json" ]; then
    echo "Using wrangler.json configuration..."
    wrangler pages deploy frontend/dist --project-name=pitchey
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Deployment successful!${NC}"
        echo "Your app is available at: https://pitchey.pages.dev"
        exit 0
    else
        echo -e "${YELLOW}⚠️  Deployment with wrangler.json failed, trying alternative method...${NC}"
    fi
fi

# Method 2: Direct deployment without config file
echo "Attempting direct deployment..."
wrangler pages deploy frontend/dist \
    --project-name=pitchey \
    --compatibility-date=2026-01-05 \
    --no-bundle

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo "Your app is available at: https://pitchey.pages.dev"
else
    echo -e "${RED}❌ Deployment failed${NC}"
    echo ""
    echo "Please ensure you're authenticated with Cloudflare:"
    echo "  wrangler login"
    echo ""
    echo "Or set your API token:"
    echo "  export CLOUDFLARE_API_TOKEN=your-api-token"
    echo ""
    echo "You can also deploy via GitHub Actions by pushing to main branch."
    exit 1
fi