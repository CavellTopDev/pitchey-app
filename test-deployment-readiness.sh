#!/bin/bash

echo "🧪 Deployment Readiness Test"
echo "============================="
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

READY=true

# Test 1: Backend Health
echo "1️⃣  Testing Backend Health..."
HEALTH=$(curl -s http://localhost:8001/api/health)
if echo "$HEALTH" | grep -q "healthy"; then
  echo -e "${GREEN}✅ Backend is healthy${NC}"
  
  # Check cache status
  CACHE_TYPE=$(echo "$HEALTH" | grep -o '"type":"[^"]*' | cut -d'"' -f4)
  echo "   Cache type: $CACHE_TYPE"
else
  echo -e "${RED}❌ Backend health check failed${NC}"
  READY=false
fi
echo ""

# Test 2: Database Connection
echo "2️⃣  Testing Database Connection..."
LOGIN=$(curl -s -X POST http://localhost:8001/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}')
  
if echo "$LOGIN" | grep -q "token"; then
  echo -e "${GREEN}✅ Database connection working${NC}"
else
  echo -e "${RED}❌ Database connection failed${NC}"
  READY=false
fi
echo ""

# Test 3: Frontend Build
echo "3️⃣  Testing Frontend..."
if [ -d "frontend/dist" ]; then
  echo -e "${GREEN}✅ Frontend build exists${NC}"
else
  echo -e "${YELLOW}⚠️  Frontend not built yet${NC}"
  echo "   Run: cd frontend && npm run build"
fi
echo ""

# Test 4: Environment Files
echo "4️⃣  Checking Environment Files..."
if [ -f ".env.production" ]; then
  echo -e "${GREEN}✅ .env.production exists${NC}"
  
  # Check required vars
  source .env.production
  if [ ! -z "$DATABASE_URL" ] && [ ! -z "$JWT_SECRET" ]; then
    echo -e "${GREEN}✅ Required environment variables set${NC}"
  else
    echo -e "${RED}❌ Missing required environment variables${NC}"
    READY=false
  fi
else
  echo -e "${RED}❌ .env.production not found${NC}"
  echo "   Copy .env.example to .env.production and configure"
  READY=false
fi
echo ""

# Test 5: Deployment Tools
echo "5️⃣  Checking Deployment Tools..."
MISSING=""

if ! command -v deployctl &> /dev/null; then
  MISSING="$MISSING deployctl"
fi

if ! command -v vercel &> /dev/null; then
  MISSING="$MISSING vercel"
fi

if [ -z "$MISSING" ]; then
  echo -e "${GREEN}✅ All deployment tools installed${NC}"
else
  echo -e "${YELLOW}⚠️  Missing tools:$MISSING${NC}"
  echo "   Install deployctl: deno install -A https://deno.land/x/deploy/deployctl.ts"
  echo "   Install vercel: npm i -g vercel"
fi
echo ""

# Summary
echo "============================="
if [ "$READY" = true ]; then
  echo -e "${GREEN}🎉 READY FOR DEPLOYMENT!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Run: ./deploy-mvp-free.sh"
  echo "2. Follow the prompts"
  echo "3. Your MVP will be live in minutes!"
else
  echo -e "${RED}❌ NOT READY FOR DEPLOYMENT${NC}"
  echo ""
  echo "Fix the issues above, then run this test again."
fi
echo ""

# Show current resource usage
echo "📊 Current Local Resources:"
echo "   • Requests handled: N/A (local only)"
echo "   • Cache entries: $(curl -s http://localhost:8001/api/health | grep -o '"type":"[^"]*' | cut -d'"' -f4)"
echo "   • Database: PostgreSQL (Docker)"
echo ""
echo "📈 Free Tier Limits (Production):"
echo "   • Deno Deploy: 100,000 requests/day"
echo "   • Vercel: 100GB bandwidth/month"
echo "   • Neon: 0.5GB storage, 3GB compute/month"
echo "   • Upstash: 10,000 Redis commands/day"