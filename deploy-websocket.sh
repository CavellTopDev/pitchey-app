#!/bin/bash

# WebSocket Deployment Script
# Deploys WebSocket-enabled version to Cloudflare Workers

echo "🚀 WebSocket Deployment Script"
echo "=============================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Step 1: Building frontend with production WebSocket URLs${NC}"
cd frontend
npm run build
if [ $? -ne 0 ]; then
    echo "Frontend build failed"
    exit 1
fi
cd ..

echo ""
echo -e "${BLUE}Step 2: Deploying Worker with WebSocket support${NC}"
echo "Deploying to: pitchey-api-prod.ndlovucavelle.workers.dev"

wrangler deploy

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Worker deployed successfully${NC}"
else
    echo "Worker deployment failed"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 3: Deploying frontend to Cloudflare Pages${NC}"

cd frontend
wrangler pages deploy dist --project-name=pitchey-5o8

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Frontend deployed successfully${NC}"
else
    echo "Frontend deployment failed"
    exit 1
fi

cd ..

echo ""
echo -e "${GREEN}🎉 WebSocket deployment complete!${NC}"
echo ""
echo "Production URLs:"
echo "  Frontend: https://pitchey-5o8.pages.dev"
echo "  API: https://pitchey-api-prod.ndlovucavelle.workers.dev"
echo "  WebSocket: wss://pitchey-api-prod.ndlovucavelle.workers.dev/ws"
echo ""
echo "Real-time features now enabled:"
echo "  ✓ Instant notifications"
echo "  ✓ Live presence tracking"
echo "  ✓ Real-time updates"
echo "  ✓ No more polling delays!"
echo ""
echo -e "${YELLOW}Note: Monitor the deployment for any issues${NC}"
echo "  - Check browser console for WebSocket connections"
echo "  - Verify notifications appear instantly"
echo "  - Test presence indicators"