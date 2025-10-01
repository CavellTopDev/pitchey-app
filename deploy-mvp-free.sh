#!/bin/bash

# 🚀 FREE MVP Deployment Script
# Deploys your entire app using only free services

echo "================================================"
echo "🚀 FREE MVP DEPLOYMENT - Zero Cost Setup"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Step tracking
CURRENT_STEP=0
TOTAL_STEPS=5

step() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    echo -e "\n${BLUE}[$CURRENT_STEP/$TOTAL_STEPS]${NC} $1"
    echo "----------------------------------------"
}

# Check prerequisites
step "Checking Prerequisites"

# Check for required tools
MISSING_TOOLS=""

if ! command -v deno &> /dev/null; then
    MISSING_TOOLS="$MISSING_TOOLS deno"
fi

if ! command -v npm &> /dev/null; then
    MISSING_TOOLS="$MISSING_TOOLS npm"
fi

if ! command -v git &> /dev/null; then
    MISSING_TOOLS="$MISSING_TOOLS git"
fi

if [ ! -z "$MISSING_TOOLS" ]; then
    echo -e "${RED}❌ Missing required tools:${NC}$MISSING_TOOLS"
    echo ""
    echo "Install instructions:"
    echo "  deno: curl -fsSL https://deno.land/install.sh | sh"
    echo "  npm: https://nodejs.org/"
    echo "  git: https://git-scm.com/"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites installed${NC}"

# Environment setup
step "Setting Up Free Services"

echo -e "${YELLOW}📝 You'll need FREE accounts for:${NC}"
echo ""
echo "1. Neon (PostgreSQL): https://neon.tech"
echo "   - Sign up and create a database"
echo "   - Copy the connection string"
echo ""
echo "2. Deno Deploy: https://deno.com/deploy"
echo "   - Sign in with GitHub"
echo "   - Create a new project"
echo ""
echo "3. Vercel (Frontend): https://vercel.com"
echo "   - Sign in with GitHub"
echo "   - Install Vercel CLI: npm i -g vercel"
echo ""
echo "4. Upstash Redis (Optional): https://upstash.com"
echo "   - Create a Redis database"
echo "   - Copy REST URL and token"
echo ""

read -p "Have you created these accounts? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please create the accounts first, then run this script again."
    exit 1
fi

# Create .env.production file
step "Creating Production Environment File"

if [ ! -f .env.production ]; then
    cat > .env.production << 'EOF'
# Database (Required - from Neon)
DATABASE_URL=

# Authentication (Required - generate with: openssl rand -base64 32)
JWT_SECRET=

# Frontend URL (Update after Vercel deployment)
FRONTEND_URL=https://your-app.vercel.app

# Upstash Redis (Optional - for distributed caching)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Set to production
NODE_ENV=production
DENO_ENV=production
EOF
    echo -e "${GREEN}✅ Created .env.production${NC}"
    echo ""
    echo -e "${YELLOW}Please edit .env.production and add:${NC}"
    echo "  1. DATABASE_URL from Neon"
    echo "  2. Generate JWT_SECRET: openssl rand -base64 32"
    echo "  3. (Optional) Upstash Redis credentials"
    echo ""
    read -p "Press Enter after updating .env.production..."
else
    echo -e "${GREEN}✅ .env.production exists${NC}"
fi

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# Verify required environment variables
if [ -z "$DATABASE_URL" ] || [ -z "$JWT_SECRET" ]; then
    echo -e "${RED}❌ Missing required environment variables in .env.production${NC}"
    echo "Please ensure DATABASE_URL and JWT_SECRET are set"
    exit 1
fi

# Build frontend
step "Building Frontend for Production"

cd frontend
echo "Installing dependencies..."
npm install

echo "Building production bundle..."
VITE_API_URL=https://pitchey-backend.deno.dev npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Frontend built successfully${NC}"
else
    echo -e "${RED}❌ Frontend build failed${NC}"
    exit 1
fi

