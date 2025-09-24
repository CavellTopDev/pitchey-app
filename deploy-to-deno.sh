#!/bin/bash

# Deploy to Deno Deploy Script

echo "================================================"
echo "Deploying Pitchey Backend to Deno Deploy"
echo "================================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Project name (should match your existing Deno Deploy project)
PROJECT_NAME="pitchey-backend"

echo -e "\n${YELLOW}1. Checking environment...${NC}"

# Check if deployctl is installed
if ! command -v deployctl &> /dev/null; then
    echo -e "${RED}❌ deployctl is not installed${NC}"
    echo "Install with: deno install -A https://deno.land/x/deploy/deployctl.ts"
    exit 1
fi

echo -e "${GREEN}✓ deployctl is installed${NC}"

# Check if we're in the right directory
if [ ! -f "working-server.ts" ]; then
    echo -e "${RED}❌ working-server.ts not found${NC}"
    echo "Please run this script from the project root"
    exit 1
fi

echo -e "${GREEN}✓ Found working-server.ts${NC}"

echo -e "\n${YELLOW}2. Environment Variables${NC}"
echo "The following environment variables need to be set in Deno Deploy:"
echo "  - DATABASE_URL (Neon PostgreSQL)"
echo "  - JWT_SECRET"
echo "  - FRONTEND_URL"
echo ""
echo "Current DATABASE_URL in .env:"
grep "^DATABASE_URL=" .env | cut -c1-80
echo ""

echo -e "\n${YELLOW}3. Pre-deployment checks${NC}"

# Test that the server runs locally
echo "Testing server startup..."
timeout 3s deno run --allow-all working-server.ts > /dev/null 2>&1
if [ $? -eq 124 ]; then
    echo -e "${GREEN}✓ Server starts without errors${NC}"
else
    echo -e "${YELLOW}⚠ Server may have issues, continuing anyway${NC}"
fi

echo -e "\n${YELLOW}4. Deploying to Deno Deploy${NC}"
echo "Deploying as project: $PROJECT_NAME"
echo ""

# Deploy command with explicit project name
deployctl deploy \
  --project="$PROJECT_NAME" \
  --entrypoint="working-server.ts" \
  --import-map="deno.json" \
  --env-file=".env"

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ Deployment successful!${NC}"
    echo ""
    echo "Your backend should now be available at:"
    echo "https://${PROJECT_NAME}-*.deno.dev"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Go to https://dash.deno.com/projects/${PROJECT_NAME}/settings"
    echo "2. Verify environment variables are set:"
    echo "   - DATABASE_URL"
    echo "   - JWT_SECRET"
    echo "   - FRONTEND_URL"
    echo ""
    echo "3. Test the deployment:"
    echo "   curl https://${PROJECT_NAME}-*.deno.dev/api/health"
    echo ""
    echo "4. Test demo login:"
    echo "   curl -X POST https://${PROJECT_NAME}-*.deno.dev/api/auth/creator/login \\"
    echo "     -H 'Content-Type: application/json' \\"
    echo "     -d '{\"email\":\"alex.creator@demo.com\",\"password\":\"Demo123\"}'"
else
    echo -e "\n${RED}❌ Deployment failed${NC}"
    echo "Please check the error messages above"
    exit 1
fi