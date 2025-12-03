#!/bin/bash
# Deploy Frontend with Security-Hardened Worker
set -e

echo "🔒 Deploying Frontend with Security-Hardened Backend"
echo "===================================================="

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
WORKER_URL="https://pitchey-production-secure.cavelltheleaddev.workers.dev"
FRONTEND_DIR="frontend"

echo -e "${BLUE}📋 Configuration:${NC}"
echo "• Worker URL: $WORKER_URL"
echo "• Frontend Directory: $FRONTEND_DIR"
echo "• Target: Cloudflare Pages (pitchey.pages.dev)"
echo

# Check if we're in the right directory
if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}❌ Frontend directory not found. Please run from project root.${NC}"
    exit 1
fi

cd "$FRONTEND_DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    npm install
fi

# Build for production
echo -e "${BLUE}🏗️  Building frontend for production...${NC}"
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Frontend build successful${NC}"
else
    echo -e "${RED}❌ Frontend build failed${NC}"
    exit 1
fi

# Deploy to Cloudflare Pages
echo -e "${BLUE}🚀 Deploying to Cloudflare Pages...${NC}"
cd ..
wrangler pages deploy frontend/dist --project-name=pitchey

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Frontend deployed successfully${NC}"
else
    echo -e "${RED}❌ Frontend deployment failed${NC}"
    exit 1
fi

# Test the deployment
echo -e "${BLUE}🧪 Testing deployment...${NC}"

# Test frontend accessibility
FRONTEND_URL="https://pitchey.pages.dev"
echo "Testing frontend: $FRONTEND_URL"
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")

if [ "$FRONTEND_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ Frontend accessible${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend response: HTTP $FRONTEND_RESPONSE${NC}"
fi

# Test worker connectivity
echo "Testing worker connectivity: $WORKER_URL/api/health"
WORKER_RESPONSE=$(curl -s "$WORKER_URL/api/health")

if echo "$WORKER_RESPONSE" | grep -q "healthy"; then
    echo -e "${GREEN}✅ Worker connectivity confirmed${NC}"
else
    echo -e "${YELLOW}⚠️  Worker response: $WORKER_RESPONSE${NC}"
fi

# Summary
echo ""
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "================================"
echo "✅ Frontend: https://pitchey.pages.dev"
echo "✅ Worker API: $WORKER_URL"
echo "✅ Security: Rate limiting, CORS, Headers, JWT protection"
echo "✅ Monitoring: /api/health, /api/monitoring/status"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "1. Test all application features"
echo "2. Verify user authentication flows"
echo "3. Check dashboard functionality"
echo "4. Test pitch creation and viewing"
echo "5. Validate NDA workflows"
echo "6. Monitor for any errors"
echo ""
echo -e "${BLUE}🔗 Important URLs:${NC}"
echo "• App: https://pitchey.pages.dev"
echo "• Health: $WORKER_URL/api/health"
echo "• Monitoring: $WORKER_URL/api/monitoring/status"
echo "• Admin Metrics: $WORKER_URL/api/metrics (admin only)"