cd ..

# Deploy Backend to Deno Deploy
step "Deploying Backend to Deno Deploy"

echo -e "${YELLOW}Installing deployctl if needed...${NC}"
if ! command -v deployctl &> /dev/null; then
    deno install --allow-all --no-check -r -f https://deno.land/x/deploy/deployctl.ts
fi

echo ""
echo -e "${YELLOW}Deploying to Deno Deploy...${NC}"
echo "Project name: pitchey-backend"
echo ""

# Create deployment script with environment variables
cat > deploy-backend.ts << 'EOF'
// Temporary deployment configuration
import { load } from "https://deno.land/std@0.210.0/dotenv/mod.ts";

const env = await load({ envPath: ".env.production" });

const deployCommand = [
  "deployctl",
  "deploy",
  "--project=pitchey-backend",
  "--entrypoint=working-server.ts",
];

// Add environment variables
for (const [key, value] of Object.entries(env)) {
  if (value && !key.startsWith("#")) {
    deployCommand.push(`--env=${key}=${value}`);
  }
}

const p = new Deno.Command("deployctl", {
  args: deployCommand.slice(1),
  stdout: "inherit",
  stderr: "inherit",
});

const { code } = await p.output();
Deno.exit(code);
EOF

deno run --allow-all deploy-backend.ts

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backend deployed to Deno Deploy${NC}"
    echo "URL: https://pitchey-backend.deno.dev"
    
    # Update frontend with backend URL
    echo "VITE_API_URL=https://pitchey-backend.deno.dev" > frontend/.env.production
else
    echo -e "${RED}❌ Backend deployment failed${NC}"
    echo "Try manual deployment:"
    echo "  deployctl deploy --project=pitchey-backend working-server.ts"
    exit 1
fi

# Clean up temp file
rm deploy-backend.ts

# Deploy Frontend to Vercel
step "Deploying Frontend to Vercel"

cd frontend

echo -e "${YELLOW}Deploying to Vercel...${NC}"
echo ""
echo "When prompted:"
echo "  1. Link to existing project or create new"
echo "  2. Use './dist' as the output directory"
echo "  3. Override build command: npm run build"
echo ""

npx vercel --prod

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Frontend deployed to Vercel${NC}"
    echo ""
    echo -e "${YELLOW}📝 Important: Update your backend environment${NC}"
    echo "1. Go to: https://dash.deno.com/projects/pitchey-backend/settings"
    echo "2. Update FRONTEND_URL with your Vercel URL"
    echo ""
else
    echo -e "${RED}❌ Frontend deployment failed${NC}"
    exit 1
fi

cd ..

# Summary
echo ""
echo "================================================"
echo -e "${GREEN}🎉 MVP DEPLOYMENT COMPLETE!${NC}"
echo "================================================"
echo ""
echo -e "${BLUE}Your FREE MVP is now live:${NC}"
echo ""
echo "📦 Backend:  https://pitchey-backend.deno.dev"
echo "🌐 Frontend: https://your-app.vercel.app"
echo "🗄️ Database: Neon (PostgreSQL)"
echo "💾 Cache:    In-memory or Upstash"
echo ""
echo -e "${YELLOW}Free Tier Limits:${NC}"
echo "• Deno Deploy: 100,000 requests/day"
echo "• Vercel: 100GB bandwidth/month"
echo "• Neon: 3GB compute/month"
echo "• Upstash: 10,000 commands/day"
echo ""
echo -e "${GREEN}Total Cost: $0/month 🎉${NC}"
echo ""
echo "Next steps:"
echo "1. Test your deployment"
echo "2. Update CORS settings if needed"
echo "3. Monitor usage in dashboards"
echo "4. Share with users!"
echo ""
echo "Monitoring dashboards:"
echo "• Deno: https://dash.deno.com"
echo "• Vercel: https://vercel.com/dashboard"
echo "• Neon: https://console.neon.tech"
echo "• Upstash: https://console.upstash.com"